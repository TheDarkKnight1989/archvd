-- Test query to verify vat_margin_detail_view is working correctly

-- This should return your sold items with the correct column names
SELECT
  item_id,
  sku,
  brand,
  model,
  size,
  sold_date,
  buy_price,      -- Should work (was purchase_price)
  sale_price,     -- Should work (was sold_price)
  margin_gbp,     -- Should work (was margin)
  vat_due_gbp,    -- Should work (was vat_due)
  platform
FROM vat_margin_detail_view
ORDER BY sold_date DESC
LIMIT 10;

-- If this returns data, the view is working correctly
-- If this returns an error about column names, the migration didn't apply properly
