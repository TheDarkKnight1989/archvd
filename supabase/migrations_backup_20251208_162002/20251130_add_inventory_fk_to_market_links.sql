-- ============================================================================
-- Add Foreign Key from inventory_market_links.item_id to Inventory.id
-- ============================================================================
-- This enables PostgREST to automatically join the tables in queries
-- Without this FK, PostgREST can't resolve: inventory_market_links.select('*, Inventory(*)')

-- Check if FK already exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_inventory_market_links_item_id'
  ) THEN
    ALTER TABLE inventory_market_links
    ADD CONSTRAINT fk_inventory_market_links_item_id
    FOREIGN KEY (item_id)
    REFERENCES "Inventory"(id)
    ON DELETE CASCADE;

    RAISE NOTICE 'Added FK constraint from inventory_market_links.item_id to Inventory.id';
  ELSE
    RAISE NOTICE 'FK constraint already exists';
  END IF;
END $$;

-- Add index for join performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_inventory_market_links_item_id
ON inventory_market_links(item_id);

COMMENT ON CONSTRAINT fk_inventory_market_links_item_id ON inventory_market_links IS
  'Foreign key to Inventory table - enables PostgREST joins via inventory_market_links.select(''*, Inventory(*)'')';
