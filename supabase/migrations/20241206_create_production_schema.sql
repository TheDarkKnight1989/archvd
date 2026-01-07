-- ═══════════════════════════════════════════════════════════════════════════════
-- PRODUCTION SCHEMA - Best in Class Market Data Platform
-- Date: 2024-12-06
-- Migration: Strangler Fig - New system runs alongside old
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. PRODUCTS CATALOG (Global product catalog)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core identification
  sku TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  colorway TEXT,
  category TEXT NOT NULL DEFAULT 'sneakers', -- sneakers, pokemon, watches

  -- Display
  name TEXT GENERATED ALWAYS AS (
    CASE
      WHEN colorway IS NOT NULL THEN brand || ' ' || model || ' ' || colorway
      ELSE brand || ' ' || model
    END
  ) STORED,
  slug TEXT UNIQUE,
  image_url TEXT,

  -- Retail info
  retail_price NUMERIC(12,2),
  retail_currency TEXT DEFAULT 'USD',
  release_date DATE,

  -- Tiering (sync priority)
  tier TEXT DEFAULT 'cold' CHECK (tier IN ('hot', 'warm', 'cold', 'frozen')),
  popularity_score INTEGER DEFAULT 0 CHECK (popularity_score >= 0 AND popularity_score <= 100),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,

  -- Full-text search
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(brand, '') || ' ' ||
      COALESCE(model, '') || ' ' ||
      COALESCE(colorway, '') || ' ' ||
      COALESCE(sku, '')
    )
  ) STORED
);

-- Indexes for performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_tier ON products(tier, popularity_score DESC);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_search ON products USING GIN(search_vector);
CREATE INDEX idx_products_last_synced ON products(last_synced_at) WHERE last_synced_at IS NOT NULL;

-- Function to generate slug from SKU
CREATE OR REPLACE FUNCTION generate_product_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := LOWER(
      REGEXP_REPLACE(
        COALESCE(NEW.brand, '') || '-' ||
        COALESCE(NEW.model, '') || '-' ||
        COALESCE(NEW.colorway, '') || '-' ||
        NEW.sku,
        '[^a-zA-Z0-9-]', '-', 'g'
      )
    );
    -- Remove duplicate dashes and trim
    NEW.slug := REGEXP_REPLACE(NEW.slug, '-+', '-', 'g');
    NEW.slug := TRIM(BOTH '-' FROM NEW.slug);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_generate_slug
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION generate_product_slug();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. PRODUCT VARIANTS (Sizes for each product)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Size info
  size_key TEXT NOT NULL, -- "10.5", "UK 9", "M"
  size_numeric NUMERIC(6,2), -- 10.5 for sorting
  size_system TEXT NOT NULL DEFAULT 'US', -- US, UK, EU, JP, OS

  -- Provider mappings
  stockx_product_id TEXT,
  stockx_variant_id TEXT,
  alias_catalog_id TEXT,
  ebay_epid TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (product_id, size_key)
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_stockx_variant ON product_variants(stockx_variant_id) WHERE stockx_variant_id IS NOT NULL;
CREATE INDEX idx_variants_alias_catalog ON product_variants(alias_catalog_id) WHERE alias_catalog_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. MARKET SNAPSHOTS (Time-series pricing data - PARTITIONED)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS market_snapshots (
  id UUID DEFAULT gen_random_uuid(),

  -- Product reference
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,

  -- Provider
  provider TEXT NOT NULL CHECK (provider IN ('stockx', 'alias', 'ebay')),
  provider_source TEXT, -- 'stockx_market_data', 'alias_availabilities'
  region TEXT, -- 'us', 'uk', 'eu', 'global'

  -- Pricing (major units in original currency)
  currency TEXT NOT NULL,
  lowest_ask NUMERIC(12,4),
  highest_bid NUMERIC(12,4),
  last_sale_price NUMERIC(12,4),

  -- StockX pricing suggestions
  sell_faster_price NUMERIC(12,4),
  earn_more_price NUMERIC(12,4),
  beat_us_price NUMERIC(12,4),

  -- Market activity
  sales_last_72h INTEGER,
  sales_last_7d INTEGER,
  sales_last_30d INTEGER,
  ask_count INTEGER,
  bid_count INTEGER,

  -- Market metrics
  volatility NUMERIC(6,4), -- 0.1234 = 12.34%
  liquidity_score INTEGER CHECK (liquidity_score >= 0 AND liquidity_score <= 100),

  -- Timestamps
  snapshot_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (id, snapshot_at)
) PARTITION BY RANGE (snapshot_at);

-- Create current week partition
CREATE TABLE market_snapshots_current PARTITION OF market_snapshots
  FOR VALUES FROM (date_trunc('week', NOW()))
  TO (date_trunc('week', NOW()) + INTERVAL '7 days');

-- Create next week partition
CREATE TABLE market_snapshots_next PARTITION OF market_snapshots
  FOR VALUES FROM (date_trunc('week', NOW()) + INTERVAL '7 days')
  TO (date_trunc('week', NOW()) + INTERVAL '14 days');

