-- Diagnostic queries to check P&L data issues
-- Run these in Supabase SQL Editor to diagnose the problem

-- ============================================================================
-- 1. Check if sold items have the required fields
-- ============================================================================
SELECT
  id,
  sku,
  brand,
  model,
  size,
  purchase_price,
  sold_price,
  sold_date,
  platform,
  status
FROM "Inventory"
WHERE status = 'sold'
ORDER BY sold_date DESC
LIMIT 5;

-- Expected: Should show all sold items with their details
-- If size or sold_price are NULL, that's the problem

-- ============================================================================
-- 2. Check the view output
-- ============================================================================
SELECT
  item_id,
  sku,
  brand,
  model,
  size,
  buy_price,
  sale_price,
  sold_date,
  margin_gbp,
  vat_due_gbp,
  platform
FROM vat_margin_detail_view
ORDER BY sold_date DESC
LIMIT 5;

-- Expected: Should show same data with renamed columns
-- If columns don't exist, the migration didn't apply correctly

-- ============================================================================
-- 3. Check column names in the view
-- ============================================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vat_margin_detail_view'
ORDER BY ordinal_position;

-- Expected: Should include buy_price, sale_price, margin_gbp, vat_due_gbp
-- If it shows purchase_price, sold_price, margin, vat_due - migration didn't work

-- ============================================================================
-- 4. Check for NULL values causing issues
-- ============================================================================
SELECT
  COUNT(*) as total_sold,
  COUNT(size) as has_size,
  COUNT(sold_price) as has_sold_price,
  COUNT(purchase_price) as has_purchase_price
FROM "Inventory"
WHERE status = 'sold';

-- Expected: If has_size or has_sold_price < total_sold, some records are missing data
