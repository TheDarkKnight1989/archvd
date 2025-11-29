-- ============================================================================
-- Add New Sale Platforms
-- Date: 2025-11-28
-- ============================================================================
--
-- This migration adds new platform options to the sale_platform enum:
-- - goat (Alias/GOAT)
-- - instagram
-- - tiktok (TikTok Shop)
-- - vinted
-- - depop
--
-- ============================================================================

-- Add new values to the sale_platform enum
DO $$
BEGIN
  -- Add goat if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'goat'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_platform')
  ) THEN
    ALTER TYPE sale_platform ADD VALUE 'goat';
    RAISE NOTICE '✓ Added goat to sale_platform enum';
  ELSE
    RAISE NOTICE '- goat already exists in sale_platform enum';
  END IF;

  -- Add instagram if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'instagram'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_platform')
  ) THEN
    ALTER TYPE sale_platform ADD VALUE 'instagram';
    RAISE NOTICE '✓ Added instagram to sale_platform enum';
  ELSE
    RAISE NOTICE '- instagram already exists in sale_platform enum';
  END IF;

  -- Add tiktok if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'tiktok'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_platform')
  ) THEN
    ALTER TYPE sale_platform ADD VALUE 'tiktok';
    RAISE NOTICE '✓ Added tiktok to sale_platform enum';
  ELSE
    RAISE NOTICE '- tiktok already exists in sale_platform enum';
  END IF;

  -- Add vinted if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'vinted'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_platform')
  ) THEN
    ALTER TYPE sale_platform ADD VALUE 'vinted';
    RAISE NOTICE '✓ Added vinted to sale_platform enum';
  ELSE
    RAISE NOTICE '- vinted already exists in sale_platform enum';
  END IF;

  -- Add depop if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'depop'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_platform')
  ) THEN
    ALTER TYPE sale_platform ADD VALUE 'depop';
    RAISE NOTICE '✓ Added depop to sale_platform enum';
  ELSE
    RAISE NOTICE '- depop already exists in sale_platform enum';
  END IF;
END $$;

-- Verify all values exist
DO $$
DECLARE
  platform_values text[];
BEGIN
  SELECT array_agg(enumlabel ORDER BY enumlabel)
  INTO platform_values
  FROM pg_enum
  WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_platform');

  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'SALE PLATFORM ENUM VALUES';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Available platforms: %', platform_values;
  RAISE NOTICE '';
END $$;
