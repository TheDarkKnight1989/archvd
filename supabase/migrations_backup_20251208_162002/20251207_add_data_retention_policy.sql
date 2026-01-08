-- Data Retention Policy - Tiered Downsampling
-- Keeps recent data granular, downsamples old data to save storage

-- Create downsampled tables for older data
CREATE TABLE IF NOT EXISTS master_market_data_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,
  size_key TEXT NOT NULL,
  size_numeric NUMERIC(4,1),
  provider TEXT NOT NULL CHECK (provider IN ('alias', 'stockx', 'ebay')),
  provider_source TEXT NOT NULL,
  region_code TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  date DATE NOT NULL,

  -- Aggregated price metrics
  avg_lowest_ask NUMERIC(10,2),
  min_lowest_ask NUMERIC(10,2),
  max_lowest_ask NUMERIC(10,2),

  avg_highest_bid NUMERIC(10,2),
  min_highest_bid NUMERIC(10,2),
  max_highest_bid NUMERIC(10,2),

  avg_last_sale NUMERIC(10,2),
  min_last_sale NUMERIC(10,2),
  max_last_sale NUMERIC(10,2),

  -- Volume metrics
  avg_ask_count INTEGER,
  avg_bid_count INTEGER,
  avg_sales_72h INTEGER,

  -- Metadata
  sample_count INTEGER NOT NULL, -- How many hourly snapshots this represents
  is_flex BOOLEAN DEFAULT false,
  is_consigned BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(sku, size_key, provider, provider_source, region_code, is_flex, is_consigned, date)
);

CREATE TABLE IF NOT EXISTS master_market_data_weekly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,
  size_key TEXT NOT NULL,
  size_numeric NUMERIC(4,1),
  provider TEXT NOT NULL CHECK (provider IN ('alias', 'stockx', 'ebay')),
  provider_source TEXT NOT NULL,
  region_code TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  week DATE NOT NULL, -- Start of week (Monday)

  -- Aggregated price metrics
  avg_lowest_ask NUMERIC(10,2),
  min_lowest_ask NUMERIC(10,2),
  max_lowest_ask NUMERIC(10,2),

  avg_highest_bid NUMERIC(10,2),
  min_highest_bid NUMERIC(10,2),
  max_highest_bid NUMERIC(10,2),

  avg_last_sale NUMERIC(10,2),
  min_last_sale NUMERIC(10,2),
  max_last_sale NUMERIC(10,2),

  -- Volume metrics
  avg_ask_count INTEGER,
  avg_bid_count INTEGER,
  avg_sales_72h INTEGER,

  -- Metadata
  sample_count INTEGER NOT NULL,
  is_flex BOOLEAN DEFAULT false,
  is_consigned BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(sku, size_key, provider, provider_source, region_code, is_flex, is_consigned, week)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_daily_sku_date ON master_market_data_daily(sku, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_provider_date ON master_market_data_daily(provider, date DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_sku_week ON master_market_data_weekly(sku, week DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_provider_week ON master_market_data_weekly(provider, week DESC);

-- Function to downsample hourly to daily
CREATE OR REPLACE FUNCTION downsample_to_daily(cutoff_date DATE)
RETURNS INTEGER AS $$
DECLARE
  rows_inserted INTEGER;
BEGIN
  -- Insert aggregated daily data
  INSERT INTO master_market_data_daily (
    sku, size_key, size_numeric, provider, provider_source, region_code, currency_code, date,
    avg_lowest_ask, min_lowest_ask, max_lowest_ask,
    avg_highest_bid, min_highest_bid, max_highest_bid,
    avg_last_sale, min_last_sale, max_last_sale,
    avg_ask_count, avg_bid_count, avg_sales_72h,
    sample_count, is_flex, is_consigned
  )
  SELECT
    sku, size_key, size_numeric, provider, provider_source, region_code, currency_code,
    DATE(snapshot_at) as date,
    AVG(lowest_ask) as avg_lowest_ask,
    MIN(lowest_ask) as min_lowest_ask,
    MAX(lowest_ask) as max_lowest_ask,
    AVG(highest_bid) as avg_highest_bid,
    MIN(highest_bid) as min_highest_bid,
    MAX(highest_bid) as max_highest_bid,
    AVG(last_sale_price) as avg_last_sale,
    MIN(last_sale_price) as min_last_sale,
    MAX(last_sale_price) as max_last_sale,
    AVG(ask_count::INTEGER) as avg_ask_count,
    AVG(bid_count::INTEGER) as avg_bid_count,
    AVG(sales_last_72h::INTEGER) as avg_sales_72h,
    COUNT(*) as sample_count,
    is_flex,
    is_consigned
  FROM master_market_data
  WHERE DATE(snapshot_at) < cutoff_date
  GROUP BY
    sku, size_key, size_numeric, provider, provider_source, region_code, currency_code,
    DATE(snapshot_at), is_flex, is_consigned
  ON CONFLICT (sku, size_key, provider, provider_source, region_code, is_flex, is_consigned, date)
  DO NOTHING;

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;

  -- Delete hourly data that was aggregated
  DELETE FROM master_market_data
  WHERE DATE(snapshot_at) < cutoff_date;

  RETURN rows_inserted;
END;
$$ LANGUAGE plpgsql;

-- Function to downsample daily to weekly
CREATE OR REPLACE FUNCTION downsample_to_weekly(cutoff_date DATE)
RETURNS INTEGER AS $$
DECLARE
  rows_inserted INTEGER;
BEGIN
  INSERT INTO master_market_data_weekly (
    sku, size_key, size_numeric, provider, provider_source, region_code, currency_code, week,
    avg_lowest_ask, min_lowest_ask, max_lowest_ask,
    avg_highest_bid, min_highest_bid, max_highest_bid,
    avg_last_sale, min_last_sale, max_last_sale,
    avg_ask_count, avg_bid_count, avg_sales_72h,
    sample_count, is_flex, is_consigned
  )
  SELECT
    sku, size_key, size_numeric, provider, provider_source, region_code, currency_code,
    DATE_TRUNC('week', date)::DATE as week,
    AVG(avg_lowest_ask),
    MIN(min_lowest_ask),
    MAX(max_lowest_ask),
    AVG(avg_highest_bid),
    MIN(min_highest_bid),
    MAX(max_highest_bid),
    AVG(avg_last_sale),
    MIN(min_last_sale),
    MAX(max_last_sale),
    AVG(avg_ask_count),
    AVG(avg_bid_count),
    AVG(avg_sales_72h),
    SUM(sample_count) as sample_count,
    is_flex,
    is_consigned
  FROM master_market_data_daily
  WHERE date < cutoff_date
  GROUP BY
    sku, size_key, size_numeric, provider, provider_source, region_code, currency_code,
    DATE_TRUNC('week', date), is_flex, is_consigned
  ON CONFLICT (sku, size_key, provider, provider_source, region_code, is_flex, is_consigned, week)
  DO NOTHING;

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;

  DELETE FROM master_market_data_daily
  WHERE date < cutoff_date;

  RETURN rows_inserted;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE master_market_data_daily IS
'Downsampled daily aggregates. Replaces hourly data older than 3 months.';

COMMENT ON TABLE master_market_data_weekly IS
'Downsampled weekly aggregates. Replaces daily data older than 1 year.';

COMMENT ON FUNCTION downsample_to_daily IS
'Aggregates hourly snapshots to daily averages and deletes raw data.
Call monthly to downsample data older than 3 months.';

COMMENT ON FUNCTION downsample_to_weekly IS
'Aggregates daily snapshots to weekly averages and deletes daily data.
Call monthly to downsample data older than 1 year.';
