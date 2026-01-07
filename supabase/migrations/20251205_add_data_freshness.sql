-- ============================================================================
-- Data Freshness Tracking
-- Date: 2025-12-05
-- Purpose: Add computed columns to track data age for staleness detection
-- ============================================================================

-- ============================================================================
-- 1. DATA AGE - Computed at Query Time
-- ============================================================================
-- Note: We compute data_age_minutes in the materialized view, not as a stored
-- column, because NOW() is not immutable and cannot be used in GENERATED columns

-- ============================================================================
-- 2. UPDATE MATERIALIZED VIEW TO INCLUDE DATA AGE
-- ============================================================================

-- Drop and recreate with data_age_minutes
DROP MATERIALIZED VIEW IF EXISTS public.master_market_latest CASCADE;

CREATE MATERIALIZED VIEW public.master_market_latest AS
SELECT DISTINCT ON (
  provider,
  COALESCE(provider_product_id, '__null__'),
  COALESCE(provider_variant_id, '__null__'),
  size_key,
  currency_code,
  COALESCE(region_code, 'global'),
  COALESCE(is_flex, FALSE),
  COALESCE(is_consigned, FALSE)
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
  is_flex,
  is_consigned,
  flex_eligible,
  consignment_fee_pct,
  lowest_ask,
  highest_bid,
  last_sale_price,
  sell_faster_price,
  earn_more_price,
  beat_us_price,
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
  EXTRACT(EPOCH FROM (NOW() - snapshot_at))::INTEGER / 60 as data_age_minutes,  -- Computed at query time
  raw_snapshot_id,
  raw_snapshot_provider,
  raw_response_excerpt,
  ingested_at,
  created_at,
  -- Add freshness indicator as text
  CASE
    WHEN EXTRACT(EPOCH FROM (NOW() - snapshot_at)) / 60 < 60 THEN 'fresh'
    WHEN EXTRACT(EPOCH FROM (NOW() - snapshot_at)) / 60 < 360 THEN 'aging'
    ELSE 'stale'
  END as data_freshness
FROM public.master_market_data
WHERE snapshot_at > NOW() - INTERVAL '7 days'
ORDER BY
  provider,
  COALESCE(provider_product_id, '__null__'),
  COALESCE(provider_variant_id, '__null__'),
  size_key,
  currency_code,
  COALESCE(region_code, 'global'),
  COALESCE(is_flex, FALSE),
  COALESCE(is_consigned, FALSE),
  snapshot_at DESC;

-- Recreate unique index
CREATE UNIQUE INDEX idx_master_market_latest_unique ON public.master_market_latest (
  provider,
  COALESCE(provider_product_id, '__null__'),
  COALESCE(provider_variant_id, '__null__'),
  size_key,
  currency_code,
  COALESCE(region_code, 'global'),
  COALESCE(is_flex, FALSE),
  COALESCE(is_consigned, FALSE)
);

-- Recreate other indexes
CREATE INDEX IF NOT EXISTS idx_master_market_latest_sku ON public.master_market_latest (
  sku,
  size_key,
  provider,
  is_flex,
  is_consigned
) WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_master_market_latest_snapshot ON public.master_market_latest (
  snapshot_at DESC
);

CREATE INDEX IF NOT EXISTS idx_master_market_latest_freshness ON public.master_market_latest (
  data_freshness
) WHERE data_freshness = 'stale';

COMMENT ON MATERIALIZED VIEW public.master_market_latest IS 'Latest market data with freshness indicators';

-- ============================================================================
-- 3. HELPER FUNCTIONS
-- ============================================================================

-- Function to get products with stale data
CREATE OR REPLACE FUNCTION get_stale_products(
  p_age_threshold_hours INTEGER DEFAULT 6
)
RETURNS TABLE (
  sku TEXT,
  currency_code TEXT,
  max_age_hours NUMERIC,
  snapshot_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mml.sku,
    mml.currency_code,
    ROUND(MAX(mml.data_age_minutes) / 60.0, 1) as max_age_hours,
    COUNT(*)::INTEGER as snapshot_count
  FROM public.master_market_latest mml
  WHERE mml.data_age_minutes > (p_age_threshold_hours * 60)
    AND mml.sku IS NOT NULL
  GROUP BY mml.sku, mml.currency_code
  ORDER BY max_age_hours DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_stale_products IS 'Get products with data older than threshold (default 6 hours)';

-- Function to get data quality metrics
CREATE OR REPLACE FUNCTION get_data_quality_metrics()
RETURNS TABLE (
  total_products INTEGER,
  fresh_count INTEGER,
  aging_count INTEGER,
  stale_count INTEGER,
  fresh_percentage NUMERIC,
  avg_age_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT sku)::INTEGER as total_products,
    COUNT(*) FILTER (WHERE data_freshness = 'fresh')::INTEGER as fresh_count,
    COUNT(*) FILTER (WHERE data_freshness = 'aging')::INTEGER as aging_count,
    COUNT(*) FILTER (WHERE data_freshness = 'stale')::INTEGER as stale_count,
    ROUND(
      COUNT(*) FILTER (WHERE data_freshness = 'fresh')::NUMERIC * 100.0 / NULLIF(COUNT(*), 0),
      1
    ) as fresh_percentage,
    ROUND(AVG(data_age_minutes) / 60.0, 1) as avg_age_hours
  FROM public.master_market_latest;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_data_quality_metrics IS 'Get overall data quality metrics';

-- ============================================================================
-- 4. GRANTS
-- ============================================================================

GRANT SELECT ON public.master_market_latest TO authenticated, anon;

-- ============================================================================
-- Done!
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Data freshness tracking added';
  RAISE NOTICE '📊 Materialized view now includes: data_age_minutes (computed from snapshot_at)';
  RAISE NOTICE '🚦 Materialized view now includes: data_freshness (fresh/aging/stale)';
  RAISE NOTICE '🔍 Helper function: get_stale_products(hours)';
  RAISE NOTICE '📈 Helper function: get_data_quality_metrics()';
  RAISE NOTICE '';
  RAISE NOTICE 'Example queries:';
  RAISE NOTICE '  SELECT * FROM get_stale_products(6);';
  RAISE NOTICE '  SELECT * FROM get_data_quality_metrics();';
  RAISE NOTICE '  SELECT sku, data_age_minutes, data_freshness FROM master_market_latest LIMIT 10;';
END $$;
