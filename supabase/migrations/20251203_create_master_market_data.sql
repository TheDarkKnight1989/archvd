-- ============================================================================
-- Master Market Data Table - Unified Provider Layer
-- Date: 2025-12-03
-- Purpose: Single normalized table for all market pricing data from all providers
-- ============================================================================

-- ============================================================================
-- 1. MASTER MARKET DATA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.master_market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════════
  -- IDENTIFICATION (Composite Key)
  -- ═══════════════════════════════════════════════════════════════

  provider TEXT NOT NULL
    CHECK (provider IN ('stockx', 'alias', 'ebay', 'manual')),

  -- Provider-specific identifiers
  provider_source TEXT NOT NULL,           -- 'stockx_market_data', 'alias_availabilities', 'alias_recent_sales'
  provider_product_id TEXT NULL,           -- StockX: productId, Alias: catalog_id
  provider_variant_id TEXT NULL,           -- StockX: variantId, Alias: null

  -- Normalized identifiers
  sku TEXT NULL,                           -- Style code (e.g., "DD1391-100")
  size_key TEXT NOT NULL,                  -- Size display (e.g., "10.5", "UK 9")
  size_numeric NUMERIC(6,2) NULL,          -- Size as number for sorting/matching (e.g., 10.5)
  size_system TEXT NULL DEFAULT 'US',      -- 'US', 'UK', 'EU', 'JP', 'OS'

  -- Currency context
  currency_code TEXT NOT NULL,             -- Original currency from API (USD, GBP, EUR)
  base_currency_code TEXT NULL,            -- User's base currency for comparison
  fx_rate NUMERIC(12,6) NULL,              -- Exchange rate (original → base)

  -- Region (optional, for providers that support it)
  region_code TEXT NULL,                   -- 'us', 'uk', 'eu', 'global', null

  -- ═══════════════════════════════════════════════════════════════
  -- PRICING DATA (in ORIGINAL CURRENCY, MAJOR UNITS)
  -- ═══════════════════════════════════════════════════════════════

  -- Current market prices (NUMERIC in major units: 145.00, not 14500 cents)
  lowest_ask NUMERIC(12,4) NULL,           -- Best current asking price
  highest_bid NUMERIC(12,4) NULL,          -- Best current offer price
  last_sale_price NUMERIC(12,4) NULL,      -- Most recent sale price

  -- Normalized prices (in BASE CURRENCY for cross-provider comparison)
  lowest_ask_base NUMERIC(12,4) NULL,      -- lowest_ask * fx_rate
  highest_bid_base NUMERIC(12,4) NULL,     -- highest_bid * fx_rate
  last_sale_price_base NUMERIC(12,4) NULL, -- last_sale_price * fx_rate

  -- Spread metrics (auto-calculated)
  spread_absolute NUMERIC(12,4)
    GENERATED ALWAYS AS (
      CASE
        WHEN lowest_ask IS NOT NULL AND highest_bid IS NOT NULL
        THEN lowest_ask - highest_bid
        ELSE NULL
      END
    ) STORED,

  spread_percentage NUMERIC(8,3)
    GENERATED ALWAYS AS (
      CASE
        WHEN lowest_ask IS NOT NULL AND lowest_ask > 0 AND highest_bid IS NOT NULL
        THEN ((lowest_ask - highest_bid) / lowest_ask) * 100
        ELSE NULL
      END
    ) STORED,

  -- ═══════════════════════════════════════════════════════════════
  -- MARKET DEPTH & ACTIVITY
  -- ═══════════════════════════════════════════════════════════════

  -- Volume indicators (provider-specific, may be null)
  sales_last_72h INTEGER NULL,            -- StockX provides this
  sales_last_7d INTEGER NULL,              -- Some providers may have this
  sales_last_30d INTEGER NULL,             -- StockX: sales30Days
  total_sales_volume INTEGER NULL,         -- Lifetime sales (StockX)

  ask_count INTEGER NULL,                  -- Number of active asks
  bid_count INTEGER NULL,                  -- Number of active bids

  -- ═══════════════════════════════════════════════════════════════
  -- PROVIDER-SPECIFIC FIELDS
  -- ═══════════════════════════════════════════════════════════════

  -- StockX-specific
  average_deadstock_price NUMERIC(12,4) NULL,  -- StockX average price
  volatility NUMERIC(8,4) NULL,                 -- StockX volatility (0.12 = 12%)
  price_premium NUMERIC(8,4) NULL,              -- StockX premium over retail (0.35 = 35%)

  -- Alias-specific
  global_indicator_price NUMERIC(12,4) NULL,    -- Alias competitive price guide

  -- Future eBay-specific
  ebay_sold_count_30d INTEGER NULL,             -- Number of sold listings
  ebay_avg_shipping NUMERIC(12,4) NULL,         -- Average shipping cost

  -- ═══════════════════════════════════════════════════════════════
  -- METADATA
  -- ═══════════════════════════════════════════════════════════════

  snapshot_at TIMESTAMPTZ NOT NULL,             -- When this snapshot was taken
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When we processed it

  -- Link to raw snapshot for debugging
  raw_snapshot_id UUID NULL,                    -- FK to stockx_raw_snapshots or alias_raw_snapshots
  raw_snapshot_provider TEXT NULL,              -- 'stockx' or 'alias' to know which table

  -- Raw API response excerpt (for debugging, optional)
  raw_response_excerpt JSONB NULL,              -- Subset of fields for quick reference

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════

