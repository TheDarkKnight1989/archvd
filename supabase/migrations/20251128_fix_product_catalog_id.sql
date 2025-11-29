-- Migration: Add id column to product_catalog table
-- Date: 2025-11-28
-- Purpose: Add missing id UUID column to product_catalog
-- Impact: Adds id column as unique identifier, keeps sku as primary key
--
-- NOTE: We're NOT changing the primary key from sku to id because:
-- - Other tables (product_market_prices, sneaker_market_prices) have foreign keys to sku
-- - Changing the PK would require CASCADE drops and recreating all FK relationships
-- - The table was designed with sku as PK and that works fine
-- - Code just needs an id column to exist, doesn't require it to be the PK

-- ============================================================================
-- Step 1: Add id column with UUID default
-- ============================================================================

-- Add the id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_catalog' AND column_name = 'id'
  ) THEN
    -- Add id column with default UUID generation
    ALTER TABLE product_catalog
    ADD COLUMN id UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE;

    RAISE NOTICE 'Added id column to product_catalog (with UNIQUE constraint)';
  ELSE
    RAISE NOTICE 'id column already exists in product_catalog';
  END IF;
END $$;

-- ============================================================================
-- Step 2: Ensure existing rows have UUIDs (if any were null)
-- ============================================================================

-- Update any null ids with new UUIDs (safety check)
UPDATE product_catalog
SET id = gen_random_uuid()
WHERE id IS NULL;

-- ============================================================================
-- Step 3: Add unique constraint on id if not already present
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'product_catalog'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'product_catalog_id_key'
  ) THEN
    ALTER TABLE product_catalog
    ADD CONSTRAINT product_catalog_id_key UNIQUE (id);

    RAISE NOTICE 'Added unique constraint on id';
  ELSE
    RAISE NOTICE 'Unique constraint on id already exists';
  END IF;
END $$;

-- ============================================================================
-- Step 4: Create index on id for better performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_catalog_id ON product_catalog(id);

-- ============================================================================
-- Verify the changes
-- ============================================================================

DO $$
DECLARE
  col_count INTEGER;
  id_unique_count INTEGER;
  sku_pk_count INTEGER;
BEGIN
  -- Check if id column exists
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'product_catalog' AND column_name = 'id';

  -- Check if unique constraint exists on id
  SELECT COUNT(*) INTO id_unique_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_name = 'product_catalog'
    AND tc.constraint_type = 'UNIQUE'
    AND ccu.column_name = 'id';

  -- Verify sku is still the primary key
  SELECT COUNT(*) INTO sku_pk_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_name = 'product_catalog'
    AND tc.constraint_type = 'PRIMARY KEY'
    AND ccu.column_name = 'sku';

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Migration Verification:';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'id column exists: %', CASE WHEN col_count > 0 THEN 'YES ✓' ELSE 'NO ✗' END;
  RAISE NOTICE 'Unique constraint on id: %', CASE WHEN id_unique_count > 0 THEN 'YES ✓' ELSE 'NO ✗' END;
  RAISE NOTICE 'Primary key on sku (preserved): %', CASE WHEN sku_pk_count > 0 THEN 'YES ✓' ELSE 'NO ✗' END;
  RAISE NOTICE '===========================================';

  IF col_count > 0 AND id_unique_count > 0 AND sku_pk_count > 0 THEN
    RAISE NOTICE 'Migration completed successfully! ✓';
    RAISE NOTICE 'product_catalog now has:';
    RAISE NOTICE '  - id (UUID, UNIQUE, NOT NULL) for code compatibility';
    RAISE NOTICE '  - sku (TEXT, PRIMARY KEY) for database relationships';
  ELSE
    RAISE WARNING 'Migration may have issues - check manually';
  END IF;
END $$;
