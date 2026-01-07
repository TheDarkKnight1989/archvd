-- ============================================================================
-- Alias Detailed Sales History
-- Date: 2025-12-05
-- Purpose: Store individual sale transactions for time-series analysis
-- ============================================================================

-- ============================================================================
-- 1. CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alias_recent_sales_detail (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product identification
  catalog_id TEXT NOT NULL,
  sku TEXT,

  -- Sale details
  size_value NUMERIC NOT NULL,
  size_unit TEXT DEFAULT 'US',
  price_cents INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL,

  -- Sale metadata
  consigned BOOLEAN DEFAULT false,
  region_code TEXT DEFAULT 'global',
  currency_code TEXT DEFAULT 'USD',

  -- Audit trail
  snapshot_at TIMESTAMPTZ NOT NULL,
  raw_snapshot_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary query pattern: Get sales for a product + size
CREATE INDEX idx_alias_sales_detail_catalog_size
  ON public.alias_recent_sales_detail(catalog_id, size_value, purchased_at DESC);

-- Query by SKU
CREATE INDEX idx_alias_sales_detail_sku
  ON public.alias_recent_sales_detail(sku, size_value, purchased_at DESC)
  WHERE sku IS NOT NULL;

-- Time-based queries (for cleanup and analytics)
CREATE INDEX idx_alias_sales_detail_purchased_at
  ON public.alias_recent_sales_detail(purchased_at DESC);

-- Region-based queries
CREATE INDEX idx_alias_sales_detail_region
  ON public.alias_recent_sales_detail(catalog_id, region_code, purchased_at DESC);

-- Snapshot tracking
CREATE INDEX idx_alias_sales_detail_snapshot
  ON public.alias_recent_sales_detail(raw_snapshot_id)
  WHERE raw_snapshot_id IS NOT NULL;

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.alias_recent_sales_detail ENABLE ROW LEVEL SECURITY;

-- Public read access (sales data is public info)
CREATE POLICY "Public read access"
  ON public.alias_recent_sales_detail
  FOR SELECT
  TO public
  USING (true);

-- Service role full access
CREATE POLICY "Service role full access"
  ON public.alias_recent_sales_detail
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. CLEANUP FUNCTION (Auto-delete sales older than 30 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_sales_detail(
  p_days_to_keep INTEGER DEFAULT 30
)
RETURNS TABLE (
  deleted_count INTEGER
) AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.alias_recent_sales_detail
  WHERE purchased_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % old sales records (older than % days)', v_deleted_count, p_days_to_keep;

  RETURN QUERY SELECT v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_sales_detail IS 'Delete sales older than specified days (default 30)';

-- ============================================================================
-- 5. ANALYTICS HELPER FUNCTIONS
-- ============================================================================

-- Get sales velocity (sales per hour) for last 24 hours
CREATE OR REPLACE FUNCTION get_sales_velocity(
  p_catalog_id TEXT,
  p_size_value NUMERIC,
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  hour_bucket TIMESTAMPTZ,
  sale_count INTEGER,
  avg_price_cents NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc('hour', purchased_at) as hour_bucket,
    COUNT(*)::INTEGER as sale_count,
    ROUND(AVG(price_cents)) as avg_price_cents
  FROM public.alias_recent_sales_detail
  WHERE catalog_id = p_catalog_id
    AND size_value = p_size_value
    AND purchased_at > NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY date_trunc('hour', purchased_at)
  ORDER BY hour_bucket DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_sales_velocity IS 'Get hourly sales velocity for last N hours';

-- Get price trend (daily average prices)
CREATE OR REPLACE FUNCTION get_price_trend(
  p_catalog_id TEXT,
  p_size_value NUMERIC,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  day_bucket DATE,
  sale_count INTEGER,
  avg_price_cents NUMERIC,
  min_price_cents INTEGER,
  max_price_cents INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    purchased_at::DATE as day_bucket,
    COUNT(*)::INTEGER as sale_count,
    ROUND(AVG(price_cents)) as avg_price_cents,
    MIN(price_cents) as min_price_cents,
    MAX(price_cents) as max_price_cents
  FROM public.alias_recent_sales_detail
  WHERE catalog_id = p_catalog_id
    AND size_value = p_size_value
    AND purchased_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY purchased_at::DATE
  ORDER BY day_bucket DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_price_trend IS 'Get daily price trends for last N days';

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

GRANT SELECT ON public.alias_recent_sales_detail TO authenticated, anon;
GRANT ALL ON public.alias_recent_sales_detail TO service_role;

-- ============================================================================
-- 7. TABLE COMMENT
-- ============================================================================

COMMENT ON TABLE public.alias_recent_sales_detail IS 'Individual sale transactions from Alias API for time-series analysis. Auto-cleaned after 30 days.';

-- ============================================================================
-- Done!
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ alias_recent_sales_detail table created';
  RAISE NOTICE '📊 Indexes created for fast queries';
  RAISE NOTICE '🧹 Auto-cleanup function: cleanup_old_sales_detail(days)';
  RAISE NOTICE '📈 Analytics functions:';
  RAISE NOTICE '   - get_sales_velocity(catalog_id, size, hours)';
  RAISE NOTICE '   - get_price_trend(catalog_id, size, days)';
  RAISE NOTICE '';
  RAISE NOTICE 'Example queries:';
  RAISE NOTICE '  SELECT * FROM get_sales_velocity(''cat_123'', 10, 24);';
  RAISE NOTICE '  SELECT * FROM get_price_trend(''cat_123'', 10, 7);';
  RAISE NOTICE '  SELECT * FROM cleanup_old_sales_detail(30);';
END $$;
