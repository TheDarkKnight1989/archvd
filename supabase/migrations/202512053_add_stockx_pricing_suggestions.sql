-- ============================================================================
-- Add StockX Pricing Suggestion Columns
-- Date: 2025-12-05
-- Purpose: Store StockX's sellFaster, earnMore, and beatUS pricing suggestions
-- ============================================================================

-- Add pricing suggestion columns
ALTER TABLE public.master_market_data
  ADD COLUMN IF NOT EXISTS sell_faster_price NUMERIC(12,4) NULL,
  ADD COLUMN IF NOT EXISTS earn_more_price NUMERIC(12,4) NULL,
  ADD COLUMN IF NOT EXISTS beat_us_price NUMERIC(12,4) NULL;

-- Add indexes for pricing suggestion queries
CREATE INDEX IF NOT EXISTS idx_master_market_sell_faster
  ON public.master_market_data(sell_faster_price)
  WHERE sell_faster_price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_master_market_earn_more
  ON public.master_market_data(earn_more_price)
  WHERE earn_more_price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_master_market_beat_us
  ON public.master_market_data(beat_us_price)
  WHERE beat_us_price IS NOT NULL;

-- Update materialized view to include pricing suggestions
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

-- Add comments
COMMENT ON COLUMN public.master_market_data.sell_faster_price IS
  'StockX suggested price to sell quickly (usually slightly below lowest ask)';

COMMENT ON COLUMN public.master_market_data.earn_more_price IS
  'StockX suggested price to maximize profit (usually at or above lowest ask)';

COMMENT ON COLUMN public.master_market_data.beat_us_price IS
  'StockX suggested price to beat US market (cross-region pricing comparison)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Added StockX pricing suggestion columns to master_market_data';
  RAISE NOTICE '📊 Updated materialized view to include pricing suggestions';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ New columns:';
  RAISE NOTICE '   - sell_faster_price: Quick sale pricing suggestion';
  RAISE NOTICE '   - earn_more_price: Maximize profit pricing suggestion';
  RAISE NOTICE '   - beat_us_price: Cross-region pricing comparison';
END $$;
