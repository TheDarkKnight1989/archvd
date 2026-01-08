-- ============================================================================
-- TEST QUERIES: Monthly Aggregates for YTD + All-Time Views
-- ============================================================================
-- These queries demonstrate how monthly aggregates can power analytics
-- Run AFTER retention tables are created (not now)
-- ============================================================================

-- ============================================================================
-- 1. YTD (Year-To-Date) Sales Summary for a Product
-- ============================================================================

SELECT
  alias_catalog_id,
  SUM(sale_count) AS ytd_sales,
  SUM(total_revenue) AS ytd_revenue,
  ROUND(SUM(total_revenue) / NULLIF(SUM(sale_count), 0), 2) AS ytd_avg_price,
  MIN(min_price) AS ytd_low,
  MAX(max_price) AS ytd_high
FROM inventory_v4_alias_sales_monthly
WHERE alias_catalog_id = 'air-jordan-4-retro-og-fire-red-2020-dc7770-160'
  AND sale_month >= DATE_TRUNC('year', CURRENT_DATE)  -- 2025-01-01
GROUP BY alias_catalog_id;

-- ============================================================================
-- 2. All-Time Sales Summary for a Product
-- ============================================================================

SELECT
  alias_catalog_id,
  SUM(sale_count) AS all_time_sales,
  SUM(total_revenue) AS all_time_revenue,
  ROUND(SUM(total_revenue) / NULLIF(SUM(sale_count), 0), 2) AS all_time_avg_price,
  MIN(min_price) AS all_time_low,
  MAX(max_price) AS all_time_high,
  MIN(sale_month) AS first_sale_month,
  MAX(sale_month) AS last_sale_month
FROM inventory_v4_alias_sales_monthly
WHERE alias_catalog_id = 'air-jordan-4-retro-og-fire-red-2020-dc7770-160'
GROUP BY alias_catalog_id;

-- ============================================================================
-- 3. Monthly Trend (Last 12 Months) for a Product
-- ============================================================================

SELECT
  sale_month,
  SUM(sale_count) AS monthly_sales,
  ROUND(SUM(total_revenue) / NULLIF(SUM(sale_count), 0), 2) AS monthly_avg_price
FROM inventory_v4_alias_sales_monthly
WHERE alias_catalog_id = 'air-jordan-4-retro-og-fire-red-2020-dc7770-160'
  AND sale_month >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY sale_month
ORDER BY sale_month DESC;

-- ============================================================================
-- 4. Size Breakdown (All-Time) for a Product
-- ============================================================================

SELECT
  size_value,
  SUM(sale_count) AS total_sales,
  ROUND(SUM(total_revenue) / NULLIF(SUM(sale_count), 0), 2) AS avg_price,
  MIN(min_price) AS low_price,
  MAX(max_price) AS high_price
FROM inventory_v4_alias_sales_monthly
WHERE alias_catalog_id = 'air-jordan-4-retro-og-fire-red-2020-dc7770-160'
GROUP BY size_value
ORDER BY size_value;

-- ============================================================================
-- 5. Top 10 Products by Sales Volume (Current Year)
-- ============================================================================

SELECT
  alias_catalog_id,
  SUM(sale_count) AS ytd_sales,
  SUM(total_revenue) AS ytd_revenue
FROM inventory_v4_alias_sales_monthly
WHERE sale_month >= DATE_TRUNC('year', CURRENT_DATE)
GROUP BY alias_catalog_id
ORDER BY ytd_sales DESC
LIMIT 10;

-- ============================================================================
-- 6. Consignment Ratio by Month
-- ============================================================================

SELECT
  sale_month,
  SUM(consigned_count) AS consigned_sales,
  SUM(non_consigned_count) AS direct_sales,
  ROUND(100.0 * SUM(consigned_count) / NULLIF(SUM(sale_count), 0), 1) AS consignment_pct
FROM inventory_v4_alias_sales_monthly
WHERE alias_catalog_id = 'air-jordan-4-retro-og-fire-red-2020-dc7770-160'
GROUP BY sale_month
ORDER BY sale_month DESC;
