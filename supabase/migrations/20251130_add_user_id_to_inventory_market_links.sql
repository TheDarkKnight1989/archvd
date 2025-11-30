-- Migration: Add user_id to inventory_market_links
-- Purpose: Enable direct user filtering without requiring JOIN through items table
-- Date: 2025-11-30

-- ============================================================================
-- 1. Add user_id column to inventory_market_links
-- ============================================================================

ALTER TABLE inventory_market_links
ADD COLUMN IF NOT EXISTS user_id UUID;

-- ============================================================================
-- 2. Populate user_id from items table (one-time backfill)
-- ============================================================================

UPDATE inventory_market_links
SET user_id = "Inventory".user_id
FROM "Inventory"
WHERE inventory_market_links.item_id = "Inventory".id
AND inventory_market_links.user_id IS NULL;

-- ============================================================================
-- 3. Check for orphaned rows and handle them
-- ============================================================================

-- Log how many rows have NULL user_id (orphaned - no matching Inventory row)
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM inventory_market_links
  WHERE user_id IS NULL;

  IF orphaned_count > 0 THEN
    RAISE NOTICE 'Found % orphaned rows with NULL user_id (no matching Inventory). Deleting them.', orphaned_count;

    -- Delete orphaned rows (no matching inventory item)
    DELETE FROM inventory_market_links
    WHERE user_id IS NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. Make user_id NOT NULL after cleanup (if not already)
-- ============================================================================

DO $$
BEGIN
  -- Only set NOT NULL if column exists and is nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_market_links'
    AND column_name = 'user_id'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE inventory_market_links
    ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 5. Add foreign key constraint (if not exists)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_inventory_market_links_user_id'
  ) THEN
    ALTER TABLE inventory_market_links
    ADD CONSTRAINT fk_inventory_market_links_user_id
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 6. Add index for efficient user filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_inventory_market_links_user_id
ON inventory_market_links(user_id);

-- ============================================================================
-- 7. Update RLS policies to use user_id directly
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own inventory market links" ON inventory_market_links;
DROP POLICY IF EXISTS "Users can insert their own inventory market links" ON inventory_market_links;
DROP POLICY IF EXISTS "Users can update their own inventory market links" ON inventory_market_links;
DROP POLICY IF EXISTS "Users can delete their own inventory market links" ON inventory_market_links;

-- Create new policies using user_id
CREATE POLICY "Users can view their own inventory market links"
ON inventory_market_links FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own inventory market links"
ON inventory_market_links FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inventory market links"
ON inventory_market_links FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inventory market links"
ON inventory_market_links FOR DELETE
USING (auth.uid() = user_id);

COMMENT ON COLUMN inventory_market_links.user_id IS
  'User ID copied from items table for efficient RLS filtering';