-- Unique constraint using index (allows expressions like COALESCE)
-- One snapshot per provider/product/size/region/currency
-- Note: Removed DATE_TRUNC because it's not immutable
CREATE UNIQUE INDEX idx_master_market_unique_snapshot ON public.master_market_data (
  provider,
  provider_source,
  COALESCE(provider_product_id, '__null__'),
  COALESCE(provider_variant_id, '__null__'),
  size_key,
  currency_code,
  COALESCE(region_code, 'global'),
  snapshot_at
);

-- Primary lookup: Get latest prices for a specific item/size
CREATE INDEX idx_master_market_latest_lookup ON public.master_market_data (
  sku,
  size_key,
  provider,
  currency_code,
  snapshot_at DESC
) WHERE sku IS NOT NULL;

-- Provider-specific lookups
CREATE INDEX idx_master_market_provider_product ON public.master_market_data (
  provider,
  provider_product_id,
  size_key,
  snapshot_at DESC
) WHERE provider_product_id IS NOT NULL;

-- Variant-specific lookups (StockX)
CREATE INDEX idx_master_market_provider_variant ON public.master_market_data (
  provider,
  provider_variant_id,
  snapshot_at DESC
) WHERE provider_variant_id IS NOT NULL;

-- Time-series queries
CREATE INDEX idx_master_market_snapshot_at ON public.master_market_data (
  snapshot_at DESC
);

-- Currency filtering
CREATE INDEX idx_master_market_currency ON public.master_market_data (
  currency_code,
  snapshot_at DESC
);

-- Region filtering (partial index for performance)
CREATE INDEX idx_master_market_region ON public.master_market_data (
  region_code,
  snapshot_at DESC
) WHERE region_code IS NOT NULL;

-- Fresh data only (for current market view)
-- Note: Removed NOW() from WHERE clause because it's not immutable
CREATE INDEX idx_master_market_fresh ON public.master_market_data (
  sku,
  size_key,
  provider,
  currency_code,
  snapshot_at DESC
) WHERE sku IS NOT NULL;

-- Provider + source combination
CREATE INDEX idx_master_market_provider_source ON public.master_market_data (
  provider,
  provider_source,
  snapshot_at DESC
);

-- Raw snapshot lookup
CREATE INDEX idx_master_market_raw_snapshot ON public.master_market_data (
  raw_snapshot_id,
  raw_snapshot_provider
) WHERE raw_snapshot_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MATERIALIZED VIEW: Latest Prices
-- ═══════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS public.master_market_latest AS
SELECT DISTINCT ON (
  provider,
  COALESCE(provider_product_id, '__null__'),
  COALESCE(provider_variant_id, '__null__'),
  size_key,
  currency_code,
  COALESCE(region_code, 'global')
)
  id,
  provider,
  provider_source,
  provider_product_id,
  provider_variant_id,
  sku,
  size_key,
  size_numeric,
  size_system,
  currency_code,
  base_currency_code,
  fx_rate,
  region_code,
  lowest_ask,
  highest_bid,
  last_sale_price,
  lowest_ask_base,
  highest_bid_base,
  last_sale_price_base,
  spread_absolute,
  spread_percentage,
  sales_last_72h,
  sales_last_7d,
  sales_last_30d,
  total_sales_volume,
  ask_count,
  bid_count,
  average_deadstock_price,
  volatility,
  price_premium,
  global_indicator_price,
  ebay_sold_count_30d,
  ebay_avg_shipping,
  snapshot_at,
  raw_snapshot_id,
  raw_snapshot_provider,
  ingested_at
FROM public.master_market_data
WHERE snapshot_at > NOW() - INTERVAL '7 days'  -- Only keep recent data in MV
ORDER BY
  provider,
  COALESCE(provider_product_id, '__null__'),
  COALESCE(provider_variant_id, '__null__'),
  size_key,
  currency_code,
  COALESCE(region_code, 'global'),
  snapshot_at DESC;

-- Unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_master_market_latest_unique ON public.master_market_latest (
  provider,
  COALESCE(provider_product_id, '__null__'),
  COALESCE(provider_variant_id, '__null__'),
  size_key,
  currency_code,
  COALESCE(region_code, 'global')
);

-- Additional indexes on materialized view
CREATE INDEX idx_master_market_latest_sku ON public.master_market_latest (
  sku,
  size_key,
  provider
) WHERE sku IS NOT NULL;

CREATE INDEX idx_master_market_latest_snapshot ON public.master_market_latest (
  snapshot_at DESC
);

COMMENT ON MATERIALIZED VIEW public.master_market_latest IS 'Latest market data snapshot per provider/product/size/currency/region - refresh every 5-10 minutes';

