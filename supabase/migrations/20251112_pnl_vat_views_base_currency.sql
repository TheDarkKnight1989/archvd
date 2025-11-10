-- ============================================================================
-- P&L and VAT Views Using Stored Base Currency Amounts
-- Created: 2025-01-12
-- Purpose: Create/update views to use FX snapshot base amounts for accounting
-- ============================================================================

-- ============================================================================
-- 1. VAT Margin Detail View
-- ============================================================================
-- Shows individual sold items with VAT margin calculation
-- VAT margin scheme: VAT = (Sale - Purchase - Allowable Costs) / 6

DROP VIEW IF EXISTS public.vat_margin_detail_view CASCADE;

CREATE VIEW public.vat_margin_detail_view
WITH (security_invoker = on) AS
SELECT
  i.user_id,
  i.id AS item_id,
  i.sku,
  i.brand,
  i.model,
  i.size_uk AS size,
  -- Use FX snapshot base amounts instead of original prices
  i.purchase_amount_base AS buy_price,
  i.sale_amount_base AS sale_price,
  i.sold_date,
  i.platform AS platform,
  -- Calculate margin in base currency (including sales fees)
  (i.sale_amount_base - i.purchase_amount_base - COALESCE(i.sales_fee, 0)) AS margin_gbp,
  -- VAT due under margin scheme: margin / 6
  ((i.sale_amount_base - i.purchase_amount_base - COALESCE(i.sales_fee, 0)) / 6.0) AS vat_due_gbp
FROM public."Inventory" i
WHERE i.status = 'sold'
  AND i.sale_amount_base IS NOT NULL
  AND i.purchase_amount_base IS NOT NULL
  AND i.user_id = auth.uid();

COMMENT ON VIEW public.vat_margin_detail_view IS 'Sold items with VAT margin calculation using stored base currency amounts';

-- ============================================================================
-- 2. VAT Margin Monthly View
-- ============================================================================
-- Monthly aggregation of VAT margin data

DROP VIEW IF EXISTS public.vat_margin_monthly_view CASCADE;

CREATE VIEW public.vat_margin_monthly_view
WITH (security_invoker = on) AS
SELECT
  user_id,
  DATE_TRUNC('month', sold_date::date)::date AS month,
  SUM(sale_price) AS total_sales,
  SUM(margin_gbp) AS total_margin,
  SUM(vat_due_gbp) AS vat_due
FROM public.vat_margin_detail_view
GROUP BY user_id, DATE_TRUNC('month', sold_date::date)
ORDER BY month DESC;

COMMENT ON VIEW public.vat_margin_monthly_view IS 'Monthly VAT margin summary using stored base currency amounts';

-- ============================================================================
-- 3. Profit & Loss Monthly View
-- ============================================================================
-- Monthly P&L statement using stored base amounts

DROP VIEW IF EXISTS public.profit_loss_monthly_view CASCADE;

CREATE VIEW public.profit_loss_monthly_view
WITH (security_invoker = on) AS
WITH monthly_sales AS (
  -- Revenue and COGS from sold inventory (using base amounts)
  SELECT
    user_id,
    DATE_TRUNC('month', sold_date::date)::date AS month,
    SUM(sale_amount_base) AS revenue,
    SUM(purchase_amount_base + COALESCE(sales_fee, 0)) AS cogs
  FROM public."Inventory"
  WHERE status = 'sold'
    AND sale_amount_base IS NOT NULL
    AND purchase_amount_base IS NOT NULL
    AND user_id = auth.uid()
  GROUP BY user_id, DATE_TRUNC('month', sold_date::date)
),
monthly_expenses AS (
  -- Expenses (using base amounts from FX snapshots)
  SELECT
    user_id,
    DATE_TRUNC('month', date::date)::date AS month,
    SUM(COALESCE(expense_amount_base, amount)) AS total_expenses
  FROM public.expenses
  WHERE user_id = auth.uid()
  GROUP BY user_id, DATE_TRUNC('month', date::date)
)
SELECT
  COALESCE(s.user_id, e.user_id) AS user_id,
  COALESCE(s.month, e.month) AS month,
  COALESCE(s.revenue, 0) AS revenue,
  COALESCE(s.cogs, 0) AS cogs,
  COALESCE(s.revenue, 0) - COALESCE(s.cogs, 0) AS gross_profit,
  COALESCE(e.total_expenses, 0) AS expenses,
  (COALESCE(s.revenue, 0) - COALESCE(s.cogs, 0) - COALESCE(e.total_expenses, 0)) AS net_profit
FROM monthly_sales s
FULL OUTER JOIN monthly_expenses e ON s.user_id = e.user_id AND s.month = e.month
ORDER BY month DESC;

COMMENT ON VIEW public.profit_loss_monthly_view IS 'Monthly P&L statement using stored base currency amounts';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
