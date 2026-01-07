-- ============================================================================
-- Raw Market Data Snapshots - Audit Trail Layer
-- Date: 2025-12-03
-- Purpose: Store complete API responses for reprocessing and debugging
-- ============================================================================

-- ============================================================================
-- 1. STOCKX RAW SNAPSHOTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stockx_raw_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider context
  provider TEXT NOT NULL DEFAULT 'stockx',
  endpoint TEXT NOT NULL,  -- 'catalog_search', 'product', 'variants', 'market_data', 'variant_gtin'

  -- Request identifiers (for deduplication and lookup)
  product_id TEXT NULL,              -- StockX productId when known
  variant_id TEXT NULL,              -- stockx_variant_id when known
  style_id TEXT NULL,                -- StockX SKU (e.g., "DD1391-100")
  gtin TEXT NULL,                    -- When coming from GTIN endpoint

  -- Request parameters
  region_code TEXT NULL,             -- e.g., 'GB', 'US', 'EU'
  currency_code TEXT NULL,           -- e.g., 'GBP', 'USD', 'EUR'
  query_string TEXT NULL,            -- Search query if applicable

  -- Response data
  http_status INT NOT NULL,          -- HTTP status code (200, 404, 429, etc.)
  raw_payload JSONB NOT NULL,        -- Complete API response
  error_message TEXT NULL,           -- Error message if request failed

  -- Timestamps
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  request_duration_ms INT NULL,      -- How long the request took
  user_agent TEXT NULL               -- User agent if relevant
);

-- Deduplication index
-- Prevents exact duplicate requests (same params + timestamp)
CREATE UNIQUE INDEX idx_stockx_raw_snapshots_unique ON public.stockx_raw_snapshots (
  endpoint,
  COALESCE(product_id, ''),
  COALESCE(variant_id, ''),
  COALESCE(style_id, ''),
  COALESCE(gtin, ''),
  COALESCE(currency_code, 'USD'),
  requested_at
);

-- Indexes for efficient querying
CREATE INDEX idx_stockx_raw_snapshots_endpoint ON public.stockx_raw_snapshots(endpoint, requested_at DESC);
CREATE INDEX idx_stockx_raw_snapshots_product_id ON public.stockx_raw_snapshots(product_id, requested_at DESC) WHERE product_id IS NOT NULL;
CREATE INDEX idx_stockx_raw_snapshots_style_id ON public.stockx_raw_snapshots(style_id, requested_at DESC) WHERE style_id IS NOT NULL;
CREATE INDEX idx_stockx_raw_snapshots_gtin ON public.stockx_raw_snapshots(gtin, requested_at DESC) WHERE gtin IS NOT NULL;
CREATE INDEX idx_stockx_raw_snapshots_requested_at ON public.stockx_raw_snapshots(requested_at DESC);
CREATE INDEX idx_stockx_raw_snapshots_http_status ON public.stockx_raw_snapshots(http_status) WHERE http_status != 200;

-- Index for JSON queries on payload
CREATE INDEX idx_stockx_raw_snapshots_payload_gin ON public.stockx_raw_snapshots USING GIN(raw_payload jsonb_path_ops);

COMMENT ON TABLE public.stockx_raw_snapshots IS 'Complete StockX API responses for audit trail and reprocessing';
COMMENT ON COLUMN public.stockx_raw_snapshots.endpoint IS 'Which StockX endpoint was called';
COMMENT ON COLUMN public.stockx_raw_snapshots.raw_payload IS 'Complete JSON response from StockX API';
COMMENT ON COLUMN public.stockx_raw_snapshots.requested_at IS 'When the API request was made';

-- ============================================================================
-- 2. ALIAS RAW SNAPSHOTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alias_raw_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider context
  provider TEXT NOT NULL DEFAULT 'alias',
  endpoint TEXT NOT NULL,  -- 'catalog_search', 'catalog_item', 'pricing_availabilities', 'pricing_availability', 'recent_sales', 'offer_histogram'

  -- Request identifiers
  catalog_id TEXT NULL,                -- Alias catalog ID (e.g., "air-jordan-1-retro-high-og-panda-dd1391-100")
  size_value NUMERIC NULL,             -- Size if querying single variant

  -- Request parameters
  region_id TEXT NULL,                 -- Alias region (1=US, 2=EU, 3=UK, or "us", "eu", "uk")
  currency_code TEXT NULL,             -- Currency code (usually USD for Alias)
  query_string TEXT NULL,              -- Search query if applicable
  product_condition TEXT NULL,         -- Condition enum if applicable
  packaging_condition TEXT NULL,       -- Packaging condition enum if applicable
  consigned BOOLEAN NULL,              -- Consignment filter if applicable

  -- Response data
  http_status INT NOT NULL,            -- HTTP status code
  raw_payload JSONB NOT NULL,          -- Complete API response
  error_message TEXT NULL,             -- Error message if failed

  -- Timestamps
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  request_duration_ms INT NULL,
  user_agent TEXT NULL
);

-- Deduplication index
-- Prevents exact duplicate requests (same params + timestamp)
CREATE UNIQUE INDEX idx_alias_raw_snapshots_unique ON public.alias_raw_snapshots (
  endpoint,
  COALESCE(catalog_id, ''),
  COALESCE(size_value::text, ''),
  COALESCE(region_id, 'global'),
  COALESCE(product_condition, ''),
  COALESCE(packaging_condition, ''),
  requested_at
);