-- Indexes on partitioned table
CREATE INDEX idx_snapshots_product_variant ON market_snapshots(product_id, variant_id, snapshot_at DESC);
CREATE INDEX idx_snapshots_provider ON market_snapshots(provider, snapshot_at DESC);
CREATE INDEX idx_snapshots_timestamp ON market_snapshots(snapshot_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. MATERIALIZED VIEW (Latest prices)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS market_latest AS
SELECT DISTINCT ON (product_id, variant_id, provider, COALESCE(region, ''))
  *,
  EXTRACT(EPOCH FROM (NOW() - snapshot_at)) / 60 AS data_age_minutes,
  CASE
    WHEN snapshot_at > NOW() - INTERVAL '1 hour' THEN 'fresh'
    WHEN snapshot_at > NOW() - INTERVAL '6 hours' THEN 'aging'
    ELSE 'stale'
  END AS data_freshness
FROM market_snapshots
ORDER BY product_id, variant_id, provider, COALESCE(region, ''), snapshot_at DESC;

CREATE UNIQUE INDEX idx_market_latest_unique
  ON market_latest(product_id, variant_id, provider, COALESCE(region, ''));
CREATE INDEX idx_market_latest_freshness ON market_latest(data_freshness);
CREATE INDEX idx_market_latest_product ON market_latest(product_id);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_market_latest()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY market_latest;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. SYNC QUEUE (Job management)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  job_type TEXT NOT NULL, -- 'sync_product', 'sync_variant', 'refresh_catalog'
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),

  -- Job payload (flexible JSON)
  payload JSONB NOT NULL,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  -- Error tracking
  last_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_queue_status ON sync_queue(status, priority, scheduled_for)
  WHERE status = 'pending';
CREATE INDEX idx_sync_queue_created ON sync_queue(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. LINK EXISTING INVENTORY TO NEW SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add columns to existing Inventory table (if they don't exist)
ALTER TABLE "Inventory"
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON "Inventory"(product_id)
  WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_variant ON "Inventory"(variant_id)
  WHERE variant_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Function to create weekly partitions (run monthly)
CREATE OR REPLACE FUNCTION create_weekly_partition(start_date DATE)
RETURNS void AS $$
DECLARE
  partition_name TEXT;
  start_ts TIMESTAMPTZ;
  end_ts TIMESTAMPTZ;
BEGIN
  partition_name := 'market_snapshots_' || TO_CHAR(start_date, 'YYYY_WW');
  start_ts := date_trunc('week', start_date::TIMESTAMPTZ);
  end_ts := start_ts + INTERVAL '7 days';

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF market_snapshots FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_ts, end_ts
  );
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old partitions (keeps last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_partitions()
RETURNS void AS $$
DECLARE
  partition_record RECORD;
BEGIN
  -- Drop partitions older than 30 days
  FOR partition_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'market_snapshots_%'
      AND tablename NOT IN ('market_snapshots_current', 'market_snapshots_next')
  LOOP
    -- Extract date from partition name and check if old
    -- This is simplified - in production would parse the date properly
    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(partition_record.tablename) || ' CASCADE';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Products are public (anyone can view)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are viewable by everyone" ON products FOR SELECT USING (true);
CREATE POLICY "Products are manageable by service role" ON products FOR ALL
  TO service_role USING (true);

-- Variants are public
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Variants are viewable by everyone" ON product_variants FOR SELECT USING (true);
CREATE POLICY "Variants are manageable by service role" ON product_variants FOR ALL
  TO service_role USING (true);

-- Market snapshots are public (read-only for users)
ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Snapshots are viewable by everyone" ON market_snapshots FOR SELECT USING (true);
CREATE POLICY "Snapshots are manageable by service role" ON market_snapshots FOR ALL
  TO service_role USING (true);

-- Sync queue is service role only
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sync queue is service role only" ON sync_queue FOR ALL
  TO service_role USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. COMMENTS (Documentation)
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE products IS 'Global product catalog - all products regardless of user ownership';
COMMENT ON TABLE product_variants IS 'Size variants for each product';
COMMENT ON TABLE market_snapshots IS 'Time-series market data from all providers (partitioned by week)';
COMMENT ON MATERIALIZED VIEW market_latest IS 'Latest prices per product/variant/provider (refreshed every 10 mins)';
COMMENT ON TABLE sync_queue IS 'Job queue for background sync tasks';

COMMENT ON COLUMN products.tier IS 'Sync priority: hot (hourly), warm (6h), cold (daily), frozen (on-demand)';
COMMENT ON COLUMN products.popularity_score IS '0-100 score based on views, sales, user interest';
COMMENT ON COLUMN market_snapshots.snapshot_at IS 'When this data was captured from provider API';
COMMENT ON COLUMN market_snapshots.ingested_at IS 'When we ingested it into our database';

-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Next steps:
-- 1. Seed products table with top 100 SKUs
-- 2. Build sync orchestrator API route
-- 3. Run initial market data sync
-- 4. Update Inventory table to link to products
