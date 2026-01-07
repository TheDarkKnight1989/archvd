-- ============================================================================
-- INVENTORY V4 - LISTINGS & SOURCES TABLES
-- ============================================================================
--
-- Purpose: Multi-platform listing tracking and purchase source management
-- Date: 2025-12-13
--
-- New tables:
--   1. inventory_v4_listings - Track listings across multiple platforms
--   2. user_purchase_sources - Per-user custom purchase sources
--
-- Schema changes:
--   - Add purchase_source to inventory_v4_items
--
-- Note: Item status is now PHYSICAL STATE ONLY (in_stock, consigned, sold, removed).
-- "Listed" is derived from this listings table, not stored on items.
-- See: 20251213_simplify_item_status.sql for the status cleanup migration.
--
-- ============================================================================

-- ============================================================================
-- 1. ADD PURCHASE_SOURCE TO INVENTORY_V4_ITEMS + COMPOSITE KEY FOR OWNERSHIP
-- ============================================================================

-- Add purchase_source with integrity constraints
ALTER TABLE inventory_v4_items
ADD COLUMN IF NOT EXISTS purchase_source TEXT;

-- Add CHECK constraint for purchase_source (no blanks, max 200 chars)
-- Using DO block since ALTER TABLE ADD CONSTRAINT IF NOT EXISTS isn't supported
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_v4_items_purchase_source_check'
  ) THEN
    ALTER TABLE inventory_v4_items
    ADD CONSTRAINT inventory_v4_items_purchase_source_check CHECK (
      purchase_source IS NULL
      OR (length(btrim(purchase_source)) > 0 AND length(purchase_source) <= 200)
    );
  END IF;
END $$;

COMMENT ON COLUMN inventory_v4_items.purchase_source IS
  'Where the item was purchased (Nike, End, StockX, etc.). Max 200 chars, no blank values.';

-- Add unique constraint on (id, user_id) for composite FK ownership enforcement
-- This enables listings to reference both columns, making ownership bypass impossible
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_v4_items_id_user_id
  ON inventory_v4_items(id, user_id);

-- ============================================================================
-- 2. CREATE USER_PURCHASE_SOURCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_purchase_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Source name with integrity constraints
  name TEXT NOT NULL
    CHECK (length(btrim(name)) > 0)  -- Prevent blank/whitespace-only
    CHECK (length(name) <= 200),     -- Reasonable max length

  -- Optional metadata
  website_url TEXT,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_user_purchase_sources_user_id
  ON user_purchase_sources(user_id);

-- Case-insensitive unique constraint (prevents "End" and "end" duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_purchase_sources_unique_name
  ON user_purchase_sources(user_id, lower(btrim(name)));

-- Updated_at trigger for sources
CREATE OR REPLACE FUNCTION update_user_purchase_sources_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_purchase_sources_updated_at ON user_purchase_sources;

CREATE TRIGGER user_purchase_sources_updated_at
  BEFORE UPDATE ON user_purchase_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_user_purchase_sources_timestamp();

-- RLS
ALTER TABLE user_purchase_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sources" ON user_purchase_sources;
CREATE POLICY "Users can view own sources"
  ON user_purchase_sources FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sources" ON user_purchase_sources;
CREATE POLICY "Users can insert own sources"
  ON user_purchase_sources FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sources" ON user_purchase_sources;
CREATE POLICY "Users can update own sources"
  ON user_purchase_sources FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sources" ON user_purchase_sources;
CREATE POLICY "Users can delete own sources"
  ON user_purchase_sources FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE user_purchase_sources IS
  'User-defined purchase sources (retailers, resale platforms, etc.)';

-- ============================================================================
-- 3. CREATE INVENTORY_V4_LISTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References with composite FK for ownership enforcement
  item_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Composite FK: enforces item_id + user_id match (ownership at DB level)
  -- This makes ownership bypass impossible, even by bugs
  CONSTRAINT fk_listings_item_owner
    FOREIGN KEY (item_id, user_id)
    REFERENCES inventory_v4_items(id, user_id)
    ON DELETE CASCADE,

  -- Platform identification with integrity constraints
  platform TEXT NOT NULL CHECK (platform IN (
    'stockx',
    'alias',
    'ebay',
    'vinted',
    'depop',
    'tiktok',
    'instagram',
    'shopify',
    'custom'
  )),
  platform_name TEXT, -- Required for custom platforms (enforced via constraint below)

  -- Listing details
  listed_price NUMERIC(10,2) NOT NULL CHECK (listed_price >= 0),
  listed_currency TEXT NOT NULL DEFAULT 'GBP' CHECK (listed_currency IN ('GBP', 'USD', 'EUR')),

  -- External references (optional, but no empty strings)
  listing_url TEXT CHECK (listing_url IS NULL OR listing_url ~* '^https?://'),
  external_listing_id TEXT CHECK (
    external_listing_id IS NULL OR length(btrim(external_listing_id)) > 0
  ),

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',     -- Currently listed
    'sold',       -- Sold through this listing
    'expired',    -- Listing expired
    'cancelled',  -- User cancelled listing
    'paused'      -- Temporarily paused
  )),

  -- Sale tracking (if sold)
  sold_price NUMERIC(10,2) CHECK (sold_price IS NULL OR sold_price >= 0),
  sold_at TIMESTAMPTZ,

  -- Timestamps
  listed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraint: platform_name rules
  --   - custom platforms MUST have a non-empty platform_name
  --   - non-custom platforms MUST have platform_name = NULL (prevents garbage data)
  CONSTRAINT inventory_v4_listings_platform_name_check CHECK (
    (platform = 'custom' AND platform_name IS NOT NULL AND length(btrim(platform_name)) > 0)
    OR (platform <> 'custom' AND platform_name IS NULL)
  ),

  -- Constraint: sold status requires both sold_at AND sold_price (clean P/L accounting)
  CONSTRAINT inventory_v4_listings_sold_state_check CHECK (
    (status <> 'sold') OR (sold_at IS NOT NULL AND sold_price IS NOT NULL)
  ),

  -- Constraint: sold_at/sold_price only allowed when status = 'sold'
  CONSTRAINT inventory_v4_listings_sold_fields_check CHECK (
    (status = 'sold') OR (sold_at IS NULL AND sold_price IS NULL)
  )
);

