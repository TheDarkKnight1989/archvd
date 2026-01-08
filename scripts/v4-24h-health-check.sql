-- ============================================================================
-- V4 24-HOUR HEALTH CHECK SQL PACK
-- Run this tomorrow to verify data integrity and growth
-- ============================================================================

-- 1. DUPLICATE GROUPS CHECK (sales_history)
-- Should return 0 if no duplicates
SELECT 'SALES_HISTORY_DUPLICATE_GROUPS' as check_name, count(*) as duplicate_groups FROM (
  SELECT alias_catalog_id, size_value, price, purchased_at
  FROM inventory_v4_alias_sales_history
  GROUP BY 1,2,3,4
  HAVING count(*) > 1
) g;

-- 2. GROWTH SANITY: Row count snapshot
-- Compare these values to previous day
SELECT 'ROW_COUNTS' as check_name,
  (SELECT count(*) FROM inventory_v4_stockx_price_history) as stockx_price_history,
  (SELECT count(*) FROM inventory_v4_alias_price_history) as alias_price_history,
  (SELECT count(*) FROM inventory_v4_alias_sales_history) as alias_sales_history,
  (SELECT count(*) FROM inventory_v4_stockx_products) as stockx_products,
  (SELECT count(*) FROM inventory_v4_alias_products) as alias_products;

-- 3. FRESHNESS: Min/Max recorded_at for last 24h
SELECT 'STOCKX_PRICE_HISTORY_FRESHNESS' as check_name,
  min(recorded_at) as min_recorded_at,
  max(recorded_at) as max_recorded_at,
  count(*) as rows_last_24h
FROM inventory_v4_stockx_price_history
WHERE recorded_at >= now() - interval '24 hours';

SELECT 'ALIAS_PRICE_HISTORY_FRESHNESS' as check_name,
  min(recorded_at) as min_recorded_at,
  max(recorded_at) as max_recorded_at,
  count(*) as rows_last_24h
FROM inventory_v4_alias_price_history
WHERE recorded_at >= now() - interval '24 hours';

-- 4. QUEUE HEALTH
SELECT 'QUEUE_STATS' as check_name, status, count(*)
FROM inventory_v4_sync_queue
GROUP BY status;

-- 5. FAILED JOBS BY ERROR PREFIX
SELECT 'FAILED_JOBS_BY_ERROR' as check_name,
  CASE
    WHEN last_error LIKE 'MISSING_MAPPING:%' THEN 'MISSING_MAPPING'
    WHEN last_error LIKE '%502%' OR last_error LIKE '%503%' OR last_error LIKE '%504%' THEN 'HTTP_5XX'
    WHEN last_error LIKE '%429%' THEN 'RATE_LIMITED'
    WHEN last_error ILIKE '%timeout%' THEN 'TIMEOUT'
    ELSE 'OTHER'
  END as error_category,
  count(*) as count
FROM inventory_v4_sync_queue
WHERE status = 'failed'
GROUP BY 2;

-- 6. SALES HISTORY DUPLICATE CHECK (detailed)
SELECT 'SALES_DUPLICATE_DETAIL' as check_name,
  alias_catalog_id, size_value, price, purchased_at, count(*) as occurrences
FROM inventory_v4_alias_sales_history
GROUP BY 1,2,3,4
HAVING count(*) > 1
LIMIT 10;

-- ============================================================================
-- END OF 24-HOUR HEALTH CHECK
-- ============================================================================
