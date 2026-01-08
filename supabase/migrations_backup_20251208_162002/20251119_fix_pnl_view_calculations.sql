-- ============================================================================
-- Fix P&L View Calculations and Field Names
-- ============================================================================
-- This migration updates the vat_margin_detail_view to:
-- 1. Use correct field aliases (buy_price, sale_price, margin_gbp, vat_due_gbp)
-- 2. Calculate margin correctly: (sold_price - cost_basis - fees)
-- 3. Match the calculations used in the Sales table

-- Drop the existing view first (needed when column types change)
DROP VIEW IF EXISTS vat_margin_detail_view CASCADE;

-- Recreate with correct calculations
CREATE VIEW vat_margin_detail_view AS
SELECT
  user_id,
  id AS item_id,
  sku,
  brand,
  model,
  size,
  sold_date,

  -- Cost basis: purchase_price + tax + shipping (use purchase_total if available)
  COALESCE(purchase_total, purchase_price + COALESCE(tax, 0) + COALESCE(shipping, 0)) AS buy_price,

  -- Sale price (use sold_price which is set by mark-sold API)
  sold_price AS sale_price,

  -- Platform
  platform,

  -- Margin calculation: sold_price - cost_basis - fees
  -- This matches the calculation in useSalesTable.ts
  (
    COALESCE(sold_price, 0) -
    COALESCE(purchase_total, purchase_price + COALESCE(tax, 0) + COALESCE(shipping, 0)) -
    COALESCE(sales_fee, 0)
  ) AS margin_gbp,

  -- VAT due (only on positive margin, margin scheme)
  CASE
    WHEN (
      COALESCE(sold_price, 0) -
      COALESCE(purchase_total, purchase_price + COALESCE(tax, 0) + COALESCE(shipping, 0)) -
      COALESCE(sales_fee, 0)
    ) > 0
    THEN (
      COALESCE(sold_price, 0) -
      COALESCE(purchase_total, purchase_price + COALESCE(tax, 0) + COALESCE(shipping, 0)) -
      COALESCE(sales_fee, 0)
    ) / 6.0
    ELSE 0
  END AS vat_due_gbp,

  -- Month for aggregation
  DATE_TRUNC('month', sold_date)::date AS month

FROM "Inventory"
WHERE
  status = 'sold'
  AND sold_date IS NOT NULL
  AND sold_price IS NOT NULL
  AND purchase_price IS NOT NULL
ORDER BY sold_date DESC;

-- Ensure RLS is enabled
ALTER VIEW vat_margin_detail_view SET (security_invoker = on);

COMMENT ON VIEW vat_margin_detail_view IS
  'Item-level P&L and VAT margin details with correct cost basis (buy + tax + ship) and fees deduction. Matches Sales table calculations.';
