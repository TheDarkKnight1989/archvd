export const TABLE_ITEMS = 'Inventory'; // IMPORTANT: Must match Supabase table name exactly
export const TABLE_EXPENSES = 'expenses';

export type Category = 'sneaker' | 'apparel' | 'accessory' | 'other';
export type Status = 'active' | 'listed' | 'worn' | 'sold';
export type Platform = 'stockx' | 'goat' | 'ebay' | 'instagram' | 'tiktok' | 'vinted' | 'depop' | 'private' | 'shopify' | 'other';
export type ExpenseCategory = 'shipping' | 'fees' | 'ads' | 'supplies' | 'subscriptions' | 'misc';

export type InventoryItem = {
  id: string;
  user_id: string;
  sku: string;
  brand: string;
  model: string;
  size: string;
  category?: Category;
  purchase_price: number;
  tax?: number;
  shipping?: number;
  purchase_date?: string;
  sale_price?: number | null;
  sold_price?: number | null;
  sold_date?: string | null;
  platform?: Platform | null;
  sales_fee?: number | null;
  market_value?: number | null;
  status: Status;
  location: string;
  image_url?: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string;
  linked_item_id?: string | null;
  created_at: string;
};

export type MonthlyPnL = {
  month: string;
  revenue: number;
  cost: number;
  sales_fees: number;
  expenses: number;
  net_profit: number;
};

/**
 * EnrichedLineItem - V3 data type for InventoryTableV3
 * WHY: Unified interface for inventory display with all computed values
 *
 * @deprecated This type is being replaced by InventoryV4ItemFull.
 *             Use the V4 type directly in new code.
 *             See: src/lib/inventory-v4/types.ts
 */
export type EnrichedLineItem = {
  id: string;
  brand: string;
  model: string;
  colorway?: string | null;
  sku: string;
  size_uk?: number | string | null;

  // ==========================================================================
  // V4 TRANSITION FIELDS
  // These are populated by the V4→V3 adapter for backwards compatibility.
  // Access the V4 types directly in new code.
  // ==========================================================================
  /** @deprecated Use InventoryV4ItemFull.style.stockx_product_id */
  stockx_product_id?: string | null;
  /** @deprecated Use InventoryV4ItemFull.style.alias_catalog_id */
  alias_catalog_id?: string | null;
  /** @internal V4 StockX listing - DO NOT use in new code, use InventoryV4Listing */
  _v4StockxListing?: unknown;
  /** @internal V4 Alias listing - DO NOT use in new code, use InventoryV4Listing */
  _v4AliasListing?: unknown;

  // Image resolved through fallback chain (Alias-first priority)
  image: { url: string; alt: string };
  imageSource?: 'alias' | 'catalog' | 'provider' | 'brand' | 'neutral' | null;
  // Legacy image fields (for backwards compatibility)
  alias_image_url?: string | null;
  image_url?: string | null;

  // Purchase info
  purchaseDate?: string | null;
  created_at?: string | null;
  qty: number;
  invested: number;       // total cost (purchase_price + tax + shipping)
  avgCost: number;        // invested / qty

  // Market data
  // PHASE 3.8: Market price = lowest_ask ?? highest_bid ?? null
  // WHY: lowest_ask represents market value (what buyers pay to purchase instantly)
  market: {
    price?: number | null;
    lowestAsk?: number | null;
    currency?: 'GBP' | 'EUR' | 'USD' | null;
    provider?: 'stockx' | 'alias' | 'ebay' | 'seed' | null;
    updatedAt?: string | null;
    spark30d: Array<{ date: string; price: number | null }>;
  };

  // Instant Sell data (highest bid from any provider)
  instantSell: {
    gross: number | null;      // highestBid (raw)
    net: number | null;        // after fees
    currency?: 'GBP' | 'EUR' | 'USD' | null;
    provider?: 'stockx' | 'alias' | null;  // Which provider has the best bid
    updatedAt?: string | null;
    feePct: number;            // seller fee percentage
  };

  // Computed P/L
  total: number;          // market.price * qty
  pl: number | null;      // total - invested
  performancePct: number | null;  // pl / invested * 100

  // Links
  links: { productUrl?: string | null };

  // Status
  status: 'active' | 'listed' | 'worn' | 'sold' | 'archived';
  category?: string;

  // StockX mapping & listing data
  stockx?: {
    mapped: boolean;                    // Has StockX mapping in inventory_market_links
    productId?: string | null;          // stockx_product_id
    variantId?: string | null;          // stockx_variant_id
    listingId?: string | null;          // stockx_listing_id (if listed)
    listingStatus?: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'SOLD' | null;
    askPrice?: number | null;           // Current ask price
    expiresAt?: string | null;          // Listing expiry
    // Market data (exact match for this product+variant+currency)
    // PHASE 3.8: Market price = lowest_ask ?? highest_bid ?? null
    lowestAsk?: number | null;          // Lowest ask
    highestBid?: number | null;         // Highest bid
    // PHASE 3.11: Mapping health status
    mappingStatus?: 'ok' | 'stockx_404' | 'invalid' | 'unmapped' | null;
    lastSyncSuccessAt?: string | null;
    lastSyncError?: string | null;
  };

  // Alias (GOAT) mapping & listing data
  alias?: {
    mapped: boolean;                    // Has Alias mapping in inventory_market_links
    catalogId?: string | null;          // alias catalog_id (from Alias API)
    listingId?: string | null;          // alias_listing_id (if listed on Alias)
    listingStatus?: 'LISTING_STATUS_ACTIVE' | 'LISTING_STATUS_INACTIVE' | 'LISTING_STATUS_PENDING' | 'LISTING_STATUS_SOLD' | null;
    askPrice?: number | null;           // Current ask price (price_cents in Alias API)
    // Market data (from Alias pricing insights API)
    lowestAsk?: number | null;          // lowest_listing_price_cents
    highestBid?: number | null;         // highest_offer_price_cents
    lastSoldPrice?: number | null;      // last_sold_listing_price_cents
    globalIndicatorPrice?: number | null; // global_indicator_price_cents
    // Mapping health status
    mappingStatus?: 'ok' | 'alias_404' | 'invalid' | 'unmapped' | null;
    lastSyncSuccessAt?: string | null;
    lastSyncError?: string | null;
  };
};
