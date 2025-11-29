-- ============================================================================
-- Fix Platform Data and Constraint
-- ============================================================================
-- Step 1: Drop old constraint (so we can update the data)
-- Step 2: Update existing data from capitalized to lowercase
-- Step 3: Add new constraint with lowercase values
-- ============================================================================

-- Step 1: Drop the old constraint FIRST (so we can update the data)
ALTER TABLE "Inventory" DROP CONSTRAINT IF EXISTS "Inventory_platform_check";

-- Step 2: Update existing platform values to lowercase
UPDATE "Inventory"
SET platform = CASE
  WHEN platform = 'StockX' THEN 'stockx'
  WHEN platform = 'Alias' THEN 'goat'
  WHEN platform = 'Shopify' THEN 'shopify'
  WHEN platform = 'eBay' THEN 'ebay'
  WHEN platform = 'Vinted' THEN 'vinted'
  WHEN platform = 'Instagram' THEN 'instagram'
  WHEN platform = 'Other' THEN 'other'
  ELSE LOWER(platform)
END
WHERE platform IS NOT NULL;

-- Step 3: Add new constraint with lowercase values
ALTER TABLE "Inventory"
ADD CONSTRAINT "Inventory_platform_check"
CHECK (
  (platform IS NULL) OR
  (platform = ANY (ARRAY[
    'stockx'::text,
    'goat'::text,
    'ebay'::text,
    'instagram'::text,
    'tiktok'::text,
    'vinted'::text,
    'depop'::text,
    'private'::text,
    'shopify'::text,
    'other'::text
  ]))
);

-- Verify the changes
SELECT
  platform,
  COUNT(*) as count
FROM "Inventory"
WHERE platform IS NOT NULL
GROUP BY platform
ORDER BY platform;
