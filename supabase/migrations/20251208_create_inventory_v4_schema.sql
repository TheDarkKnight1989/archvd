-- ============================================================================
-- INVENTORY V4 - COMPLETE REBUILD
-- Date: 2025-12-08
-- Purpose: Clean slate rebuild of inventory + market data pipeline
-- Namespace: All tables prefixed with inventory_v4_*
-- ============================================================================

-- ============================================================================
-- 1. CORE INVENTORY TABLE (v4)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_v4 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Product Identification
  sku TEXT NOT NULL,                          -- Style code (e.g., "DD1391-100")
  brand TEXT NULL,                            -- Nike, Adidas, etc.
  model TEXT NULL,                            -- Jordan 1 Low, Dunk High, etc.
  colorway TEXT NULL,                         -- Panda, Chicago, etc.

  -- Size Information
  size_uk NUMERIC(6,2) NULL,                  -- UK size (primary)
  size_us NUMERIC(6,2) NULL,                  -- US size
  size_eu NUMERIC(6,2) NULL,                  -- EU size

  -- Purchase Information
  purchase_price NUMERIC(12,2) NOT NULL,      -- Amount paid (GBP)
  purchase_date DATE NOT NULL,
  tax NUMERIC(12,2) DEFAULT 0,
  shipping NUMERIC(12,2) DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'listed', 'sold', 'worn', 'personal')),

  category TEXT NOT NULL DEFAULT 'sneaker'
    CHECK (category IN ('sneaker', 'pokemon', 'apparel', 'accessory', 'other')),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT inventory_v4_user_sku_size_unique UNIQUE (user_id, sku, size_uk)
);

-- Indexes
CREATE INDEX idx_inventory_v4_user_id ON public.inventory_v4 (user_id);
CREATE INDEX idx_inventory_v4_sku ON public.inventory_v4 (sku);
CREATE INDEX idx_inventory_v4_status ON public.inventory_v4 (status);
CREATE INDEX idx_inventory_v4_created_at ON public.inventory_v4 (created_at DESC);

-- RLS Policies
ALTER TABLE public.inventory_v4 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own inventory"
  ON public.inventory_v4 FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own inventory"
  ON public.inventory_v4 FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inventory"
  ON public.inventory_v4 FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inventory"
  ON public.inventory_v4 FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 2. MARKET DATA TABLE (v4) - FIXED PIPELINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_v4_market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider Information
  provider TEXT NOT NULL
    CHECK (provider IN ('stockx', 'alias', 'ebay')),

  provider_source TEXT NOT NULL,              -- 'market_data', 'availabilities', etc.
  provider_product_id TEXT NULL,              -- StockX productId, Alias catalog_id
  provider_variant_id TEXT NULL,              -- StockX variantId (size-specific)

  -- Product Identification (normalized)
  sku TEXT NULL,                              -- Style code
  size_key TEXT NOT NULL,                     -- Display size (e.g., "10.5")
  size_numeric NUMERIC(6,2) NULL,             -- Numeric for sorting (10.5)

  -- Pricing (ALWAYS in MAJOR UNITS - GBP/USD/EUR, NOT CENTS)
  -- CRITICAL: All prices stored as £145.00, NOT 14500 pennies
  currency_code TEXT NOT NULL,                -- GBP, USD, EUR
  lowest_ask NUMERIC(12,2) NULL,              -- Current lowest asking price
  highest_bid NUMERIC(12,2) NULL,             -- Current highest bid
  last_sale_price NUMERIC(12,2) NULL,         -- Most recent sale

  -- Volume Metrics
  sales_last_72h INTEGER NULL,                -- Sales in last 3 days
  sales_last_30d INTEGER NULL,                -- Sales in last 30 days

  -- Market Depth
  ask_count INTEGER NULL,                     -- Number of active asks
  bid_count INTEGER NULL,                     -- Number of active bids

  -- Advanced Metrics (StockX only)
  volatility NUMERIC(8,4) NULL,               -- Price volatility (0.12 = 12%)

  -- Timestamp
  snapshot_at TIMESTAMPTZ NOT NULL,           -- When data was captured
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one snapshot per provider/product/size/currency
  CONSTRAINT inventory_v4_market_unique UNIQUE (
    provider,
    COALESCE(provider_product_id, '__null__'),
    COALESCE(provider_variant_id, '__null__'),
    size_key,
    currency_code,
    snapshot_at
  )
);

-- Indexes
CREATE INDEX idx_inventory_v4_market_provider ON public.inventory_v4_market_data (
  provider,
  provider_product_id,
  size_key,
  snapshot_at DESC
) WHERE provider_product_id IS NOT NULL;

CREATE INDEX idx_inventory_v4_market_sku ON public.inventory_v4_market_data (
  sku,
  size_key,
  provider,
  snapshot_at DESC
) WHERE sku IS NOT NULL;

CREATE INDEX idx_inventory_v4_market_snapshot ON public.inventory_v4_market_data (
  snapshot_at DESC
);

-- RLS Policies (public read)
ALTER TABLE public.inventory_v4_market_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view market data"
  ON public.inventory_v4_market_data FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Service role can manage market data"
  ON public.inventory_v4_market_data FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. MATERIALIZED VIEW - LATEST PRICES
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.inventory_v4_market_latest AS
SELECT DISTINCT ON (
  provider,
  COALESCE(provider_product_id, '__null__'),
  COALESCE(provider_variant_id, '__null__'),
  size_key,
  currency_code
)
  id,
  provider,
  provider_source,
  provider_product_id,
  provider_variant_id,
  sku,
  size_key,
  size_numeric,
  currency_code,
  lowest_ask,
  highest_bid,
  last_sale_price,
  sales_last_72h,
  sales_last_30d,
  ask_count,
  bid_count,
  volatility,
  snapshot_at,
  created_at
