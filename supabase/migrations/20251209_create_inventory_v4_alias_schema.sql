-- ============================================================================
-- INVENTORY V4 - ALIAS INTEGRATION (5-Table Pattern)
-- Date: 2025-12-09
-- Purpose: Mirror StockX V4 architecture for Alias marketplace data
-- Pattern: Products → Variants → Market Data → Price History → Sales History
-- ============================================================================

-- ============================================================================
-- TABLE 1: PRODUCTS (Product Catalog - Global)
-- ============================================================================
-- Purpose: Store product-level metadata from Alias catalog
-- Source: GET /api/v1/catalog/{catalog_id}
-- Update Pattern: UPSERT on catalog_id
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_alias_products (
  -- Primary Key (Alias uses TEXT slugs, not UUIDs)
  alias_catalog_id TEXT PRIMARY KEY,

  -- Product Identity
  brand TEXT NOT NULL,                          -- "Nike", "Adidas", etc.
  name TEXT NOT NULL,                           -- "Nike Dunk Low 'Black White'"
  nickname TEXT,                                -- "Black White"
  sku TEXT NOT NULL,                            -- "DD1391 100" (with space!)

  -- Product Attributes
  colorway TEXT,                                -- "White/Black/White"
  gender TEXT,                                  -- "men", "women", "unisex"
  product_category TEXT NOT NULL,               -- "PRODUCT_CATEGORY_SHOES"
  product_type TEXT NOT NULL,                   -- "sneakers", "apparel", etc.
  release_date TIMESTAMPTZ,                     -- ISO8601 from API
  retail_price_cents INTEGER,                   -- Original retail (in cents)

  -- Size Configuration
  size_unit TEXT NOT NULL,                      -- "SIZE_UNIT_US", "SIZE_UNIT_UK", etc.
  allowed_sizes JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of size objects [{value, display_name, us_size_equivalent}]

  -- Pricing Constraints (from catalog)
  minimum_listing_price_cents INTEGER,         -- Alias enforced minimum
  maximum_listing_price_cents INTEGER,         -- Alias enforced maximum

  -- Media
  main_picture_url TEXT,                        -- Primary product image
  requested_pictures JSONB DEFAULT '[]'::jsonb, -- Required listing photos

  -- Listing Requirements
  requires_listing_pictures BOOLEAN NOT NULL DEFAULT false,
  resellable BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_alias_products_sku
  ON inventory_v4_alias_products(sku);
CREATE INDEX IF NOT EXISTS idx_alias_products_brand
  ON inventory_v4_alias_products(brand);
CREATE INDEX IF NOT EXISTS idx_alias_products_product_type
  ON inventory_v4_alias_products(product_type);
CREATE INDEX IF NOT EXISTS idx_alias_products_gender
  ON inventory_v4_alias_products(gender);

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_alias_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_alias_products_updated_at
  BEFORE UPDATE ON inventory_v4_alias_products
  FOR EACH ROW
  EXECUTE FUNCTION update_alias_products_updated_at();

-- ============================================================================
-- TABLE 2: VARIANTS (Size × Region × Consignment Catalog)
-- ============================================================================
-- Purpose: Store size/region/consignment combinations for each product
-- Source: GET /api/v1/pricing_insights/availabilities/{catalog_id}
-- Update Pattern: UPSERT on unique combination
--
-- IMPORTANT:
-- - Alias has NO variant IDs (variants = size + region + consigned)
-- - Sync ONLY fetches NEW + GOOD_CONDITION (enforced in sync code, not schema)
-- - product_condition and packaging_condition are NOT stored (always NEW + GOOD)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_alias_variants (
  -- Synthetic Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Foreign Key to Product
  alias_catalog_id TEXT NOT NULL REFERENCES inventory_v4_alias_products(alias_catalog_id) ON DELETE CASCADE,

  -- Variant Identity (NO ALIAS VARIANT ID - use composite key)
  size_value NUMERIC(6,2) NOT NULL,             -- 10.5, 11, etc.
  size_display TEXT NOT NULL,                   -- "10.5"
  size_unit TEXT NOT NULL,                      -- "US", "UK", "EU"

  -- Consignment Type (NEW + GOOD_CONDITION only, filtered in sync)
  consigned BOOLEAN NOT NULL DEFAULT false,     -- true = consignment, false = standard seller

  -- Region (Alias supports multi-region)
  region_id TEXT NOT NULL DEFAULT '1',          -- "1" = US, "2" = EU, "3" = UK

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint (one variant per catalog + size + consigned + region)
  CONSTRAINT alias_variants_unique UNIQUE (
    alias_catalog_id,
    size_value,
    consigned,
    region_id
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alias_variants_catalog_id
  ON inventory_v4_alias_variants(alias_catalog_id);
CREATE INDEX IF NOT EXISTS idx_alias_variants_size
  ON inventory_v4_alias_variants(size_value);
CREATE INDEX IF NOT EXISTS idx_alias_variants_region
  ON inventory_v4_alias_variants(region_id);
CREATE INDEX IF NOT EXISTS idx_alias_variants_consigned
  ON inventory_v4_alias_variants(consigned);
CREATE INDEX IF NOT EXISTS idx_alias_variants_catalog_region
  ON inventory_v4_alias_variants(alias_catalog_id, region_id);

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_alias_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_alias_variants_updated_at
  BEFORE UPDATE ON inventory_v4_alias_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_alias_variants_updated_at();

-- Data validation constraints
ALTER TABLE inventory_v4_alias_variants
  ADD CONSTRAINT variants_region_valid
  CHECK (region_id IN ('1', '2', '3'));

-- ============================================================================
-- TABLE 3: MARKET DATA (Current Pricing - Latest Snapshot)
-- ============================================================================
-- Purpose: Store latest market prices for each variant
-- Source: GET /api/v1/pricing_insights/availabilities/{catalog_id}
-- Update Pattern: UPSERT on (variant_id)
-- TTL: 24 hours (same as StockX V4)
--
-- IMPORTANT: Alias ALWAYS returns prices in USD, regardless of region
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_alias_market_data (
  -- Foreign Key (One-to-One with Variants)
  alias_variant_id BIGINT PRIMARY KEY REFERENCES inventory_v4_alias_variants(id) ON DELETE CASCADE,

  -- Pricing (stored in MAJOR UNITS: $145.00, NOT 14500 cents)
  -- CRITICAL: Convert from Alias cents strings → NUMERIC
  lowest_ask NUMERIC(12,2),                     -- "14500" → 145.00
  highest_bid NUMERIC(12,2),                    -- "13000" → 130.00
  last_sale_price NUMERIC(12,2),                -- Last completed sale
  global_indicator_price NUMERIC(12,2),         -- Alias market value estimate

  -- Currency (ALWAYS USD for Alias)
  currency_code TEXT NOT NULL DEFAULT 'USD',

  -- Market Depth (NOT available in Alias API - always NULL)
  ask_count INTEGER NULL,                       -- ❌ Alias doesn't provide this
  bid_count INTEGER NULL,                       -- ❌ Alias doesn't provide this

  -- Volume Metrics (from recent_sales endpoint - populated separately)
  sales_last_72h INTEGER NULL,
  sales_last_30d INTEGER NULL,
  total_sales_volume INTEGER NULL,              -- Total # of sales tracked

  -- Cache Management (same as StockX V4)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alias_market_data_expires_at
  ON inventory_v4_alias_market_data(expires_at);
CREATE INDEX IF NOT EXISTS idx_alias_market_data_updated_at
  ON inventory_v4_alias_market_data(updated_at DESC);

-- Data validation constraints
ALTER TABLE inventory_v4_alias_market_data
  ADD CONSTRAINT market_data_prices_non_negative
  CHECK (
    (lowest_ask IS NULL OR lowest_ask >= 0) AND
    (highest_bid IS NULL OR highest_bid >= 0) AND
    (last_sale_price IS NULL OR last_sale_price >= 0) AND
    (global_indicator_price IS NULL OR global_indicator_price >= 0)
  );

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_alias_market_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_alias_market_data_updated_at
  BEFORE UPDATE ON inventory_v4_alias_market_data
  FOR EACH ROW
  EXECUTE FUNCTION update_alias_market_data_updated_at();

-- ============================================================================
-- TABLE 4: PRICE HISTORY (Historical Snapshots)
-- ============================================================================
-- Purpose: Track price changes over time for charts & analytics
-- Source: Same as market_data, but INSERT-only (never UPDATE)
-- Update Pattern: INSERT only - append-only log
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_alias_price_history (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Foreign Key to Variant
  alias_variant_id BIGINT NOT NULL REFERENCES inventory_v4_alias_variants(id) ON DELETE CASCADE,

  -- Snapshot Data (minimal for time-series charting)
  currency_code TEXT NOT NULL DEFAULT 'USD',
  lowest_ask NUMERIC(12,2),
  highest_bid NUMERIC(12,2),
  last_sale_price NUMERIC(12,2),
  global_indicator_price NUMERIC(12,2),

  -- Timestamp (no UNIQUE - allow duplicates if sync runs twice)
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for time-series queries
CREATE INDEX IF NOT EXISTS idx_alias_price_history_variant_recorded
  ON inventory_v4_alias_price_history(alias_variant_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alias_price_history_recorded_at
  ON inventory_v4_alias_price_history(recorded_at DESC);

-- ============================================================================
-- TABLE 5: SALES HISTORY (Individual Sale Records)
-- ============================================================================
-- Purpose: Store individual sales for volume metrics & analytics
-- Source: GET /api/v1/pricing_insights/recent_sales
-- Update Pattern: INSERT only - append-only log
--
-- IMPORTANT: This endpoint requires size parameter (must call per size)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_alias_sales_history (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Foreign Key to Product (size links via size_value)
  alias_catalog_id TEXT NOT NULL REFERENCES inventory_v4_alias_products(alias_catalog_id) ON DELETE CASCADE,

  -- Sale Details (from API)
  size_value NUMERIC(6,2) NOT NULL,             -- Size that sold
  price NUMERIC(12,2) NOT NULL,                 -- Sale price in USD (major units: $145.00, converted from API cents)
  purchased_at TIMESTAMPTZ NOT NULL,            -- When sale happened
  consigned BOOLEAN NOT NULL,                   -- true = consignment sale

  -- Region
  region_id TEXT NOT NULL DEFAULT '1',          -- Which region this sale was in
  currency_code TEXT NOT NULL DEFAULT 'USD',

  -- Metadata
  recorded_at TIMESTAMPTZ DEFAULT NOW()        -- When we captured this sale

  -- Allow duplicates (no UNIQUE constraint) - sales can be re-fetched
  -- Index will handle deduplication in queries if needed
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_alias_sales_catalog_id
  ON inventory_v4_alias_sales_history(alias_catalog_id);
CREATE INDEX IF NOT EXISTS idx_alias_sales_size
  ON inventory_v4_alias_sales_history(size_value);
CREATE INDEX IF NOT EXISTS idx_alias_sales_purchased_at
  ON inventory_v4_alias_sales_history(purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_alias_sales_catalog_size_purchased
  ON inventory_v4_alias_sales_history(alias_catalog_id, size_value, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_alias_sales_region_purchased
  ON inventory_v4_alias_sales_history(region_id, purchased_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE inventory_v4_alias_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_v4_alias_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_v4_alias_market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_v4_alias_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_v4_alias_sales_history ENABLE ROW LEVEL SECURITY;

-- Products & Variants: Public READ (global catalog)
CREATE POLICY "Alias products are publicly readable"
  ON inventory_v4_alias_products FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Alias variants are publicly readable"
  ON inventory_v4_alias_variants FOR SELECT
  TO authenticated, anon
  USING (true);

-- Market Data: Public READ
CREATE POLICY "Alias market data is publicly readable"
  ON inventory_v4_alias_market_data FOR SELECT
  TO authenticated, anon
  USING (true);

-- Price History: Public READ
CREATE POLICY "Alias price history is publicly readable"
  ON inventory_v4_alias_price_history FOR SELECT
  TO authenticated, anon
  USING (true);

-- Sales History: Public READ
CREATE POLICY "Alias sales history is publicly readable"
  ON inventory_v4_alias_sales_history FOR SELECT
  TO authenticated, anon
  USING (true);

-- Service Role: Full Access (for sync operations)
CREATE POLICY "Service role can manage alias products"
  ON inventory_v4_alias_products FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage alias variants"
  ON inventory_v4_alias_variants FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage alias market data"
  ON inventory_v4_alias_market_data FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage alias price history"
  ON inventory_v4_alias_price_history FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage alias sales history"
  ON inventory_v4_alias_sales_history FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- MATERIALIZED VIEW - LATEST PRICES (Cache for UI Queries)
-- ============================================================================
-- Purpose: Fast lookups for current prices without JOINs
-- Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_v4_alias_market_latest
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS inventory_v4_alias_market_latest AS
SELECT
  -- Variant Info
  v.id AS alias_variant_id,
  v.alias_catalog_id,
  v.size_value,
  v.size_display,
  v.size_unit,
  v.consigned,
  v.region_id,

  -- Product Info (JOIN for convenience)
  p.sku,
  p.brand,
  p.name,
  p.product_type,

  -- Market Data
  m.lowest_ask,
  m.highest_bid,
  m.last_sale_price,
  m.global_indicator_price,
  m.sales_last_72h,
  m.sales_last_30d,
  m.currency_code,
  m.updated_at,
  m.expires_at
FROM inventory_v4_alias_variants v
JOIN inventory_v4_alias_products p ON p.alias_catalog_id = v.alias_catalog_id
LEFT JOIN inventory_v4_alias_market_data m ON m.alias_variant_id = v.id
WHERE m.updated_at IS NULL OR m.updated_at > NOW() - INTERVAL '7 days' -- Include all variants + recent data
ORDER BY v.alias_catalog_id, v.size_value;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_alias_market_latest_variant
  ON inventory_v4_alias_market_latest(alias_variant_id);
CREATE INDEX IF NOT EXISTS idx_alias_market_latest_catalog_size
  ON inventory_v4_alias_market_latest(alias_catalog_id, size_value);
CREATE INDEX IF NOT EXISTS idx_alias_market_latest_sku
  ON inventory_v4_alias_market_latest(sku);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to refresh materialized view (call from cron or after syncs)
CREATE OR REPLACE FUNCTION refresh_alias_market_latest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_v4_alias_market_latest;
END;
$$;

-- ============================================================================
-- COMMENTS (Schema Documentation)
-- ============================================================================

COMMENT ON TABLE inventory_v4_alias_products IS 'Alias product catalog (global, shared across users)';
COMMENT ON TABLE inventory_v4_alias_variants IS 'Alias size × region × consignment variants (NEW + GOOD_CONDITION only, no variant IDs from API)';
COMMENT ON TABLE inventory_v4_alias_market_data IS 'Current market prices (24hr TTL, UPSERT pattern, NEW + GOOD_CONDITION only)';
COMMENT ON TABLE inventory_v4_alias_price_history IS 'Historical price snapshots (append-only log for charts, NEW + GOOD_CONDITION only)';
COMMENT ON TABLE inventory_v4_alias_sales_history IS 'Individual sale records (from recent_sales endpoint, NEW + GOOD_CONDITION only)';

COMMENT ON COLUMN inventory_v4_alias_products.alias_catalog_id IS 'Alias catalog slug (e.g., "dunk-low-black-white-dd1391-100")';
COMMENT ON COLUMN inventory_v4_alias_products.sku IS 'Style code with space (e.g., "DD1391 100")';
COMMENT ON COLUMN inventory_v4_alias_products.retail_price_cents IS 'Original MSRP in USD cents';
COMMENT ON COLUMN inventory_v4_alias_products.allowed_sizes IS 'JSONB array of size objects from catalog API';

COMMENT ON COLUMN inventory_v4_alias_variants.consigned IS 'false = standard seller, true = consignment (always NEW + GOOD_CONDITION)';
COMMENT ON COLUMN inventory_v4_alias_variants.region_id IS '1=US, 2=EU, 3=UK (defaults to US)';

COMMENT ON COLUMN inventory_v4_alias_market_data.lowest_ask IS 'Current lowest asking price in USD (converted from cents)';
COMMENT ON COLUMN inventory_v4_alias_market_data.global_indicator_price IS 'Alias market value estimate';
COMMENT ON COLUMN inventory_v4_alias_market_data.ask_count IS 'NOT available in Alias API (always NULL)';
COMMENT ON COLUMN inventory_v4_alias_market_data.bid_count IS 'NOT available in Alias API (always NULL)';

COMMENT ON COLUMN inventory_v4_alias_sales_history.price IS 'Sale price in USD major units ($145.00). API returns cents, sync code converts to major units for consistency';
COMMENT ON COLUMN inventory_v4_alias_sales_history.purchased_at IS 'Timestamp from Alias API (when sale occurred)';
COMMENT ON COLUMN inventory_v4_alias_sales_history.recorded_at IS 'Timestamp when we captured this sale (sync time)';
