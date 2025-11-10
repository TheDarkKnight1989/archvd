-- Fix P&L view column names to match TypeScript interface
-- Issue: Original view used purchase_price/sold_price/margin/vat_due
--        Code expects buy_price/sale_price/margin_gbp/vat_due_gbp

-- ============================================================================
-- Step 1: Drop existing view (CASCADE handles any dependencies)
-- ============================================================================

DROP VIEW IF EXISTS vat_margin_detail_view CASCADE;

-- ============================================================================
-- Step 2: Recreate view with correct column names matching TypeScript interface
-- ============================================================================

CREATE VIEW vat_margin_detail_view AS
SELECT
  user_id,
  id AS item_id,
  sku,
  brand,
  model,
  size,
  sold_date,
  purchase_price AS buy_price,      -- RENAMED: purchase_price -> buy_price
  sold_price AS sale_price,          -- RENAMED: sold_price -> sale_price
  platform,
  (sold_price - purchase_price) AS margin_gbp,  -- RENAMED: margin -> margin_gbp
  CASE
    WHEN (sold_price - purchase_price) > 0
    THEN (sold_price - purchase_price) / 6.0
    ELSE 0
  END AS vat_due_gbp,                -- RENAMED: vat_due -> vat_due_gbp
  DATE_TRUNC('month', sold_date)::date AS month
FROM "Inventory"
WHERE status = 'sold'
  AND sold_date IS NOT NULL
  AND sold_price IS NOT NULL
  AND purchase_price IS NOT NULL
ORDER BY sold_date DESC;

-- ============================================================================
-- Step 3: Apply RLS policy (security_invoker = on)
-- ============================================================================

ALTER VIEW vat_margin_detail_view SET (security_invoker = on);

-- ============================================================================
-- Step 4: Add descriptive comment
-- ============================================================================

COMMENT ON VIEW vat_margin_detail_view IS
  'Item-level VAT margin details for P&L and exports. Columns aliased to match TypeScript interface: buy_price (was purchase_price), sale_price (was sold_price), margin_gbp (was margin), vat_due_gbp (was vat_due).';

-- ============================================================================
-- Step 5: Grant permissions to authenticated users
-- ============================================================================

GRANT SELECT ON vat_margin_detail_view TO authenticated;

-- ============================================================================
-- Verification queries (run these after migration to verify)
-- ============================================================================

-- Uncomment to verify column names:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'vat_margin_detail_view'
-- ORDER BY ordinal_position;

-- Uncomment to test query:
-- SELECT * FROM vat_margin_detail_view LIMIT 1;
