-- Migration: Create tcg_price_daily_medians view for proper 7-day price history
-- Author: Claude Code
-- Date: 2025-01-09

-- Create materialized view for daily median prices (refreshed hourly)
CREATE MATERIALIZED VIEW IF NOT EXISTS tcg_price_daily_medians AS
SELECT
  sku,
  DATE(as_of) as day,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY median_price::numeric) as median_price,
  currency,
  COUNT(*) as data_points
FROM tcg_latest_prices
WHERE as_of >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY sku, DATE(as_of), currency
ORDER BY sku, day DESC;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tcg_daily_medians_sku_day
ON tcg_price_daily_medians(sku, day DESC);

CREATE INDEX IF NOT EXISTS idx_tcg_daily_medians_day
ON tcg_price_daily_medians(day DESC);

-- Create function to refresh the view (call this hourly via cron/scheduler)
CREATE OR REPLACE FUNCTION refresh_tcg_daily_medians()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY tcg_price_daily_medians;
END;
$$;

-- Grant read access to authenticated users
GRANT SELECT ON tcg_price_daily_medians TO authenticated;
GRANT SELECT ON tcg_price_daily_medians TO anon;

COMMENT ON MATERIALIZED VIEW tcg_price_daily_medians IS
'Daily median prices for TCG products. Refreshed hourly. Used for 7-day sparkline charts.';
