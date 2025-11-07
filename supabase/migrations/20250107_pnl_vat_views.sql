-- Migration: P&L and VAT Margin Views
-- Created: 2025-01-07
-- Purpose: Monthly profit & loss reporting with UK VAT Margin Scheme calculations

-- ============================================================================
-- 1. Profit & Loss Monthly View
-- ============================================================================
-- Aggregates revenue, COGS, expenses, and net profit by user and month
-- Note: Uses per-item purchase_price as COGS (FIFO can be added later)

CREATE OR REPLACE VIEW profit_loss_monthly_view AS
WITH sold_items AS (
  SELECT
    user_id,
    DATE_TRUNC('month', sold_date)::date AS month,
    sold_price AS revenue,
    purchase_price AS cogs,
    (sold_price - purchase_price) AS gross_profit
  FROM "Inventory"
  WHERE status = 'sold'
    AND sold_date IS NOT NULL
    AND sold_price IS NOT NULL
),
monthly_sales AS (
  SELECT
    user_id,
    month,
    SUM(revenue) AS total_revenue,
    SUM(cogs) AS total_cogs,
    SUM(gross_profit) AS total_gross_profit,
    COUNT(*) AS num_sales
  FROM sold_items
  GROUP BY user_id, month
),
monthly_expenses AS (
  SELECT
    user_id,
    DATE_TRUNC('month', date)::date AS month,
    SUM(amount) AS total_expenses
  FROM expenses
  GROUP BY user_id, month
)
SELECT
  COALESCE(s.user_id, e.user_id) AS user_id,
  COALESCE(s.month, e.month) AS month,
  COALESCE(s.total_revenue, 0) AS revenue,
  COALESCE(s.total_cogs, 0) AS cogs,
  COALESCE(s.total_gross_profit, 0) AS gross_profit,
  COALESCE(e.total_expenses, 0) AS expenses,
  (COALESCE(s.total_gross_profit, 0) - COALESCE(e.total_expenses, 0)) AS net_profit,
  COALESCE(s.num_sales, 0) AS num_sales
FROM monthly_sales s
FULL OUTER JOIN monthly_expenses e
  ON s.user_id = e.user_id AND s.month = e.month
ORDER BY month DESC;

-- Add RLS policy for profit_loss_monthly_view
ALTER VIEW profit_loss_monthly_view SET (security_invoker = on);

COMMENT ON VIEW profit_loss_monthly_view IS
  'Monthly P&L aggregation per user. Revenue from sold items, COGS from purchase_price, expenses from expenses table.';


-- ============================================================================
-- 2. VAT Margin Monthly View (UK Margin Scheme)
-- ============================================================================
-- Calculates VAT due under UK Margin Scheme: VAT = (Sale Price - Purchase Price) / 6
-- Only positive margins are subject to VAT

CREATE OR REPLACE VIEW vat_margin_monthly_view AS
WITH sold_items_margin AS (
  SELECT
    user_id,
    DATE_TRUNC('month', sold_date)::date AS month,
    id AS item_id,
    sku,
    brand,
    model,
    sold_date,
    purchase_price,
    sold_price,
    platform,
    (sold_price - purchase_price) AS margin,
    CASE
      WHEN (sold_price - purchase_price) > 0
      THEN (sold_price - purchase_price) / 6.0
      ELSE 0
    END AS vat_due
  FROM "Inventory"
  WHERE status = 'sold'
    AND sold_date IS NOT NULL
    AND sold_price IS NOT NULL
    AND purchase_price IS NOT NULL
)
SELECT
  user_id,
  month,
  COUNT(*) AS num_sales,
  SUM(sold_price) AS total_sales,
  SUM(margin) AS total_margin,
  SUM(CASE WHEN margin > 0 THEN margin ELSE 0 END) AS taxable_margin,
  SUM(vat_due) AS vat_due
FROM sold_items_margin
GROUP BY user_id, month
ORDER BY month DESC;

-- Add RLS policy for vat_margin_monthly_view
ALTER VIEW vat_margin_monthly_view SET (security_invoker = on);

COMMENT ON VIEW vat_margin_monthly_view IS
  'Monthly VAT calculations under UK Margin Scheme. VAT due = positive margin / 6.';


-- ============================================================================
-- 3. Item-level VAT Detail View (for exports)
-- ============================================================================
-- Individual sold items with VAT calculations

CREATE OR REPLACE VIEW vat_margin_detail_view AS
SELECT
  user_id,
  id AS item_id,
  sku,
  brand,
  model,
  size,
  sold_date,
  purchase_price,
  sold_price,
  platform,
  (sold_price - purchase_price) AS margin,
  CASE
    WHEN (sold_price - purchase_price) > 0
    THEN (sold_price - purchase_price) / 6.0
    ELSE 0
  END AS vat_due,
  DATE_TRUNC('month', sold_date)::date AS month
FROM "Inventory"
WHERE status = 'sold'
  AND sold_date IS NOT NULL
  AND sold_price IS NOT NULL
  AND purchase_price IS NOT NULL
ORDER BY sold_date DESC;

-- Add RLS policy for vat_margin_detail_view
ALTER VIEW vat_margin_detail_view SET (security_invoker = on);

COMMENT ON VIEW vat_margin_detail_view IS
  'Item-level VAT margin details for exports and detailed reporting.';


-- ============================================================================
-- Grant permissions to authenticated users (adjust as needed)
-- ============================================================================
GRANT SELECT ON profit_loss_monthly_view TO authenticated;
GRANT SELECT ON vat_margin_monthly_view TO authenticated;
GRANT SELECT ON vat_margin_detail_view TO authenticated;