-- ============================================================================
-- 4. INDEXES FOR LISTINGS
-- ============================================================================

-- User's listings
CREATE INDEX IF NOT EXISTS idx_inventory_v4_listings_user_id
  ON inventory_v4_listings(user_id);

-- Item's listings (for join)
CREATE INDEX IF NOT EXISTS idx_inventory_v4_listings_item_id
  ON inventory_v4_listings(item_id);

-- Hot path #1: Active listings per item (badge UI - hottest path)
CREATE INDEX IF NOT EXISTS idx_inventory_v4_listings_item_active
  ON inventory_v4_listings(item_id)
  WHERE status = 'active';

-- Hot path #2: Active OR paused listings per item (listing management)
CREATE INDEX IF NOT EXISTS idx_inventory_v4_listings_item_status
  ON inventory_v4_listings(item_id, status)
  WHERE status IN ('active', 'paused');

-- Active listings per user
CREATE INDEX IF NOT EXISTS idx_inventory_v4_listings_user_active
  ON inventory_v4_listings(user_id, status) WHERE status = 'active';

-- Platform lookup
CREATE INDEX IF NOT EXISTS idx_inventory_v4_listings_platform
  ON inventory_v4_listings(platform);

-- External ID lookup (for sync)
CREATE INDEX IF NOT EXISTS idx_inventory_v4_listings_external_id
  ON inventory_v4_listings(platform, external_listing_id)
  WHERE external_listing_id IS NOT NULL;

-- ============================================================================
-- 5. UNIQUENESS CONSTRAINTS FOR LISTINGS
-- ============================================================================

-- Prevent duplicate external listings for same user/platform
-- (Critical for API sync stability)
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_v4_listings_unique_external
  ON inventory_v4_listings(user_id, platform, external_listing_id)
  WHERE external_listing_id IS NOT NULL;

-- Prevent multiple active/paused listings for same item on same platform
-- (Prevents badge spam and weird UI states; still allows history)
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_v4_listings_unique_active
  ON inventory_v4_listings(
    item_id,
    platform,
    COALESCE(lower(btrim(platform_name)), '')
  )
  WHERE status IN ('active', 'paused');

-- ============================================================================
-- 6. UPDATED_AT TRIGGER FOR LISTINGS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_inventory_v4_listings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_v4_listings_updated_at ON inventory_v4_listings;

CREATE TRIGGER inventory_v4_listings_updated_at
  BEFORE UPDATE ON inventory_v4_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_v4_listings_timestamp();

-- ============================================================================
-- 7. RLS FOR LISTINGS
-- ============================================================================

