-- Clear all StockX listings from database
-- This allows you to test the mapping flow from scratch

BEGIN;

-- Step 1: Remove listing IDs from inventory_market_links
UPDATE inventory_market_links
SET stockx_listing_id = NULL
WHERE stockx_listing_id IS NOT NULL;

-- Step 2: Delete all listing records
DELETE FROM stockx_listings;

COMMIT;

-- Verify the cleanup
SELECT 'inventory_market_links with listing IDs:' as check, COUNT(*) as count
FROM inventory_market_links
WHERE stockx_listing_id IS NOT NULL
UNION ALL
SELECT 'stockx_listings records:', COUNT(*)
FROM stockx_listings;
