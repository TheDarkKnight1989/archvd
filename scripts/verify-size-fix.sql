-- Verification query to check if size-based matching is working
-- Run this to see if your UK9 items now show correct market data

-- 1. Check the uk_to_us_size function works
SELECT
  uk_to_us_size('9') AS "UK9 converts to US",
  uk_to_us_size('8.5') AS "UK8.5 converts to US",
  uk_to_us_size('10') AS "UK10 converts to US";

-- 2. Check inventory with size-matched prices
SELECT
  id,
  sku,
  brand,
  model,
  size_uk,
  uk_to_us_size(size_uk) AS us_size,
  market_last_sale,
  market_lowest_ask,
  market_highest_bid,
  market_as_of
FROM public.inventory_with_stockx_prices
WHERE size_uk = '9'
  AND market_last_sale IS NOT NULL
LIMIT 5;

-- 3. Compare old vs new approach for a specific item
-- Replace 'YOUR_ITEM_ID' with an actual item ID
/*
SELECT
  'Old (wrong)' AS method,
  smp.last_sale,
  smp.size AS matched_size
FROM "Inventory" i
LEFT JOIN inventory_market_links iml ON i.id = iml.item_id
LEFT JOIN stockx_market_prices smp ON smp.stockx_variant_id = iml.stockx_variant_id
WHERE i.id = 'YOUR_ITEM_ID'

UNION ALL

SELECT
  'New (correct)' AS method,
  market_last_sale,
  uk_to_us_size(size_uk) AS matched_size
FROM inventory_with_stockx_prices
WHERE id = 'YOUR_ITEM_ID';
*/

-- 4. Check how many items now have market data
SELECT
  COUNT(*) AS total_items,
  COUNT(market_last_sale) AS items_with_prices,
  ROUND(COUNT(market_last_sale)::NUMERIC / COUNT(*)::NUMERIC * 100, 1) AS coverage_percent
FROM public.inventory_with_stockx_prices
WHERE category = 'sneaker';
