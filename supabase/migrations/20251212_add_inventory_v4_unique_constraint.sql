-- ============================================================================
-- INVENTORY V4 - UNIQUE CONSTRAINT FOR DUPLICATE PROTECTION
-- ============================================================================
-- Date: 2025-12-12
-- Purpose: Prevent duplicate items at DB level (race condition protection)
--
-- Uses partial unique index to allow:
--   - Only one active item per (user, style, size, unit)
--   - Re-adding after sold/removed
-- ============================================================================

-- Partial unique index: only enforced for active statuses
-- This allows re-adding an item after it's sold or removed
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_v4_items_unique_active
  ON inventory_v4_items(user_id, style_id, size, size_unit)
  WHERE status NOT IN ('sold', 'removed');

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_inventory_v4_items_unique_active'
  ) THEN
    RAISE EXCEPTION 'Unique index was not created';
  END IF;

  RAISE NOTICE '✅ Partial unique index created for inventory_v4_items';
  RAISE NOTICE '   - Enforced for: in_stock, listed_stockx, listed_alias, consigned';
  RAISE NOTICE '   - Not enforced for: sold, removed (allows re-adding)';
END $$;
