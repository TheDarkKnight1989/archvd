-- ============================================================================
-- RETENTION ARCHITECTURE: Alias Sales History
-- Raw (90 days by recorded_at) → Daily → Monthly (by purchased_at)
-- ============================================================================
-- DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL
-- ============================================================================

-- ============================================================================
-- 1. DAILY AGGREGATES TABLE (13 months retention)
-- Aggregates by purchased_at (sale date), pruned by created_at
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_alias_sales_daily (
  id BIGSERIAL PRIMARY KEY,

  -- Natural key (aggregation dimensions)
  alias_catalog_id TEXT NOT NULL REFERENCES inventory_v4_alias_products(alias_catalog_id) ON DELETE CASCADE,
  size_value NUMERIC(6,2) NOT NULL,
  sale_date DATE NOT NULL,  -- DATE(purchased_at) - when sale happened

  -- Aggregates
  sale_count INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  avg_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_price NUMERIC(12,2),
  max_price NUMERIC(12,2),

  -- Consignment breakdown
  consigned_count INTEGER NOT NULL DEFAULT 0,
  non_consigned_count INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- UNIQUE constraint for UPSERT
  CONSTRAINT unique_alias_sales_daily UNIQUE (alias_catalog_id, size_value, sale_date)
);

-- Indexes for queries
CREATE INDEX IF NOT EXISTS idx_alias_sales_daily_catalog
  ON inventory_v4_alias_sales_daily(alias_catalog_id);
CREATE INDEX IF NOT EXISTS idx_alias_sales_daily_date
  ON inventory_v4_alias_sales_daily(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_alias_sales_daily_catalog_date
  ON inventory_v4_alias_sales_daily(alias_catalog_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_alias_sales_daily_created
  ON inventory_v4_alias_sales_daily(created_at);

-- ============================================================================
-- 2. MONTHLY AGGREGATES TABLE (forever retention)
-- Aggregates by purchased_at month
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_alias_sales_monthly (
  id BIGSERIAL PRIMARY KEY,

  -- Natural key (aggregation dimensions)
  alias_catalog_id TEXT NOT NULL REFERENCES inventory_v4_alias_products(alias_catalog_id) ON DELETE CASCADE,
  size_value NUMERIC(6,2) NOT NULL,
  sale_month DATE NOT NULL,  -- First day of month (e.g., 2025-01-01)

  -- Aggregates
  sale_count INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  avg_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_price NUMERIC(12,2),
  max_price NUMERIC(12,2),

  -- Consignment breakdown
  consigned_count INTEGER NOT NULL DEFAULT 0,
  non_consigned_count INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- UNIQUE constraint for UPSERT
  CONSTRAINT unique_alias_sales_monthly UNIQUE (alias_catalog_id, size_value, sale_month)
);

-- Indexes for queries
CREATE INDEX IF NOT EXISTS idx_alias_sales_monthly_catalog
  ON inventory_v4_alias_sales_monthly(alias_catalog_id);
CREATE INDEX IF NOT EXISTS idx_alias_sales_monthly_month
  ON inventory_v4_alias_sales_monthly(sale_month DESC);
CREATE INDEX IF NOT EXISTS idx_alias_sales_monthly_catalog_month
  ON inventory_v4_alias_sales_monthly(alias_catalog_id, sale_month DESC);

-- ============================================================================
-- 3. RLS POLICIES (if needed)
-- ============================================================================

ALTER TABLE inventory_v4_alias_sales_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_v4_alias_sales_monthly ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access to daily" ON inventory_v4_alias_sales_daily
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to monthly" ON inventory_v4_alias_sales_monthly
  FOR ALL USING (true) WITH CHECK (true);

-- Allow authenticated users to read
CREATE POLICY "Authenticated read daily" ON inventory_v4_alias_sales_daily
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read monthly" ON inventory_v4_alias_sales_monthly
  FOR SELECT TO authenticated USING (true);
