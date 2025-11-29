-- ============================================================================
-- Fix Inventory Platform Constraint
-- ============================================================================
-- The constraint was using capitalized values (StockX, Alias, etc.) but the
-- code sends lowercase values (stockx, goat, etc.). This fixes the mismatch.
-- ============================================================================

-- Drop the old constraint
ALTER TABLE "Inventory" DROP CONSTRAINT IF EXISTS "Inventory_platform_check";

-- Create new constraint with lowercase values matching the code
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
    'other'::text
  ]))
);

-- Verify the new constraint
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'Inventory_platform_check';
