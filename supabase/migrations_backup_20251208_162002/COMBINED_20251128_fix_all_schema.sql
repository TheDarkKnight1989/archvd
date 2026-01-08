-- ============================================================================
-- COMBINED MIGRATION: Fix All Schema Issues
-- Date: 2025-11-28
-- ============================================================================
--
-- This migration fixes all schema issues preventing the catalog system from working:
-- 1. Adds missing 'id' UUID column to product_catalog
-- 2. Adds missing columns: category, gender, stockx_product_id to product_catalog
-- 3. Adds missing 'silhouette' column to stockx_products
-- 4. Adds missing 'size_display' and 'size_chart' columns to stockx_variants
-- 5. Creates all necessary indexes for performance
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
-- 4. Check the output for verification messages
--
-- ============================================================================

-- ============================================================================
-- PART 1: Fix product_catalog table
-- ============================================================================

-- Add id column (UUID, UNIQUE, NOT NULL)
-- NOTE: We keep 'sku' as the primary key because other tables have FK references to it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_catalog' AND column_name = 'id'
  ) THEN
    ALTER TABLE product_catalog
    ADD COLUMN id UUID DEFAULT gen_random_uuid() NOT NULL;

    RAISE NOTICE '✓ Added id column to product_catalog';
  ELSE
    RAISE NOTICE '- id column already exists in product_catalog';
  END IF;
END $$;

-- Ensure all rows have UUIDs
UPDATE product_catalog
SET id = gen_random_uuid()
WHERE id IS NULL;

-- Add unique constraint on id
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

    RAISE NOTICE '✓ Added unique constraint on id';
  ELSE
    RAISE NOTICE '- Unique constraint on id already exists';
  END IF;
END $$;

-- Add category column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_catalog' AND column_name = 'category'
  ) THEN
    ALTER TABLE product_catalog
    ADD COLUMN category TEXT;

    RAISE NOTICE '✓ Added category column to product_catalog';
  ELSE
    RAISE NOTICE '- category column already exists in product_catalog';
  END IF;
END $$;

-- Add gender column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_catalog' AND column_name = 'gender'
  ) THEN
    ALTER TABLE product_catalog
    ADD COLUMN gender TEXT;

    RAISE NOTICE '✓ Added gender column to product_catalog';
  ELSE
    RAISE NOTICE '- gender column already exists in product_catalog';
  END IF;
END $$;

-- Add stockx_product_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_catalog' AND column_name = 'stockx_product_id'
  ) THEN
    ALTER TABLE product_catalog
    ADD COLUMN stockx_product_id TEXT;

    RAISE NOTICE '✓ Added stockx_product_id column to product_catalog';
  ELSE
    RAISE NOTICE '- stockx_product_id column already exists in product_catalog';
  END IF;
END $$;

-- ============================================================================
-- PART 2: Fix stockx_products table
-- ============================================================================

-- Add silhouette column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stockx_products' AND column_name = 'silhouette'
  ) THEN
    ALTER TABLE stockx_products
    ADD COLUMN silhouette TEXT;

    RAISE NOTICE '✓ Added silhouette column to stockx_products';
  ELSE
    RAISE NOTICE '- silhouette column already exists in stockx_products';
  END IF;
END $$;

-- ============================================================================
-- PART 3: Fix stockx_variants table
-- ============================================================================

-- Add size_display column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stockx_variants' AND column_name = 'size_display'
  ) THEN
    ALTER TABLE stockx_variants
    ADD COLUMN size_display TEXT;

    RAISE NOTICE '✓ Added size_display column to stockx_variants';
  ELSE
    RAISE NOTICE '- size_display column already exists in stockx_variants';
  END IF;
END $$;

-- Add size_chart column (JSONB for structured size data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stockx_variants' AND column_name = 'size_chart'
  ) THEN
    ALTER TABLE stockx_variants
    ADD COLUMN size_chart JSONB;

    RAISE NOTICE '✓ Added size_chart column to stockx_variants';
  ELSE
    RAISE NOTICE '- size_chart column already exists in stockx_variants';
  END IF;
