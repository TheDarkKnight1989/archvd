/**
 * Canonical Database Types for StockX Tables
 *
 * WHY: Single source of truth for database row shapes from StockX-related tables
 *
 * CRITICAL CONVENTIONS:
 * 1. All monetary amounts (amount, lowest_ask, highest_bid) are stored in MAJOR currency units
 *    - Example: 150.0 = £150.00 (NOT 15000 cents)
 *    - NEVER divide by 100 when reading from DB
 *    - NEVER multiply by 100 when writing to DB (unless converting from cents to major units)
 *
 * 2. External vs Internal IDs:
 *    - stockx_listing_id: External StockX listing ID (string from StockX API)
 *    - stockx_product_id: External StockX product ID (string from StockX API)
 *    - stockx_variant_id: External StockX variant ID (string from StockX API)
 *    - id: Internal UUID (our database primary key)
 *
 * 3. Currency Handling:
 *    - All prices are per-currency (USD, GBP, EUR)
 *    - User preference from profiles.base_currency
 *    - FX conversion done at query/display time, NOT storage time
 *
 * USAGE:
 * - Import these types when querying Supabase tables
 * - Use for type assertions after .select() calls
 * - Document any deviations from these shapes
 */

// ============================================================================
// StockX Listings Table (stockx_listings)
// ============================================================================

/**
 * Database row from stockx_listings table
 *
 * PURPOSE: Tracks user's active/inactive listings on StockX
 *
 * AMOUNT UNITS: amount is in MAJOR currency units (e.g., 150.0 = £150.00)
 */
export interface DbStockxListing {
  // Internal ID (UUID)
  id: string

  // External StockX IDs
  stockx_listing_id: string      // External StockX listing ID
  stockx_product_id: string       // External StockX product ID
  stockx_variant_id: string       // External StockX variant ID

  // User relationship
  user_id: string
  item_id: string | null  // FK to inventory table (if listing is for an owned item)

  // Pricing (MAJOR currency units)
  amount: number                  // Ask price in MAJOR units (e.g., 150.0 = £150)
  currency_code: string           // ISO currency code (USD, GBP, EUR)

  // Listing details
  status: 'ACTIVE' | 'INACTIVE' | 'MATCHED' | 'COMPLETED' | 'EXPIRED' | 'DELETED' | string
  quantity: number
  expires_at: string | null

  // Timestamps
  created_at: string
  updated_at: string
  synced_at: string | null        // Last successful sync with StockX API

  // Metadata
  metadata: Record<string, any> | null
}

// ============================================================================
// StockX Market Latest (Materialized View: stockx_market_latest)
// ============================================================================

/**
 * Database row from stockx_market_latest materialized view
 *
 * PURPOSE: Latest market snapshot per product/variant/currency
 * SOURCE: Aggregates market_prices table (DISTINCT ON most recent snapshot)
 *
 * AMOUNT UNITS: All price fields (lowest_ask, highest_bid) are in MAJOR currency units
 *
 * QUERY PATTERN:
 * ```typescript
 * const { data } = await supabase
 *   .from('stockx_market_latest')
 *   .select('*')
 *   .eq('stockx_product_id', productId)
 *   .eq('stockx_variant_id', variantId)
 *   .eq('currency_code', userCurrency)
 *   .single()
 *
 * // Use data.lowest_ask directly - already in major units!
 * const askPrice = data?.lowest_ask || null
 * ```
 */
export interface DbStockxMarketLatest {
  // Product/Variant identification
  stockx_product_id: string
  stockx_variant_id: string

  // Currency
  currency_code: string           // ISO currency code (USD, GBP, EUR)

  // Market prices (MAJOR currency units)
  // PHASE 3.8: Market price = lowest_ask ?? highest_bid ?? null
  // WHY: lowest_ask represents market value (what buyers pay to purchase instantly)
  lowest_ask: number | null       // Current lowest ask
  highest_bid: number | null      // Current highest bid

  // Volume metrics (optional, may be null)
  sales_last_72h: number | null
  volume_30d: number | null

  // Snapshot metadata
  snapshot_at: string | null      // Timestamp of this market snapshot
  provider: 'stockx' | string     // Data provider (always 'stockx' for this view)

  // Convenience fields (may not exist in all schema versions)
  sku?: string | null
  size?: string | null
}

// ============================================================================
// StockX Products Catalog (stockx_products)
// ============================================================================

/**
 * Database row from stockx_products table
 *
 * PURPOSE: Cached StockX product catalog data (brand, model, image, etc.)
 * SOURCE: Populated by StockX catalog API responses
 */
export interface DbStockxProduct {
  id: string                      // Internal UUID
  stockx_product_id: string       // External StockX product ID
  sku: string                     // Style ID (e.g., "DD1391-100")

  // Product metadata
  brand: string
  model: string
  colorway: string | null
  image_url: string | null

  // Timestamps
  created_at: string
  updated_at: string

  // Additional fields
  metadata: Record<string, any> | null
}

// ============================================================================
// Inventory Market Links (inventory_market_links)
// ============================================================================

/**
 * Database row from inventory_market_links table
 *
 * PURPOSE: Maps user inventory items to StockX product/variant for market data enrichment
 * SCOPE: User-scoped via item_id FK (RLS enforced)
 */
export interface DbInventoryMarketLink {
  id: string                      // Internal UUID
  item_id: string                 // FK to inventory.id

  // StockX identification
  provider: 'stockx' | string
  stockx_product_id: string
  stockx_variant_id: string

  // Timestamps
  created_at: string
  updated_at: string
}

// ============================================================================
// Market Price Daily Medians (market_price_daily_medians)
// ============================================================================

/**
 * Database row from market_price_daily_medians table/view
 *
 * PURPOSE: Daily aggregated median prices for sparkline charts (30-day history)
 *
 * AMOUNT UNITS: median_price is in MAJOR currency units
 */
export interface DbMarketPriceDailyMedian {
  provider: 'stockx' | string
  sku: string
  size: string | null
  currency_code: string
  date: string                    // ISO date (YYYY-MM-DD)
  median_price: number            // Daily median price in MAJOR units
}

// ============================================================================
// Helper Type Utilities
// ============================================================================

/**
 * Extract currency-specific market data from stockx_market_latest results
 *
 * USAGE:
 * ```typescript
 * const markets: DbStockxMarketLatest[] = await fetchMarkets()
 * const gbpMarket = markets.find(m => m.currency_code === 'GBP')
 * const price = gbpMarket?.lowest_ask || null  // Already in major units!
 * ```
 */
export type MarketDataByCurrency = Record<string, DbStockxMarketLatest>

/**
 * Convert array of market snapshots to currency-keyed map
 */
export function groupMarketsByCurrency(markets: DbStockxMarketLatest[]): MarketDataByCurrency {
  return markets.reduce((acc, market) => {
    acc[market.currency_code] = market
    return acc
  }, {} as MarketDataByCurrency)
}
