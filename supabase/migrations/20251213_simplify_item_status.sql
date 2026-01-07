-- ============================================================================
-- INVENTORY V4 - SIMPLIFY ITEM STATUS ENUM
-- ============================================================================
--
-- Purpose: Remove listing-related statuses from items table since listings
-- are now tracked in the separate inventory_v4_listings table.
--
-- Date: 2025-12-13
--
-- Before: in_stock, listed, listed_stockx, listed_alias, consigned, sold, removed
-- After:  in_stock, consigned, sold, removed
--
-- "Listed" state is now derived: item.listings.some(l => l.status === 'active')
--
-- ============================================================================

-- ============================================================================
-- 1. MIGRATE EXISTING DATA
-- ============================================================================

-- Convert any items with legacy listing statuses to 'in_stock'
-- (Their actual listing state is tracked in inventory_v4_listings)
UPDATE inventory_v4_items
SET status = 'in_stock'
WHERE status IN ('listed', 'listed_stockx', 'listed_alias');

-- ============================================================================
-- 2. UPDATE CHECK CONSTRAINT
-- ============================================================================

-- Drop the old constraint
ALTER TABLE inventory_v4_items
DROP CONSTRAINT IF EXISTS inventory_v4_items_status_check;

-- Add the new simplified constraint
ALTER TABLE inventory_v4_items
ADD CONSTRAINT inventory_v4_items_status_check CHECK (
  status IN ('in_stock', 'consigned', 'sold', 'removed')
);

-- ============================================================================
-- 3. UPDATE COMMENT
-- ============================================================================

COMMENT ON COLUMN inventory_v4_items.status IS
  'Physical item state: in_stock (have it), consigned (at consignment), sold (gone), removed (soft delete). Listing state is derived from inventory_v4_listings table.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  bad_status_count INTEGER;
BEGIN
  -- Verify no items have legacy statuses
  SELECT COUNT(*) INTO bad_status_count
  FROM inventory_v4_items
  WHERE status IN ('listed', 'listed_stockx', 'listed_alias');

  IF bad_status_count > 0 THEN
    RAISE EXCEPTION 'Found % items with legacy listing statuses', bad_status_count;
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ Item status simplified';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Status values now:';
  RAISE NOTICE '  - in_stock: Item is in inventory';
  RAISE NOTICE '  - consigned: Item is at consignment location';
  RAISE NOTICE '  - sold: Item has been sold';
  RAISE NOTICE '  - removed: Soft deleted';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Listing state:';
  RAISE NOTICE '  - Derived from inventory_v4_listings table';
  RAISE NOTICE '  - isListed = listings.some(l => l.status === "active")';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Removed statuses:';
  RAISE NOTICE '  - listed (now derived)';
  RAISE NOTICE '  - listed_stockx (now in listings table)';
  RAISE NOTICE '  - listed_alias (now in listings table)';
END $$;
