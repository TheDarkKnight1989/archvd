-- Complete fix for P&L data display issues
-- Run this entire script in Supabase SQL Editor

-- ============================================================================
-- 1. Drop and recreate view (fixes column names)
-- ============================================================================

DROP VIEW IF EXISTS vat_margin_detail_view CASCADE;

CREATE VIEW vat_margin_detail_view AS
SELECT
  user_id,
  id AS item_id,
  sku,
  brand,
  model,
  COALESCE(size, '—') as size,  -- Handle NULL sizes
  sold_date,
  purchase_price AS buy_price,
  COALESCE(sold_price, 0) AS sale_price,  -- Handle NULL sold_price
  platform,
  (COALESCE(sold_price, 0) - purchase_price) AS margin_gbp,
  CASE
    WHEN (COALESCE(sold_price, 0) - purchase_price) > 0
    THEN (COALESCE(sold_price, 0) - purchase_price) / 6.0
    ELSE 0
  END AS vat_due_gbp,
  DATE_TRUNC('month', sold_date)::date AS month
FROM "Inventory"
WHERE status = 'sold'
  AND sold_date IS NOT NULL
ORDER BY sold_date DESC;

ALTER VIEW vat_margin_detail_view SET (security_invoker = on);

GRANT SELECT ON vat_margin_detail_view TO authenticated;

-- ============================================================================
-- 2. Update NULL sold_price to 0 (so items show up)
-- ============================================================================

UPDATE "Inventory"
SET sold_price = 0
WHERE status = 'sold'
  AND sold_date IS NOT NULL
  AND sold_price IS NULL;

-- ============================================================================
-- 3. Verify - this should now return all 5 sold items
-- ============================================================================

SELECT
  item_id,
  sku,
  brand,
  size,
  buy_price,
  sale_price,
  sold_date
FROM vat_margin_detail_view
ORDER BY sold_date DESC;