ALTER TABLE inventory_v4_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own listings" ON inventory_v4_listings;
CREATE POLICY "Users can view own listings"
  ON inventory_v4_listings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own listings" ON inventory_v4_listings;
CREATE POLICY "Users can insert own listings"
  ON inventory_v4_listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own listings" ON inventory_v4_listings;
CREATE POLICY "Users can update own listings"
  ON inventory_v4_listings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own listings" ON inventory_v4_listings;
CREATE POLICY "Users can delete own listings"
  ON inventory_v4_listings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 9. HELPER VIEW: ITEMS WITH ACTIVE LISTING COUNT
-- ============================================================================

CREATE OR REPLACE VIEW inventory_v4_items_with_listings AS
SELECT
  i.*,
  COALESCE(l.active_listing_count, 0) AS active_listing_count,
  l.listing_platforms
FROM inventory_v4_items i
LEFT JOIN (
  SELECT
    item_id,
    COUNT(*) AS active_listing_count,
    -- Include custom platform names for proper badge rendering
    ARRAY_AGG(DISTINCT
      CASE WHEN platform = 'custom' THEN platform_name ELSE platform END
    ) AS listing_platforms
  FROM inventory_v4_listings
  WHERE status = 'active'
  GROUP BY item_id
) l ON l.item_id = i.id;

COMMENT ON VIEW inventory_v4_items_with_listings IS
  'Items joined with their active listing count and platforms (includes custom platform names)';

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================

COMMENT ON TABLE inventory_v4_listings IS
  'Multi-platform listing tracking for inventory items';

COMMENT ON COLUMN inventory_v4_listings.platform IS
  'Platform identifier: stockx, alias, ebay, vinted, depop, tiktok, instagram, shopify, or custom';

COMMENT ON COLUMN inventory_v4_listings.platform_name IS
  'Display name for custom platforms (required when platform = custom, must be NULL otherwise)';

COMMENT ON COLUMN inventory_v4_listings.external_listing_id IS
  'Platform-specific listing ID for API sync';

COMMENT ON COLUMN inventory_v4_listings.status IS
  'Listing status: active, sold, expired, cancelled, paused';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory_v4_listings'
  ) THEN
    RAISE EXCEPTION 'Table inventory_v4_listings was not created';
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_purchase_sources'
  ) THEN
    RAISE EXCEPTION 'Table user_purchase_sources was not created';
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'inventory_v4_items' AND column_name = 'purchase_source'
  ) THEN
    RAISE EXCEPTION 'Column purchase_source was not added to inventory_v4_items';
  END IF;

  -- Verify composite ownership index on inventory_v4_items
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_inventory_v4_items_id_user_id'
  ) THEN
    RAISE EXCEPTION 'Composite ownership index not created on inventory_v4_items';
  END IF;

  -- Verify uniqueness indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_inventory_v4_listings_unique_external'
  ) THEN
    RAISE EXCEPTION 'External listing uniqueness index not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_inventory_v4_listings_unique_active'
  ) THEN
    RAISE EXCEPTION 'Active listing uniqueness index not created';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ Listings and sources migration complete';
  RAISE NOTICE '';
  RAISE NOTICE '📊 New tables:';
  RAISE NOTICE '  - inventory_v4_listings (multi-platform listing tracking)';
  RAISE NOTICE '  - user_purchase_sources (per-user custom sources)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Schema changes:';
  RAISE NOTICE '  - Added purchase_source to inventory_v4_items';
  RAISE NOTICE '  - Added composite index (id, user_id) for ownership FK';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Security & Integrity:';
  RAISE NOTICE '  - Composite FK ownership enforcement (item_id + user_id)';
  RAISE NOTICE '  - Platform value constraints';
  RAISE NOTICE '  - Platform name required for custom, NULL for others';
  RAISE NOTICE '  - Case-insensitive source uniqueness';
  RAISE NOTICE '  - Unique external listing IDs per user/platform';
  RAISE NOTICE '  - One active listing per item/platform';
  RAISE NOTICE '  - Sold-state integrity (sold_at + sold_price required when sold)';
  RAISE NOTICE '  - No empty external_listing_id strings';
  RAISE NOTICE '  - URL format validation';
  RAISE NOTICE '  - Source name length/blank validation';
  RAISE NOTICE '  - Purchase source max 200 chars, no blanks';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Views:';
  RAISE NOTICE '  - inventory_v4_items_with_listings (items + listing count)';
END $$;
