-- Fix rollup_alias_sales_daily_v4 timeout by setting statement_timeout

CREATE OR REPLACE FUNCTION rollup_alias_sales_daily_v4()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '300s'  -- 5 minute timeout
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
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
    COUNT(*) FILTER (WHERE consigned = false OR consigned IS NULL) AS non_consigned_count,
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

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$;

-- Also fix monthly for consistency
CREATE OR REPLACE FUNCTION rollup_alias_sales_monthly_v4()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '300s'
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
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

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$;

-- Re-grant permissions
REVOKE ALL ON FUNCTION rollup_alias_sales_daily_v4() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rollup_alias_sales_daily_v4() TO service_role;

REVOKE ALL ON FUNCTION rollup_alias_sales_monthly_v4() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rollup_alias_sales_monthly_v4() TO service_role;
