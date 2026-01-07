-- ============================================================================
-- INVENTORY V4 - STYLE CATALOG (Universal Product Registry)
-- Date: 2025-12-10
-- Purpose: Single source of truth for products across all providers
-- ============================================================================

-- ============================================================================
-- TABLE: Style Catalog (Universal Product Registry)
-- ============================================================================
-- Purpose: Neutral product catalog that all providers reference
-- Pattern: style_id (SKU) → provider mappings
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_style_catalog (
  -- Primary Key (Style ID / SKU)
  style_id TEXT PRIMARY KEY,                    -- e.g. 'DD1391-100', 'DZ5485-612'

  -- Product Metadata (source of truth)
  brand TEXT,                                   -- Nike, Adidas, Jordan, etc.
  name TEXT,                                    -- Full product name
  nickname TEXT,                                -- Common nickname
  colorway TEXT,                                -- Color description

  -- Product Attributes
  gender TEXT,                                  -- men, women, unisex, kids
  product_category TEXT,                        -- sneakers, apparel, etc.
  release_date DATE,                            -- Official release date
  retail_price_cents INTEGER,                   -- Original retail in cents (USD)

  -- Media
  primary_image_url TEXT,                       -- Main product image

  -- Provider Mappings (StockX)
  stockx_product_id UUID,                       -- FK to inventory_v4_stockx_products
  stockx_url_key TEXT,                          -- StockX URL slug

  -- Provider Mappings (Alias)
  alias_catalog_id TEXT,                        -- Alias catalog identifier

  -- Provider Mappings (Future)
  -- goat_product_id TEXT,
  -- ebay_item_id TEXT,
  -- Add more providers as needed

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast lookups by provider IDs
CREATE INDEX IF NOT EXISTS idx_style_catalog_stockx_product_id
  ON inventory_v4_style_catalog(stockx_product_id)
  WHERE stockx_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_style_catalog_stockx_url_key
  ON inventory_v4_style_catalog(stockx_url_key)
  WHERE stockx_url_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_style_catalog_alias_catalog_id
  ON inventory_v4_style_catalog(alias_catalog_id)
  WHERE alias_catalog_id IS NOT NULL;

-- Search indexes
CREATE INDEX IF NOT EXISTS idx_style_catalog_brand
  ON inventory_v4_style_catalog(brand);

CREATE INDEX IF NOT EXISTS idx_style_catalog_name
  ON inventory_v4_style_catalog USING gin(to_tsvector('english', name));

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

-- Ensure provider IDs are unique when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_style_catalog_stockx_product_id_unique
  ON inventory_v4_style_catalog(stockx_product_id)
  WHERE stockx_product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_style_catalog_alias_catalog_id_unique
  ON inventory_v4_style_catalog(alias_catalog_id)
  WHERE alias_catalog_id IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_v4_style_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventory_v4_style_catalog_updated_at
  ON inventory_v4_style_catalog;

CREATE TRIGGER trigger_update_inventory_v4_style_catalog_updated_at
  BEFORE UPDATE ON inventory_v4_style_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_v4_style_catalog_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE inventory_v4_style_catalog ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can view the catalog)
DROP POLICY IF EXISTS "Style catalog is publicly readable" ON inventory_v4_style_catalog;
CREATE POLICY "Style catalog is publicly readable"
  ON inventory_v4_style_catalog
  FOR SELECT
  USING (true);

-- Only service role can write (via sync scripts)
DROP POLICY IF EXISTS "Service role can manage style catalog" ON inventory_v4_style_catalog;
CREATE POLICY "Service role can manage style catalog"
  ON inventory_v4_style_catalog
  FOR ALL
  USING (auth.role() = 'service_role');

-- Allow ONLY owner to edit via frontend (admin UI)
DROP POLICY IF EXISTS "Owner can manage style catalog" ON inventory_v4_style_catalog;
CREATE POLICY "Owner can manage style catalog"
  ON inventory_v4_style_catalog
  FOR ALL
  TO authenticated
  USING (auth.uid() = 'fbcde760-820b-4eaf-949f-534a8130d44b'::uuid)
  WITH CHECK (auth.uid() = 'fbcde760-820b-4eaf-949f-534a8130d44b'::uuid);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE inventory_v4_style_catalog IS
  'Universal product catalog - single source of truth for products across all providers (StockX, Alias, etc.)';

COMMENT ON COLUMN inventory_v4_style_catalog.style_id IS
  'Primary identifier - manufacturer SKU (e.g. DD1391-100, DZ5485-612)';

COMMENT ON COLUMN inventory_v4_style_catalog.stockx_product_id IS
  'Reference to StockX product UUID (if synced)';

COMMENT ON COLUMN inventory_v4_style_catalog.alias_catalog_id IS
  'Alias catalog identifier (e.g. dunk-low-black-white-dd1391-100)';
