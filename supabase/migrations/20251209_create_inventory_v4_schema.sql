-- ============================================================================
-- INVENTORY V4 - STOCKX SCHEMA
-- ============================================================================
--
-- Created: 2025-12-09
-- Purpose: Clean rebuild of inventory system with StockX as first provider
--
-- Architecture: Global Catalog
--   - Products & Variants are GLOBAL (shared across all users)
--   - User ownership tracked in separate inventory table
--   - Benefits: No duplicate data, analytics-ready, scales to multi-user
--
-- Tables (5):
--   1. inventory_v4_stockx_products        - Product metadata (global)
--   2. inventory_v4_stockx_variants        - Size catalog (global)
--   3. inventory_v4_stockx_market_data     - Current pricing (UPSERT)
--   4. inventory_v4_stockx_price_history   - Historical snapshots (INSERT)
--   5. inventory_v4_stockx_user_inventory  - User ownership
--
-- Data Source: Validated from real StockX API responses
-- Files: api-responses/inventory_v4_stockx/*.json
--
-- Multi-Provider: Option C architecture
--   - When adding Alias: create inventory_v4_alias_* tables
--   - Create unified view to query across providers
--
-- ============================================================================

-- ============================================================================
-- TABLE 1: PRODUCTS (Global Catalog)
-- ============================================================================
-- Purpose: Store product metadata (one row per StockX product)
-- Source: GET /v2/catalog/products/{productId}
-- Update Pattern: UPSERT (update if product metadata changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_stockx_products (
  -- Primary Key
  stockx_product_id UUID PRIMARY KEY,

  -- Product Identity
  brand TEXT NOT NULL,
  title TEXT NOT NULL,
  style_id TEXT NOT NULL, -- SKU (e.g., "DD1391-100")
  product_type TEXT NOT NULL, -- "sneakers", "streetwear", etc.
  url_key TEXT NOT NULL, -- StockX slug for product page

  -- Product Attributes
  colorway TEXT, -- "White/Black"
  gender TEXT, -- "men", "women", "unisex"
  release_date DATE, -- Product release date
  retail_price NUMERIC(12,2), -- Original retail price

  -- StockX Features (from Product Details API)
  is_flex_eligible BOOLEAN NOT NULL DEFAULT false,
  is_direct_eligible BOOLEAN NOT NULL DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_stockx_products_style_id
  ON inventory_v4_stockx_products(style_id);
CREATE INDEX IF NOT EXISTS idx_stockx_products_brand
  ON inventory_v4_stockx_products(brand);
CREATE INDEX IF NOT EXISTS idx_stockx_products_product_type
  ON inventory_v4_stockx_products(product_type);

-- ============================================================================
-- TABLE 2: VARIANTS (Size Catalog - Global)
-- ============================================================================
-- Purpose: Store all sizes for each product (one row per size)
-- Source: GET /v2/catalog/products/{productId}/variants
-- Update Pattern: UPSERT (sizes rarely change, but can be updated)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_stockx_variants (
  -- Primary Key
  stockx_variant_id UUID PRIMARY KEY,

  -- Foreign Key to Product
  stockx_product_id UUID NOT NULL REFERENCES inventory_v4_stockx_products(stockx_product_id) ON DELETE CASCADE,

  -- Variant Identity
  variant_name TEXT NOT NULL, -- "Nike-Dunk-Low-Retro-White-Black-2021:13"
  variant_value TEXT NOT NULL, -- "10" (the size value)

  -- Size Conversions (stored as JSONB from API)
  size_chart JSONB NOT NULL, -- {defaultConversion: {...}, availableConversions: [...]}

  -- Barcodes (stored as JSONB array from API)
  gtins JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{identifier: "194502876062", type: "UPC"}, ...]

  -- StockX Features (from Variants API)
  is_flex_eligible BOOLEAN NOT NULL DEFAULT false,
  is_direct_eligible BOOLEAN NOT NULL DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stockx_variants_product_id
  ON inventory_v4_stockx_variants(stockx_product_id);
CREATE INDEX IF NOT EXISTS idx_stockx_variants_variant_value
  ON inventory_v4_stockx_variants(variant_value);
CREATE INDEX IF NOT EXISTS idx_stockx_variants_gtins
  ON inventory_v4_stockx_variants USING GIN(gtins); -- For barcode scanner lookups

-- ============================================================================
-- TABLE 3: MARKET DATA (Current Pricing)
-- ============================================================================
-- Purpose: Store latest market prices (UPSERT with 24hr TTL)
-- Source: GET /v2/catalog/products/{productId}/variants/{variantId}/market-data
-- Update Pattern: UPSERT on (variant_id, currency_code)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_stockx_market_data (
  -- Composite Primary Key
  stockx_variant_id UUID NOT NULL REFERENCES inventory_v4_stockx_variants(stockx_variant_id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL DEFAULT 'GBP', -- UK primary region

  PRIMARY KEY (stockx_variant_id, currency_code),

  -- Top-Level Pricing (NUMERIC for calculations, converted from STRING)
  highest_bid NUMERIC(12,2), -- Convert "27" → 27.00
  lowest_ask NUMERIC(12,2),
  flex_lowest_ask NUMERIC(12,2),
  earn_more NUMERIC(12,2), -- StockX suggestion: "List at this price to earn more"
  sell_faster NUMERIC(12,2), -- StockX suggestion: "List at this price to sell faster"

  -- Program-Specific Pricing (stored as JSONB from API)
  standard_market_data JSONB, -- {lowestAsk, highestBid, sellFaster, earnMore, beatUS}
  flex_market_data JSONB,
  direct_market_data JSONB,

  -- Cache Management
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours' -- 24hr TTL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stockx_market_data_expires_at
  ON inventory_v4_stockx_market_data(expires_at);
CREATE INDEX IF NOT EXISTS idx_stockx_market_data_variant_updated
  ON inventory_v4_stockx_market_data(stockx_variant_id, updated_at DESC);

-- ============================================================================
-- TABLE 4: PRICE HISTORY (Historical Snapshots)
-- ============================================================================
-- Purpose: Track price changes over time for charts & analytics
-- Update Pattern: INSERT only (never UPDATE) - append-only log
-- No UNIQUE constraint (allow flexible timestamp precision)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_stockx_price_history (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Foreign Key to Variant
  stockx_variant_id UUID NOT NULL REFERENCES inventory_v4_stockx_variants(stockx_variant_id) ON DELETE CASCADE,

  -- Snapshot Data
  currency_code TEXT NOT NULL DEFAULT 'GBP',
  highest_bid NUMERIC(12,2),
  lowest_ask NUMERIC(12,2),

  -- Timestamp (no UNIQUE - allow duplicates if sync runs twice)
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for time-series queries
CREATE INDEX IF NOT EXISTS idx_stockx_price_history_variant_recorded
  ON inventory_v4_stockx_price_history(stockx_variant_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_stockx_price_history_recorded_at
  ON inventory_v4_stockx_price_history(recorded_at DESC);

-- ============================================================================
-- TABLE 5: USER INVENTORY (Ownership)
-- ============================================================================
-- Purpose: Track which users own which variants
-- Update Pattern: INSERT on add, DELETE on remove, UPDATE on modify
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_stockx_user_inventory (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Foreign Keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stockx_variant_id UUID NOT NULL REFERENCES inventory_v4_stockx_variants(stockx_variant_id) ON DELETE CASCADE,

  -- Ownership Data
  quantity INTEGER NOT NULL DEFAULT 1,
  purchase_price NUMERIC(12,2) NOT NULL, -- What user paid for it (always required)
  condition TEXT, -- "new", "used", etc.
  notes TEXT, -- User notes

  -- Listing Status
  listing_status TEXT DEFAULT 'unlisted', -- "unlisted", "listed", "sold"
  listed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure user can't add same variant twice (unique per user+variant)
  UNIQUE(user_id, stockx_variant_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stockx_user_inventory_user_id
  ON inventory_v4_stockx_user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_stockx_user_inventory_variant_id
  ON inventory_v4_stockx_user_inventory(stockx_variant_id);
CREATE INDEX IF NOT EXISTS idx_stockx_user_inventory_listing_status
  ON inventory_v4_stockx_user_inventory(listing_status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE inventory_v4_stockx_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_v4_stockx_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_v4_stockx_market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_v4_stockx_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_v4_stockx_user_inventory ENABLE ROW LEVEL SECURITY;

-- Products & Variants: Public READ (global catalog)
CREATE POLICY "Products are publicly readable"
  ON inventory_v4_stockx_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Variants are publicly readable"
  ON inventory_v4_stockx_variants FOR SELECT
  TO authenticated
  USING (true);

-- Market Data: Public READ (everyone can see market prices)
CREATE POLICY "Market data is publicly readable"
  ON inventory_v4_stockx_market_data FOR SELECT
  TO authenticated
  USING (true);

-- Price History: Public READ (everyone can see price charts)
CREATE POLICY "Price history is publicly readable"
  ON inventory_v4_stockx_price_history FOR SELECT
  TO authenticated
  USING (true);

-- User Inventory: Private (users can only see their own inventory)
CREATE POLICY "Users can view their own inventory"
  ON inventory_v4_stockx_user_inventory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own inventory"
  ON inventory_v4_stockx_user_inventory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inventory"
  ON inventory_v4_stockx_user_inventory FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inventory"
  ON inventory_v4_stockx_user_inventory FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION inventory_v4_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_stockx_products_updated_at
  BEFORE UPDATE ON inventory_v4_stockx_products
  FOR EACH ROW
  EXECUTE FUNCTION inventory_v4_update_updated_at();

CREATE TRIGGER update_stockx_variants_updated_at
  BEFORE UPDATE ON inventory_v4_stockx_variants
  FOR EACH ROW
  EXECUTE FUNCTION inventory_v4_update_updated_at();

CREATE TRIGGER update_stockx_market_data_updated_at
  BEFORE UPDATE ON inventory_v4_stockx_market_data
  FOR EACH ROW
  EXECUTE FUNCTION inventory_v4_update_updated_at();

CREATE TRIGGER update_stockx_user_inventory_updated_at
  BEFORE UPDATE ON inventory_v4_stockx_user_inventory
  FOR EACH ROW
  EXECUTE FUNCTION inventory_v4_update_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE inventory_v4_stockx_products IS
  'V4: Global catalog of StockX products (shared across users)';
COMMENT ON TABLE inventory_v4_stockx_variants IS
  'V4: Size variants for StockX products (one row per size)';
COMMENT ON TABLE inventory_v4_stockx_market_data IS
  'V4: Current market prices with 24hr TTL (UPSERT pattern)';
COMMENT ON TABLE inventory_v4_stockx_price_history IS
  'V4: Historical price snapshots (INSERT only, no updates)';
COMMENT ON TABLE inventory_v4_stockx_user_inventory IS
  'V4: User ownership tracking (which users own which variants)';

-- ============================================================================
-- VALIDATION QUERIES (for testing after migration)
-- ============================================================================

-- Run these after migration to verify schema:
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'inventory_v4_stockx_%';
-- SELECT * FROM inventory_v4_stockx_products LIMIT 1;
-- SELECT * FROM inventory_v4_stockx_variants LIMIT 1;
-- SELECT * FROM inventory_v4_stockx_market_data LIMIT 1;
-- SELECT * FROM inventory_v4_stockx_price_history LIMIT 1;
-- SELECT * FROM inventory_v4_stockx_user_inventory LIMIT 1;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
