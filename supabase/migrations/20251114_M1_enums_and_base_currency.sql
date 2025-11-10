-- ============================================================================
-- M1: Enums & Profiles Base Currency
-- Created: 2025-01-14
-- Purpose: Production-grade foundations with backwards compatibility
-- ============================================================================

-- ============================================================================
-- 1. Create Enums
-- ============================================================================

-- Item status enum (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_status') THEN
    CREATE TYPE item_status AS ENUM ('active', 'listed', 'worn', 'sold', 'archived');
  ELSE
    -- Ensure 'archived' exists in the enum
    BEGIN
      ALTER TYPE item_status ADD VALUE IF NOT EXISTS 'archived';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

COMMENT ON TYPE item_status IS 'Inventory item lifecycle states: active (in collection), listed (for sale), worn (used), sold (realized), archived (removed from active view)';

-- Sale platform enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sale_platform') THEN
    CREATE TYPE sale_platform AS ENUM ('ebay', 'stockx', 'goat', 'private', 'other');
  END IF;
END $$;

COMMENT ON TYPE sale_platform IS 'Platforms where items are sold';

-- Subscription interval enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interval_unit') THEN
    CREATE TYPE interval_unit AS ENUM ('monthly', 'annual');
  END IF;
END $$;

COMMENT ON TYPE interval_unit IS 'Subscription billing intervals';

-- ============================================================================
-- 2. Extend Profiles with Base Currency
-- ============================================================================

DO $$
BEGIN
  -- Add base_currency if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'base_currency'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN base_currency CHAR(3) NOT NULL DEFAULT 'GBP'
    CHECK (base_currency IN ('GBP', 'EUR', 'USD'));

    COMMENT ON COLUMN public.profiles.base_currency IS 'User accounting base currency (ISO 4217 code)';
  END IF;
END $$;

-- ============================================================================
-- 3. Backfill Existing Users
-- ============================================================================

-- Ensure all existing profiles have base_currency set
UPDATE public.profiles
SET base_currency = 'GBP'
WHERE base_currency IS NULL OR base_currency = '';

-- ============================================================================
-- 4. Ensure Inventory Uses item_status Enum
-- ============================================================================

-- Check if inventory.status is already the enum type
DO $$
DECLARE
  status_type TEXT;
BEGIN
  SELECT udt_name INTO status_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'Inventory'
  AND column_name = 'status';

  IF status_type != 'item_status' THEN
    -- Convert to enum if it's currently text
    ALTER TABLE public."Inventory"
    ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE public."Inventory"
    ALTER COLUMN status TYPE item_status
    USING status::item_status;

    ALTER TABLE public."Inventory"
    ALTER COLUMN status SET DEFAULT 'active'::item_status;

    RAISE NOTICE 'Converted Inventory.status to item_status enum';
  ELSE
    RAISE NOTICE 'Inventory.status already using item_status enum';
  END IF;
END $$;

-- ============================================================================
-- 5. Create Indexes for Performance
-- ============================================================================

-- Inventory indexes (if not exist)
CREATE INDEX IF NOT EXISTS idx_inventory_user_status_sku
ON public."Inventory"(user_id, status, sku);

CREATE INDEX IF NOT EXISTS idx_inventory_user_created
ON public."Inventory"(user_id, created_at DESC);

-- Audit events index (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_events') THEN
    CREATE INDEX IF NOT EXISTS idx_audit_events_user_created
    ON public.audit_events(user_id, created_at DESC);
  END IF;
END $$;

-- Watchlist items index (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'watchlist_items') THEN
    CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_sku
    ON public.watchlist_items(watchlist_id, sku);
  END IF;
END $$;

-- Product market prices index (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_market_prices') THEN
    CREATE INDEX IF NOT EXISTS idx_product_market_prices_sku_size_date
    ON public.product_market_prices(sku, size, as_of DESC);
  END IF;
END $$;

-- ============================================================================
-- 6. Migration Verification
-- ============================================================================

DO $$
DECLARE
  enum_count INTEGER;
  profile_count INTEGER;
  index_count INTEGER;
BEGIN
  -- Check enums
  SELECT COUNT(*) INTO enum_count
  FROM pg_type
  WHERE typname IN ('item_status', 'sale_platform', 'interval_unit');

  RAISE NOTICE 'Created % enum types', enum_count;

  -- Check base_currency column
  SELECT COUNT(*) INTO profile_count
  FROM public.profiles
  WHERE base_currency IS NOT NULL;

  RAISE NOTICE 'Profiles with base_currency: %', profile_count;

  -- Check indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%';

  RAISE NOTICE 'Total custom indexes: %', index_count;
END $$;

-- ============================================================================
-- END OF M1 MIGRATION
-- ============================================================================