-- ═══════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_master_market_latest()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.master_market_latest;
  RAISE NOTICE 'Refreshed master_market_latest materialized view';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_master_market_latest IS 'Refresh the master_market_latest materialized view - call every 5-10 minutes';

-- Function to get latest price for a product across all providers
CREATE OR REPLACE FUNCTION get_latest_prices_for_product(
  p_sku TEXT,
  p_size_key TEXT,
  p_currency_code TEXT DEFAULT 'USD'
)
RETURNS TABLE (
  provider TEXT,
  lowest_ask NUMERIC,
  highest_bid NUMERIC,
  last_sale_price NUMERIC,
  spread_percentage NUMERIC,
  sales_last_72h INTEGER,
  snapshot_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mml.provider,
    mml.lowest_ask,
    mml.highest_bid,
    mml.last_sale_price,
    mml.spread_percentage,
    mml.sales_last_72h,
    mml.snapshot_at
  FROM public.master_market_latest mml
  WHERE mml.sku = p_sku
    AND mml.size_key = p_size_key
    AND mml.currency_code = p_currency_code
  ORDER BY mml.snapshot_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_latest_prices_for_product IS 'Get latest prices for a SKU + size across all providers';

-- Function to calculate composite price (placeholder for future Archvd Price algorithm)
CREATE OR REPLACE FUNCTION calculate_composite_price(
  p_sku TEXT,
  p_size_key TEXT,
  p_currency_code TEXT DEFAULT 'USD'
)
RETURNS NUMERIC AS $$
DECLARE
  v_composite_price NUMERIC;
BEGIN
  -- Placeholder: Simple average of lowest asks across providers
  -- TODO: Implement volume-weighted, recency-adjusted algorithm later
  SELECT AVG(lowest_ask)
  INTO v_composite_price
  FROM public.master_market_latest
  WHERE sku = p_sku
    AND size_key = p_size_key
    AND currency_code = p_currency_code
    AND lowest_ask IS NOT NULL
    AND snapshot_at > NOW() - INTERVAL '1 hour';

  RETURN v_composite_price;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_composite_price IS 'Calculate Archvd composite price (placeholder - simple average for now)';

-- ═══════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.master_market_data ENABLE ROW LEVEL SECURITY;

-- Public read (market data is public)
CREATE POLICY "Anyone can view market data"
  ON public.master_market_data FOR SELECT
  TO authenticated, anon
  USING (true);

-- Service role can write
CREATE POLICY "Service role can manage market data"
  ON public.master_market_data FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE public.master_market_data IS
  'Unified market pricing data from all providers (StockX, Alias, eBay). Time-series snapshots in major currency units.';

COMMENT ON COLUMN public.master_market_data.provider IS
  'Data provider: stockx | alias | ebay | manual';

COMMENT ON COLUMN public.master_market_data.provider_source IS
  'Specific API endpoint source: stockx_market_data, alias_availabilities, alias_recent_sales, etc.';

COMMENT ON COLUMN public.master_market_data.sku IS
  'Normalized SKU/style code (e.g., DD1391-100)';

COMMENT ON COLUMN public.master_market_data.size_key IS
  'Size display string (e.g., "10.5", "UK 9")';

COMMENT ON COLUMN public.master_market_data.size_numeric IS
  'Size as numeric for sorting/matching (e.g., 10.5)';

COMMENT ON COLUMN public.master_market_data.currency_code IS
  'Original currency from API response (USD, GBP, EUR)';

COMMENT ON COLUMN public.master_market_data.base_currency_code IS
  'User base currency for normalized comparison';

COMMENT ON COLUMN public.master_market_data.lowest_ask IS
  'Lowest asking price in original currency (MAJOR UNITS, not cents!)';

COMMENT ON COLUMN public.master_market_data.lowest_ask_base IS
  'Lowest ask converted to base currency using fx_rate';

COMMENT ON COLUMN public.master_market_data.region_code IS
  'Geographic region for price (us, uk, eu, global) or null';

COMMENT ON COLUMN public.master_market_data.snapshot_at IS
  'When this pricing snapshot was captured from provider API';

COMMENT ON COLUMN public.master_market_data.raw_snapshot_id IS
  'Link to raw snapshot in stockx_raw_snapshots or alias_raw_snapshots for debugging';

-- ═══════════════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════════════

GRANT SELECT ON public.master_market_data TO authenticated, anon;
GRANT ALL ON public.master_market_data TO service_role;

GRANT SELECT ON public.master_market_latest TO authenticated, anon;

-- ============================================================================
-- Done!
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Master market data table created successfully';
  RAISE NOTICE '📦 Table: master_market_data';
  RAISE NOTICE '📊 Materialized view: master_market_latest';
  RAISE NOTICE '⚡ Helper functions: refresh_master_market_latest(), get_latest_prices_for_product(), calculate_composite_price()';
  RAISE NOTICE '🔒 RLS enabled (public read, service role write)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 All prices stored in MAJOR UNITS (not cents!)';
  RAISE NOTICE '📈 Supports multi-provider, multi-currency, multi-region pricing';
  RAISE NOTICE '🔄 Remember to call refresh_master_market_latest() every 5-10 minutes';
END $$;
