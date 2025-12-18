/**
 * Inventory V4 - Alias Types
 * Types for Alias V4 sync operations
 * Based on validated API responses in ALIAS_V4_API_MASTER_REFERENCE.md
 */

// ============================================================================
// Sync Result Types
// ============================================================================

export type SyncStage =
  | 'catalog_fetch'
  | 'availabilities'
  | 'variants'
  | 'market_data'
  | 'sales_history';

export type SyncError = {
  variantId?: string;
  size?: string;
  region?: string;
  stage: SyncStage;
  error: string;
};

export type SyncResult = {
  success: boolean;
  catalogId?: string;
  counts: {
    variantsSynced: number;
    marketDataRefreshed: number;
    priceSnapshotsInserted: number;
    salesRecordsInserted: number;
  };
  errors: SyncError[];
};

// ============================================================================
// API Response Types (from validated responses)
// ============================================================================

/**
 * Catalog API Response
 * GET /api/v1/catalog/{catalog_id}
 */
/**
 * Allowed size object from Alias API
 * Example: {"value": 10, "display_name": "10", "us_size_equivalent": 10}
 */
export type AliasAllowedSize = {
  value: number;
  display_name: string;
  us_size_equivalent: number;
};

export type AliasCatalogResponse = {
  catalog_item: {
    catalog_id: string;
    brand: string;
    name: string;
    nickname: string | null;
    sku: string;
    colorway: string | null;
    gender: string | null;
    product_category: string;
    product_type: string;
    release_date: string | null; // ISO date string
    retail_price_cents: string; // STRING cents (e.g., "14500")
    size_unit: string; // "US", "UK", "EU"
    allowed_sizes: AliasAllowedSize[]; // Array of size objects
    minimum_listing_price_cents: string;
    maximum_listing_price_cents: string;
    main_picture_url: string | null;
    requested_pictures: string[];
    requires_listing_pictures: boolean;
    resellable: boolean;
  };
};

/**
 * Availabilities API Response
 * GET /api/v1/pricing_insights/availabilities/{catalog_id}?region_id={region_id}
 */
export type AliasAvailabilitiesResponse = {
  variants: Array<{
    size: string; // "10", "10.5", etc.
    product_condition: string; // "PRODUCT_CONDITION_NEW", etc.
    packaging_condition: string; // "PACKAGING_CONDITION_GOOD_CONDITION", etc.
    consigned: boolean;
    availability: {
      lowest_listing_price_cents: string | null; // STRING cents
      highest_offer_price_cents: string | null;
      last_sold_listing_price_cents: string | null;
      global_indicator_price_cents: string | null;
    } | null;
  }>;
};

/**
 * Recent Sales API Response (Optional - if ALIAS_RECENT_SALES_ENABLED)
 * GET /api/v1/pricing_insights/recent_sales/{catalog_id}?size={size}&region_id={region_id}
 */
export type AliasRecentSalesResponse = {
  recent_sales: Array<{
    size: string;
    price_cents: string; // STRING cents
    purchased_at: string; // ISO timestamp
    consigned: boolean;
  }>;
};

// ============================================================================
// Database Row Types (for V4 Alias tables)
// ============================================================================

export type AliasProductRow = {
  alias_catalog_id: string;
  brand: string;
  name: string;
  nickname: string | null;
  sku: string;
  colorway: string | null;
  gender: string | null;
  product_category: string;
  product_type: string;
  release_date: string | null;
  retail_price_cents: number | null;
  size_unit: string;
  allowed_sizes: AliasAllowedSize[]; // Array of size objects with value, display_name, us_size_equivalent
  minimum_listing_price_cents: number | null;
  maximum_listing_price_cents: number | null;
  main_picture_url: string | null;
  requested_pictures: string[];
  requires_listing_pictures: boolean;
  resellable: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AliasVariantRow = {
  alias_catalog_id: string;
  size_value: number;
  size_display: string;
  size_unit: string;
  consigned: boolean;
  region_id: string; // '1'=US, '2'=EU, '3'=UK
  created_at?: string;
  updated_at?: string;
};

export type AliasMarketDataRow = {
  alias_variant_id: string; // Foreign key to variants.id
  lowest_ask: number | null;
  highest_bid: number | null;
  last_sale_price: number | null;
  global_indicator_price: number | null;
  currency_code: string;
  ask_count: number | null; // Always NULL for Alias
  bid_count: number | null; // Always NULL for Alias
  sales_last_72h: number | null; // Populated from recent_sales
  sales_last_30d: number | null; // Populated from recent_sales
  total_sales_volume: number | null;
  updated_at?: string;
  expires_at?: string;
};

export type AliasPriceHistoryRow = {
  id?: number;
  alias_variant_id: string;
  currency_code: string;
  lowest_ask: number | null;
  highest_bid: number | null;
  last_sale_price: number | null;
  global_indicator_price: number | null;
  recorded_at?: string;
};

export type AliasSalesHistoryRow = {
  id?: number;
  alias_catalog_id: string;
  size_value: number;
  price: number; // Major units (converted from cents)
  purchased_at: string; // ISO timestamp
  consigned: boolean;
  region_id: string;
  currency_code: string;
  recorded_at?: string;
};

// ============================================================================
// Variant with ID (from database after insert)
// ============================================================================

export type AliasVariantWithId = AliasVariantRow & {
  id: string;
};

// ============================================================================
// Options Types
// ============================================================================

export type FreshMarketOptions = {
  forceRefresh?: boolean; // Skip cache and always hit API
  ttlHours?: number; // Cache TTL in hours (default 24)
  appendHistory?: boolean; // Insert into price_history (default true)
  fetchSales?: boolean; // Fetch recent_sales (default false, requires ALIAS_RECENT_SALES_ENABLED)
};

export type SyncOptions = {
  regions?: string[]; // Region IDs to sync (default ['3', '2', '1'] = UK → EU → US)
  forceRefresh?: boolean; // Force refresh all market data
  fetchSales?: boolean; // Fetch sales history (requires ALIAS_RECENT_SALES_ENABLED)
};

// ============================================================================
// Utility Types
// ============================================================================

export type MarketData = {
  cached: boolean;
  data: AliasMarketDataRow;
};
