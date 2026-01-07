-- ============================================================================
-- INVENTORY V4 - ITEMS TABLE
-- ============================================================================
--
-- Purpose: User's inventory items with V4 architecture
-- Date: 2025-12-12
--
-- Architecture:
--   - References style_id from inventory_v4_style_catalog (single source of truth)
--   - Stores purchase info, size, condition, status
--   - RLS for user-specific access
--
-- ============================================================================

-- ============================================================================
-- 1. CREATE ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_items (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User ownership
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Product reference (single source of truth)
  style_id TEXT NOT NULL REFERENCES inventory_v4_style_catalog(style_id) ON DELETE RESTRICT,

  -- Size info
  size TEXT NOT NULL,  -- Size value as text (e.g., "10", "10.5", "W8")
  size_unit TEXT NOT NULL DEFAULT 'US' CHECK (size_unit IN ('US', 'UK', 'EU')),

  -- Purchase info
  purchase_price NUMERIC(10,2) CHECK (purchase_price IS NULL OR purchase_price >= 0),
  purchase_currency TEXT NOT NULL DEFAULT 'GBP' CHECK (purchase_currency IN ('GBP', 'USD', 'EUR')),
  purchase_date DATE,

  -- Item state
  condition TEXT NOT NULL DEFAULT 'new' CHECK (condition IN ('new', 'used', 'deadstock')),
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN (
    'in_stock',       -- Available for sale
    'listed_stockx',  -- Listed on StockX
    'listed_alias',   -- Listed on Alias
    'consigned',      -- At consignment store
    'sold',           -- Sold
    'removed'         -- Removed/deleted
  )),

  -- Consignment tracking
  consignment_location TEXT,  -- If status = 'consigned', where

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- User's items (primary query pattern)
CREATE INDEX IF NOT EXISTS idx_inventory_v4_items_user_id
  ON inventory_v4_items(user_id);

-- User's items by status (filter by in_stock, listed, etc.)
CREATE INDEX IF NOT EXISTS idx_inventory_v4_items_user_status
  ON inventory_v4_items(user_id, status);

-- Style lookups (for market data join)
CREATE INDEX IF NOT EXISTS idx_inventory_v4_items_style_id
  ON inventory_v4_items(style_id);

-- User + style (check if user has this SKU)
CREATE INDEX IF NOT EXISTS idx_inventory_v4_items_user_style
  ON inventory_v4_items(user_id, style_id);

-- Recent items (for sorting)
CREATE INDEX IF NOT EXISTS idx_inventory_v4_items_created_at
  ON inventory_v4_items(user_id, created_at DESC);

-- Composite index for market data joins (user items + style + size-scoped market)
CREATE INDEX IF NOT EXISTS idx_inventory_v4_items_user_style_size
  ON inventory_v4_items(user_id, style_id, size, size_unit);

-- ============================================================================
-- 3. AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_inventory_v4_items_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_v4_items_updated_at ON inventory_v4_items;

CREATE TRIGGER inventory_v4_items_updated_at
  BEFORE UPDATE ON inventory_v4_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_v4_items_timestamp();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE inventory_v4_items ENABLE ROW LEVEL SECURITY;

-- Users can only see their own items
DROP POLICY IF EXISTS "Users can view own items" ON inventory_v4_items;
CREATE POLICY "Users can view own items"
  ON inventory_v4_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can only insert their own items
DROP POLICY IF EXISTS "Users can insert own items" ON inventory_v4_items;
CREATE POLICY "Users can insert own items"
  ON inventory_v4_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own items
DROP POLICY IF EXISTS "Users can update own items" ON inventory_v4_items;
CREATE POLICY "Users can update own items"
  ON inventory_v4_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own items
DROP POLICY IF EXISTS "Users can delete own items" ON inventory_v4_items;
CREATE POLICY "Users can delete own items"
  ON inventory_v4_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- NOTE: Service role (SUPABASE_SERVICE_ROLE_KEY) bypasses RLS automatically.
-- No policy needed - Supabase handles this at the connection level.

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE inventory_v4_items IS
  'User inventory items - V4 architecture with single source of truth via style_id';

COMMENT ON COLUMN inventory_v4_items.style_id IS
  'References inventory_v4_style_catalog - the canonical SKU identifier';

COMMENT ON COLUMN inventory_v4_items.size IS
  'Size value as text (e.g., "10", "10.5", "W8" for womens)';

COMMENT ON COLUMN inventory_v4_items.size_unit IS
  'Size system: US, UK, or EU - defaults to US';

COMMENT ON COLUMN inventory_v4_items.status IS
  'Item status: in_stock, listed_stockx, listed_alias, consigned, sold, removed';

COMMENT ON COLUMN inventory_v4_items.condition IS
  'Item condition: new (DS with tags), used, deadstock (DS without tags)';

COMMENT ON COLUMN inventory_v4_items.purchase_price IS
  'Purchase price in major currency units (nullable). Must be >= 0 if provided.';

COMMENT ON COLUMN inventory_v4_items.purchase_currency IS
  'Currency of purchase price: GBP, USD, or EUR. Matches pricing-v4 Currency type.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'inventory_v4_items'
  ) THEN
    RAISE EXCEPTION 'Table inventory_v4_items was not created';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ inventory_v4_items table created successfully';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Table Features:';
  RAISE NOTICE '  - User ownership with RLS';
  RAISE NOTICE '  - style_id FK to style_catalog';
  RAISE NOTICE '  - Size with unit support (US/UK/EU)';
  RAISE NOTICE '  - Purchase tracking (price >= 0, currency GBP/USD/EUR)';
  RAISE NOTICE '  - Status workflow (in_stock → listed → sold)';
  RAISE NOTICE '  - Consignment support';
  RAISE NOTICE '';
END $$;
