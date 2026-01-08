-- Migration: Rename 'coplists' to 'watchlists' and 'coplist_id' to 'watchlist_id'
-- Date: 2025-01-08
-- Description: Comprehensive rename of coplist concept to watchlist across schema

-- 1. Rename the coplists table to watchlists
ALTER TABLE IF EXISTS coplists RENAME TO watchlists;

-- 2. Rename the foreign key column in items table
ALTER TABLE IF EXISTS items RENAME COLUMN coplist_id TO watchlist_id;

-- 3. Update any indexes (if they exist with coplist in the name)
-- Note: Postgres automatically renames indexes when tables are renamed,
-- but we'll handle any custom indexes explicitly if needed

-- 4. Re-create or update any RLS policies that reference coplist
-- First, drop existing policies on the old table name (if any exist)
DROP POLICY IF EXISTS "Users can view their own coplists" ON watchlists;
DROP POLICY IF EXISTS "Users can create their own coplists" ON watchlists;
DROP POLICY IF EXISTS "Users can update their own coplists" ON watchlists;
DROP POLICY IF EXISTS "Users can delete their own coplists" ON watchlists;

-- Recreate RLS policies with watchlist naming
CREATE POLICY "Users can view their own watchlists"
  ON watchlists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own watchlists"
  ON watchlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watchlists"
  ON watchlists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watchlists"
  ON watchlists FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Update any database functions or views that reference coplists
-- (Add specific function updates here if any exist)

-- 6. Add comment to document the change
COMMENT ON TABLE watchlists IS 'User watchlists for tracking desired items (previously called coplists)';
COMMENT ON COLUMN items.watchlist_id IS 'Reference to watchlist (previously coplist_id)';
