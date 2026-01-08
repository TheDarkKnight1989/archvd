-- ============================================================================
-- Fix Inventory Platform Constraint
-- ============================================================================
-- Issue: The platform column CHECK constraint had capitalized values
-- ('StockX', 'Alias', etc.) but the application code sends lowercase
-- values ('stockx', 'goat', etc.), causing constraint violations.
--
-- This migration:
-- 1. Drops the old constraint (so we can update the data)
-- 2. Updates existing data from capitalized to lowercase
-- 3. Adds new constraint with lowercase values
-- ============================================================================

BEGIN;

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

COMMIT;
