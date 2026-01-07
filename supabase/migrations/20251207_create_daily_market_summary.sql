-- Create daily market summary materialized view
-- This pre-computes daily aggregates for faster charting

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_market_summary AS
SELECT
  sku,
  size_key,
  size_numeric,
  provider,
  region_code,
  currency_code,
  is_flex,
  is_consigned,
  DATE(snapshot_at) as date,

  -- Price aggregates
  AVG(lowest_ask) as avg_lowest_ask,
  MIN(lowest_ask) as min_lowest_ask,
  MAX(lowest_ask) as max_lowest_ask,

  AVG(highest_bid) as avg_highest_bid,
  MIN(highest_bid) as min_highest_bid,
  MAX(highest_bid) as max_highest_bid,

  AVG(last_sale_price) as avg_last_sale,
  MIN(last_sale_price) as min_last_sale,
  MAX(last_sale_price) as max_last_sale,

  -- Volume aggregates
  AVG(ask_count) as avg_ask_count,
  AVG(bid_count) as avg_bid_count,
  AVG(sales_last_72h) as avg_sales_72h,

  -- Metadata
  COUNT(*) as sample_count,
  MIN(snapshot_at) as first_snapshot_at,
  MAX(snapshot_at) as last_snapshot_at

FROM master_market_data
GROUP BY
  sku,
  size_key,
  size_numeric,
  provider,
  region_code,
  currency_code,
  is_flex,
  is_consigned,
  DATE(snapshot_at);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_daily_market_summary_sku_date
ON daily_market_summary(sku, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_market_summary_provider_date
ON daily_market_summary(provider, date DESC);

-- Enable concurrent refresh (no table locks)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_market_summary_unique
ON daily_market_summary(sku, size_key, provider, region_code, is_flex, is_consigned, date);

-- Comments
COMMENT ON MATERIALIZED VIEW daily_market_summary IS
'Pre-computed daily aggregates from master_market_data for fast charting.
Refreshed nightly via cron job.';
