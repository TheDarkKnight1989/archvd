-- ============================================================================
-- RETENTION ROLLUP + PRUNE SQL
-- DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL
-- ============================================================================
-- Schedule:
--   Daily rollup:   00:30 UTC daily
--   Monthly rollup: 01:00 UTC on 2nd of month
--   Prune raw:      02:00 UTC daily (by recorded_at)
--   Prune daily:    02:00 UTC on 3rd of month (by created_at)
-- ============================================================================

-- ============================================================================
-- DAILY ROLLUP: Raw → Daily (UPSERT)
-- Aggregates by purchased_at (sale date)
-- Run daily at 00:30 UTC
-- ============================================================================

INSERT INTO inventory_v4_alias_sales_daily (
  alias_catalog_id,
  size_value,
  sale_date,
  sale_count,
  total_revenue,
  avg_price,
  min_price,
  max_price,
  consigned_count,
  non_consigned_count,
  updated_at
)
SELECT
  alias_catalog_id,
  size_value,
  DATE(purchased_at) AS sale_date,
  COUNT(*) AS sale_count,
  SUM(price) AS total_revenue,
  ROUND(AVG(price)::NUMERIC, 2) AS avg_price,
  MIN(price) AS min_price,
  MAX(price) AS max_price,
  COUNT(*) FILTER (WHERE consigned = true) AS consigned_count,
  COUNT(*) FILTER (WHERE consigned = false) AS non_consigned_count,
  NOW() AS updated_at
FROM inventory_v4_alias_sales_history
WHERE DATE(purchased_at) < CURRENT_DATE  -- Only complete days
GROUP BY alias_catalog_id, size_value, DATE(purchased_at)
ON CONFLICT (alias_catalog_id, size_value, sale_date)
DO UPDATE SET
  sale_count = EXCLUDED.sale_count,
  total_revenue = EXCLUDED.total_revenue,
  avg_price = EXCLUDED.avg_price,
  min_price = EXCLUDED.min_price,
  max_price = EXCLUDED.max_price,
  consigned_count = EXCLUDED.consigned_count,
  non_consigned_count = EXCLUDED.non_consigned_count,
  updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- MONTHLY ROLLUP: Daily → Monthly (UPSERT)
-- Aggregates completed months from daily table
-- Run monthly on 2nd at 01:00 UTC
-- ============================================================================

INSERT INTO inventory_v4_alias_sales_monthly (
  alias_catalog_id,
  size_value,
  sale_month,
  sale_count,
  total_revenue,
  avg_price,
  min_price,
  max_price,
  consigned_count,
  non_consigned_count,
  updated_at
)
SELECT
  alias_catalog_id,
  size_value,
  DATE_TRUNC('month', sale_date)::DATE AS sale_month,
  SUM(sale_count) AS sale_count,
  SUM(total_revenue) AS total_revenue,
  ROUND((SUM(total_revenue) / NULLIF(SUM(sale_count), 0))::NUMERIC, 2) AS avg_price,
  MIN(min_price) AS min_price,
  MAX(max_price) AS max_price,
  SUM(consigned_count) AS consigned_count,
  SUM(non_consigned_count) AS non_consigned_count,
  NOW() AS updated_at
FROM inventory_v4_alias_sales_daily
WHERE sale_date < DATE_TRUNC('month', CURRENT_DATE)  -- Only complete months
GROUP BY alias_catalog_id, size_value, DATE_TRUNC('month', sale_date)
ON CONFLICT (alias_catalog_id, size_value, sale_month)
DO UPDATE SET
  sale_count = EXCLUDED.sale_count,
  total_revenue = EXCLUDED.total_revenue,
  avg_price = EXCLUDED.avg_price,
  min_price = EXCLUDED.min_price,
  max_price = EXCLUDED.max_price,
  consigned_count = EXCLUDED.consigned_count,
  non_consigned_count = EXCLUDED.non_consigned_count,
  updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- PRUNE RAW SALES: Keep 90 days by recorded_at (ingestion time)
-- Run daily at 02:00 UTC
-- CRITICAL: Uses recorded_at, NOT purchased_at
-- ============================================================================

DELETE FROM inventory_v4_alias_sales_history
WHERE recorded_at < CURRENT_TIMESTAMP - INTERVAL '90 days';

-- ============================================================================
-- PRUNE DAILY AGGREGATES: Keep 13 months by created_at
-- Run monthly on 3rd at 02:00 UTC
-- ============================================================================

DELETE FROM inventory_v4_alias_sales_daily
WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '13 months';
