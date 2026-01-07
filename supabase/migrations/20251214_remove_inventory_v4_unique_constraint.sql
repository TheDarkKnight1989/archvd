-- ============================================================================
-- INVENTORY V4 - REMOVE UNIQUE CONSTRAINT
-- ============================================================================
-- Date: 2025-12-14
-- Purpose: Allow users to add multiple identical items (same SKU/size)
--
-- Reason: Users can buy multiple pairs of the same shoe in the same size.
-- Example: A reseller buys 3 pairs of Jordan 1 Bred in size 10 US
-- Each pair should be tracked as a separate inventory item.
-- ============================================================================

-- Drop the unique constraint that was preventing duplicate items
DROP INDEX IF EXISTS idx_inventory_v4_items_unique_active;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_inventory_v4_items_unique_active'
  ) THEN
    RAISE EXCEPTION 'Unique index was not dropped';
  END IF;

  RAISE NOTICE '✅ Unique constraint removed from inventory_v4_items';
  RAISE NOTICE '   Users can now add multiple items with same SKU/size';
END $$;
