/**
 * Inventory V4 - StockX Types
 * Types for StockX V4 sync operations
 * Based on validated API responses in api-responses/inventory_v4_stockx/
 */

// ============================================================================
// Sync Result Types
// ============================================================================

export type SyncStage =
  | 'catalog_search'
  | 'product_details'
  | 'variants'
  | 'market_data';

export type SyncError = {
  variantId?: string;
  size?: string;
  stage: SyncStage;
  error: string;
};

export type SyncResult = {
  success: boolean;
  productId?: string;
  counts: {
    variantsSynced: number;
    marketDataRefreshed: number;
    priceSnapshotsInserted: number;
    rateLimited: number; // Track 429 responses separately
  };
  errors: SyncError[];
};

// ============================================================================
// API Response Types (from validated responses)
// ============================================================================

/**
 * Catalog Search API Response
 * GET /v2/catalog/search?query={sku}
 */
export type CatalogSearchResponse = {
  count: number;
  pageNumber: number;
  pageSize: number;
  hasNextPage: boolean;
  products: Array<{
    productId: string;
    brand: string;
    productType: string;
    styleId: string; // SKU
    urlKey: string;
    title: string;
    productAttributes: {
      color: string | null;
      colorway: string | null;
      gender: string | null;
      releaseDate: string | null; // ISO date string
      retailPrice: number | null;
      season: string | null;
    };
  }>;
};

/**
 * Product Details API Response
 * GET /v2/catalog/products/{productId}
 */
export type ProductDetailsResponse = {
  productId: string;
  brand: string;
  productType: string;
  styleId: string;
  urlKey: string;
  title: string;
  productAttributes: {
    colorway: string | null;
    gender: string | null;
    releaseDate: string | null;
    retailPrice: number | null;
  };
  isFlexEligible?: boolean;
  isDirectEligible?: boolean;
};

/**
 * Product Variants API Response
 * GET /v2/catalog/products/{productId}/variants
 */
export type ProductVariant = {
  variantId: string;
  variantName: string;
  variantValue: string; // Size (e.g., "10")
  sizeChart: {
    displayOptions: Array<{ size: string; type: string }>;
    defaultConversion: { size: string; type: string };
    availableConversions: Array<{ size: string; type: string }>;
  };
  gtins: Array<{
    identifier: string; // Barcode
    type: string; // "UPC", "EAN", etc.
  }>;
  isFlexEligible?: boolean;
  isDirectEligible?: boolean;
};

export type ProductVariantsResponse = ProductVariant[];

/**
 * Market Data API Response
 * GET /v2/catalog/products/{productId}/variants/{variantId}/market-data?currencyCode={currency}
 */
export type MarketDataResponse = {
  productId: string;
  variantId: string;
  currencyCode: string;
  highestBidAmount: string | null; // STRING in MAJOR UNITS (e.g., "27" = £27.00)
  lowestAskAmount: string | null;
  flexLowestAskAmount: string | null;
  earnMoreAmount: string | null; // StockX suggestion
  sellFasterAmount: string | null; // StockX suggestion
  standardMarketData: {
    lowestAsk: string | null;
    highestBidAmount: string | null;
    sellFaster: string | null;
    earnMore: string | null;
    beatUS: string | null;
  };
  flexMarketData: {
    lowestAsk: string | null;
    highestBidAmount: string | null;
    sellFaster: string | null;
    earnMore: string | null;
    beatUS: string | null;
  };
  directMarketData: {
    lowestAsk: string | null;
    highestBidAmount: string | null;
    sellFaster: string | null;
    earnMore: string | null;
    beatUS: string | null;
  };
};

// ============================================================================
// Database Row Types (for V4 tables)
// ============================================================================

export type ProductRow = {
  stockx_product_id: string;
  brand: string;
  title: string;
  style_id: string;
  product_type: string;
  url_key: string;
  colorway: string | null;
  gender: string | null;
  release_date: string | null;
  retail_price: number | null;
  is_flex_eligible: boolean;
  is_direct_eligible: boolean;
  created_at?: string;
  updated_at?: string;
};

export type VariantRow = {
  stockx_variant_id: string;
  stockx_product_id: string;
  variant_name: string;
  variant_value: string;
  size_chart: any; // JSONB
  gtins: any[]; // JSONB array
  is_flex_eligible: boolean;
  is_direct_eligible: boolean;
  created_at?: string;
  updated_at?: string;
};

export type MarketDataRow = {
  stockx_variant_id: string;
  currency_code: string;
  highest_bid: number | null;
  lowest_ask: number | null;
  flex_lowest_ask: number | null;
  earn_more: number | null;
  sell_faster: number | null;
  standard_market_data: any; // JSONB
  flex_market_data: any; // JSONB
  direct_market_data: any; // JSONB
  updated_at?: string;
  expires_at?: string;
};

export type PriceHistoryRow = {
  id?: number;
  stockx_variant_id: string;
  currency_code: string;
  highest_bid: number | null;
  lowest_ask: number | null;
  snapshot_date?: string; // YYYY-MM-DD - one row per day per variant+currency
  recorded_at?: string;
};

// ============================================================================
// Options Types
// ============================================================================

export type FreshMarketOptions = {
  forceRefresh?: boolean; // Skip cache and always hit API
  ttlHours?: number; // Cache TTL in hours (default 24)
  appendHistory?: boolean; // Insert into price_history (default true)
};

// ============================================================================
// Utility Types
// ============================================================================

export type MarketData = {
  cached: boolean;
  data: MarketDataRow;
};