END $$;

-- ============================================================================
-- PART 4: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_catalog_id
ON product_catalog(id);

CREATE INDEX IF NOT EXISTS idx_product_catalog_category
ON product_catalog(category) WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_catalog_gender
ON product_catalog(gender) WHERE gender IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_catalog_stockx_product_id
ON product_catalog(stockx_product_id) WHERE stockx_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stockx_products_silhouette
ON stockx_products(silhouette) WHERE silhouette IS NOT NULL;

-- ============================================================================
-- PART 5: Verification
-- ============================================================================

DO $$
DECLARE
  product_catalog_id_exists BOOLEAN;
  product_catalog_category_exists BOOLEAN;
  product_catalog_gender_exists BOOLEAN;
  product_catalog_stockx_id_exists BOOLEAN;
  stockx_products_silhouette_exists BOOLEAN;
  stockx_variants_size_display_exists BOOLEAN;
  stockx_variants_size_chart_exists BOOLEAN;
  all_good BOOLEAN := true;
BEGIN
  -- Check product_catalog columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_catalog' AND column_name = 'id'
  ) INTO product_catalog_id_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_catalog' AND column_name = 'category'
  ) INTO product_catalog_category_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_catalog' AND column_name = 'gender'
  ) INTO product_catalog_gender_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_catalog' AND column_name = 'stockx_product_id'
  ) INTO product_catalog_stockx_id_exists;

  -- Check stockx_products columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stockx_products' AND column_name = 'silhouette'
  ) INTO stockx_products_silhouette_exists;

  -- Check stockx_variants columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stockx_variants' AND column_name = 'size_display'
  ) INTO stockx_variants_size_display_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stockx_variants' AND column_name = 'size_chart'
  ) INTO stockx_variants_size_chart_exists;

  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'MIGRATION VERIFICATION';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'product_catalog.id: %', CASE WHEN product_catalog_id_exists THEN 'YES ✓' ELSE 'NO ✗' END;
  RAISE NOTICE 'product_catalog.category: %', CASE WHEN product_catalog_category_exists THEN 'YES ✓' ELSE 'NO ✗' END;
  RAISE NOTICE 'product_catalog.gender: %', CASE WHEN product_catalog_gender_exists THEN 'YES ✓' ELSE 'NO ✗' END;
  RAISE NOTICE 'product_catalog.stockx_product_id: %', CASE WHEN product_catalog_stockx_id_exists THEN 'YES ✓' ELSE 'NO ✗' END;
  RAISE NOTICE 'stockx_products.silhouette: %', CASE WHEN stockx_products_silhouette_exists THEN 'YES ✓' ELSE 'NO ✗' END;
  RAISE NOTICE 'stockx_variants.size_display: %', CASE WHEN stockx_variants_size_display_exists THEN 'YES ✓' ELSE 'NO ✗' END;
  RAISE NOTICE 'stockx_variants.size_chart: %', CASE WHEN stockx_variants_size_chart_exists THEN 'YES ✓' ELSE 'NO ✗' END;
  RAISE NOTICE '';

  all_good := product_catalog_id_exists
    AND product_catalog_category_exists
    AND product_catalog_gender_exists
    AND product_catalog_stockx_id_exists
    AND stockx_products_silhouette_exists
    AND stockx_variants_size_display_exists
    AND stockx_variants_size_chart_exists;

  IF all_good THEN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'SUCCESS! All schema fixes applied ✓';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Test adding an item via the Add Item modal';
    RAISE NOTICE '2. Verify images appear from Alias';
    RAISE NOTICE '3. Verify market data (prices) appear';
    RAISE NOTICE '';
  ELSE
    RAISE WARNING '===========================================';
    RAISE WARNING 'ISSUES DETECTED - Some columns missing!';
    RAISE WARNING '===========================================';
    RAISE WARNING 'Please check the errors above';
  END IF;
END $$;