FROM public.inventory_v4_market_data
WHERE snapshot_at > NOW() - INTERVAL '7 days'
ORDER BY
  provider,
  COALESCE(provider_product_id, '__null__'),
  COALESCE(provider_variant_id, '__null__'),
  size_key,
  currency_code,
  snapshot_at DESC;

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX idx_inventory_v4_market_latest_unique ON public.inventory_v4_market_latest (
  provider,
  COALESCE(provider_product_id, '__null__'),
  COALESCE(provider_variant_id, '__null__'),
  size_key,
  currency_code
);

-- Additional indexes
CREATE INDEX idx_inventory_v4_market_latest_sku ON public.inventory_v4_market_latest (
  sku,
  size_key,
  provider
) WHERE sku IS NOT NULL;

-- Helper function to refresh view
CREATE OR REPLACE FUNCTION refresh_inventory_v4_market_latest()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.inventory_v4_market_latest;
  RAISE NOTICE 'Refreshed inventory_v4_market_latest materialized view';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. MARKET LINKS TABLE (Inventory → Provider Mappings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_v4_market_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to inventory item
  inventory_id UUID NOT NULL REFERENCES public.inventory_v4(id) ON DELETE CASCADE,

  -- Provider mappings
  provider TEXT NOT NULL
    CHECK (provider IN ('stockx', 'alias', 'ebay')),

  -- Provider-specific IDs
  provider_product_id TEXT NULL,              -- StockX productId, Alias catalog_id
  provider_variant_id TEXT NULL,              -- StockX variantId
  provider_listing_id TEXT NULL,              -- Active listing ID (if listed)

  -- Mapping metadata
  mapping_confidence NUMERIC(3,2) NULL,       -- 0.00-1.00 confidence score
  mapping_status TEXT DEFAULT 'ok'
    CHECK (mapping_status IN ('ok', 'needs_review', 'failed')),

  -- Sync tracking
  last_sync_at TIMESTAMPTZ NULL,
  last_sync_success_at TIMESTAMPTZ NULL,
  last_sync_error TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One mapping per inventory item per provider
  CONSTRAINT inventory_v4_market_links_unique UNIQUE (inventory_id, provider)
);

-- Indexes
CREATE INDEX idx_inventory_v4_market_links_inventory ON public.inventory_v4_market_links (inventory_id);
CREATE INDEX idx_inventory_v4_market_links_provider ON public.inventory_v4_market_links (provider);
CREATE INDEX idx_inventory_v4_market_links_product ON public.inventory_v4_market_links (
  provider,
  provider_product_id
) WHERE provider_product_id IS NOT NULL;

-- RLS Policies
ALTER TABLE public.inventory_v4_market_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own market links"
  ON public.inventory_v4_market_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_v4
      WHERE inventory_v4.id = inventory_v4_market_links.inventory_id
      AND inventory_v4.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own market links"
  ON public.inventory_v4_market_links FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_v4
      WHERE inventory_v4.id = inventory_v4_market_links.inventory_id
      AND inventory_v4.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inventory_v4
      WHERE inventory_v4.id = inventory_v4_market_links.inventory_id
      AND inventory_v4.user_id = auth.uid()
    )
  );

-- Service role full access
CREATE POLICY "Service role can manage all market links"
  ON public.inventory_v4_market_links FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.inventory_v4 IS
  'Inventory V4 - Clean rebuild of inventory system with fixed architecture';

COMMENT ON TABLE public.inventory_v4_market_data IS
  'Market pricing data for V4 - ALL PRICES IN MAJOR UNITS (not cents)';

COMMENT ON COLUMN public.inventory_v4_market_data.lowest_ask IS
  'Lowest asking price in MAJOR UNITS (£145.00, NOT 14500 pennies)';

COMMENT ON MATERIALIZED VIEW public.inventory_v4_market_latest IS
  'Latest market prices per provider/product/size - refresh every 5-10 minutes';

COMMENT ON TABLE public.inventory_v4_market_links IS
  'Links inventory items to provider catalogs (StockX/Alias/eBay)';

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON public.inventory_v4 TO authenticated;
GRANT ALL ON public.inventory_v4 TO authenticated;

GRANT SELECT ON public.inventory_v4_market_data TO authenticated, anon;
GRANT ALL ON public.inventory_v4_market_data TO service_role;

GRANT SELECT ON public.inventory_v4_market_latest TO authenticated, anon;

GRANT SELECT ON public.inventory_v4_market_links TO authenticated;
GRANT ALL ON public.inventory_v4_market_links TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Inventory V4 schema created successfully';
  RAISE NOTICE '📦 Tables: inventory_v4, inventory_v4_market_data, inventory_v4_market_links';
  RAISE NOTICE '📊 Materialized view: inventory_v4_market_latest';
  RAISE NOTICE '⚡ Helper: refresh_inventory_v4_market_latest()';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 CRITICAL: All market prices in MAJOR UNITS (not cents)';
  RAISE NOTICE '🔒 RLS enabled on all tables';
  RAISE NOTICE '🚀 Ready for clean data ingestion';
END $$;