-- Indexes for efficient querying
CREATE INDEX idx_alias_raw_snapshots_endpoint ON public.alias_raw_snapshots(endpoint, requested_at DESC);
CREATE INDEX idx_alias_raw_snapshots_catalog_id ON public.alias_raw_snapshots(catalog_id, requested_at DESC) WHERE catalog_id IS NOT NULL;
CREATE INDEX idx_alias_raw_snapshots_catalog_size ON public.alias_raw_snapshots(catalog_id, size_value, requested_at DESC) WHERE catalog_id IS NOT NULL AND size_value IS NOT NULL;
CREATE INDEX idx_alias_raw_snapshots_region ON public.alias_raw_snapshots(region_id, requested_at DESC) WHERE region_id IS NOT NULL;
CREATE INDEX idx_alias_raw_snapshots_requested_at ON public.alias_raw_snapshots(requested_at DESC);
CREATE INDEX idx_alias_raw_snapshots_http_status ON public.alias_raw_snapshots(http_status) WHERE http_status != 200;

-- Index for JSON queries on payload
CREATE INDEX idx_alias_raw_snapshots_payload_gin ON public.alias_raw_snapshots USING GIN(raw_payload jsonb_path_ops);

COMMENT ON TABLE public.alias_raw_snapshots IS 'Complete Alias API responses for audit trail and reprocessing';
COMMENT ON COLUMN public.alias_raw_snapshots.endpoint IS 'Which Alias endpoint was called';
COMMENT ON COLUMN public.alias_raw_snapshots.raw_payload IS 'Complete JSON response from Alias API';
COMMENT ON COLUMN public.alias_raw_snapshots.requested_at IS 'When the API request was made';

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

-- StockX raw snapshots (public read for debugging, service role write)
ALTER TABLE public.stockx_raw_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view StockX raw snapshots"
  ON public.stockx_raw_snapshots FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Service role can manage StockX raw snapshots"
  ON public.stockx_raw_snapshots FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Alias raw snapshots (public read for debugging, service role write)
ALTER TABLE public.alias_raw_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view Alias raw snapshots"
  ON public.alias_raw_snapshots FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Service role can manage Alias raw snapshots"
  ON public.alias_raw_snapshots FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function to get latest raw snapshot for a StockX product
CREATE OR REPLACE FUNCTION get_latest_stockx_snapshot(
  p_endpoint TEXT,
  p_product_id TEXT DEFAULT NULL,
  p_style_id TEXT DEFAULT NULL,
  p_currency_code TEXT DEFAULT 'USD'
)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT raw_payload
    FROM public.stockx_raw_snapshots
    WHERE endpoint = p_endpoint
      AND http_status = 200
      AND (p_product_id IS NULL OR product_id = p_product_id)
      AND (p_style_id IS NULL OR style_id = p_style_id)
      AND (currency_code = p_currency_code OR currency_code IS NULL)
    ORDER BY requested_at DESC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_latest_stockx_snapshot IS 'Get most recent successful raw snapshot for StockX product';

-- Function to get latest raw snapshot for an Alias catalog item
CREATE OR REPLACE FUNCTION get_latest_alias_snapshot(
  p_endpoint TEXT,
  p_catalog_id TEXT DEFAULT NULL,
  p_region_id TEXT DEFAULT 'global'
)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT raw_payload
    FROM public.alias_raw_snapshots
    WHERE endpoint = p_endpoint
      AND http_status = 200
      AND (p_catalog_id IS NULL OR catalog_id = p_catalog_id)
      AND (COALESCE(region_id, 'global') = p_region_id)
    ORDER BY requested_at DESC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_latest_alias_snapshot IS 'Get most recent successful raw snapshot for Alias catalog item';

-- ============================================================================
-- 5. DATA RETENTION POLICY (OPTIONAL - COMMENT FOR NOW)
-- ============================================================================

-- Uncomment when ready to implement archiving:
--
-- -- Keep raw snapshots for 90 days, then archive or delete
-- CREATE OR REPLACE FUNCTION archive_old_raw_snapshots()
-- RETURNS void AS $$
-- BEGIN
--   -- Archive StockX snapshots older than 90 days
--   DELETE FROM public.stockx_raw_snapshots
--   WHERE requested_at < NOW() - INTERVAL '90 days';
--
--   -- Archive Alias snapshots older than 90 days
--   DELETE FROM public.alias_raw_snapshots
--   WHERE requested_at < NOW() - INTERVAL '90 days';
--
--   RAISE NOTICE 'Archived raw snapshots older than 90 days';
-- END;
-- $$ LANGUAGE plpgsql;
--
-- -- Schedule via pg_cron (if available):
-- -- SELECT cron.schedule('archive-raw-snapshots', '0 0 * * 0', 'SELECT archive_old_raw_snapshots()');

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

GRANT SELECT ON public.stockx_raw_snapshots TO authenticated, anon;
GRANT ALL ON public.stockx_raw_snapshots TO service_role;

GRANT SELECT ON public.alias_raw_snapshots TO authenticated, anon;
GRANT ALL ON public.alias_raw_snapshots TO service_role;

-- ============================================================================
-- Done!
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Raw snapshot tables created successfully';
  RAISE NOTICE '📦 Tables: stockx_raw_snapshots, alias_raw_snapshots';
  RAISE NOTICE '🔍 Helper functions: get_latest_stockx_snapshot(), get_latest_alias_snapshot()';
  RAISE NOTICE '🔒 RLS enabled (public read, service role write)';
END $$;
