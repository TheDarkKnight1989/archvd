-- ============================================================================
-- Add Support for StockX Flex + Alias Consigned Pricing
-- Date: 2025-12-03
-- ============================================================================

-- Add columns to master_market_data table
ALTER TABLE public.master_market_data
  ADD COLUMN IF NOT EXISTS is_flex BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_consigned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flex_eligible BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS consignment_fee_pct NUMERIC(5,2) NULL;

-- Add indexes for filtering by flex/consigned
CREATE INDEX IF NOT EXISTS idx_master_market_is_flex
  ON public.master_market_data(is_flex)
  WHERE is_flex = TRUE;

CREATE INDEX IF NOT EXISTS idx_master_market_is_consigned
  ON public.master_market_data(is_consigned)
  WHERE is_consigned = TRUE;

-- Update unique index to include is_flex and is_consigned
-- (allows same product/size to have multiple rows: standard, flex, consigned)
-- Note: Using UNIQUE INDEX instead of CONSTRAINT to allow expressions
DROP INDEX IF EXISTS public.idx_master_market_unique_snapshot CASCADE;

CREATE UNIQUE INDEX idx_master_market_unique_snapshot ON public.master_market_data (
  provider,
  provider_source,
  COALESCE(provider_product_id, '__null__'),
  COALESCE(provider_variant_id, '__null__'),
  size_key,
  currency_code,
  COALESCE(region_code, 'global'),
  COALESCE(is_flex, FALSE),
  COALESCE(is_consigned, FALSE),
  snapshot_at
);

-- Update materialized view to include flex/consigned
DROP MATERIALIZED VIEW IF EXISTS public.master_market_latest;

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
  raw_response_excerpt,
  ingested_at,
  created_at
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

-- Recreate unique index for materialized view
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

-- Update helper function to support flex/consigned filtering
DROP FUNCTION IF EXISTS get_latest_prices_for_product(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_latest_prices_for_product(TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION get_latest_prices_for_product(
  p_sku TEXT,
  p_size_key TEXT,
  p_currency_code TEXT DEFAULT 'USD',
  p_include_flex BOOLEAN DEFAULT TRUE,
  p_include_consigned BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  provider TEXT,
  is_flex BOOLEAN,
  is_consigned BOOLEAN,
  lowest_ask NUMERIC,
  highest_bid NUMERIC,
  last_sale_price NUMERIC,
  spread_percentage NUMERIC,
  sales_last_72h INTEGER,
  snapshot_at TIMESTAMPTZ,
  data_freshness TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mml.provider,
    mml.is_flex,
    mml.is_consigned,
    mml.lowest_ask,
    mml.highest_bid,
    mml.last_sale_price,
    mml.spread_percentage,
    mml.sales_last_72h,
    mml.snapshot_at,
    mml.data_freshness
  FROM public.master_market_latest mml
  WHERE mml.sku = p_sku
    AND mml.size_key = p_size_key
    AND mml.currency_code = p_currency_code
    AND (p_include_flex = TRUE OR mml.is_flex = FALSE)
    AND (p_include_consigned = TRUE OR mml.is_consigned = FALSE)
  ORDER BY mml.snapshot_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comments
COMMENT ON COLUMN public.master_market_data.is_flex IS
  'StockX Flex program pricing (lower fees for high-volume sellers)';

COMMENT ON COLUMN public.master_market_data.is_consigned IS
  'Alias consignment pricing (items sold through consignment)';

COMMENT ON COLUMN public.master_market_data.flex_eligible IS
  'Whether this product is eligible for StockX Flex program';

COMMENT ON COLUMN public.master_market_data.consignment_fee_pct IS
  'Consignment fee percentage (if applicable)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Added flex + consigned support to master_market_data';
  RAISE NOTICE '📊 Updated materialized view to track flex/consigned separately';
  RAISE NOTICE '🔍 Updated helper functions to filter by flex/consigned';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ Now supports:';
  RAISE NOTICE '   - StockX Flex pricing (is_flex = true)';
  RAISE NOTICE '   - Alias consigned pricing (is_consigned = true)';
  RAISE NOTICE '   - Standard pricing (both false)';
END $$;
