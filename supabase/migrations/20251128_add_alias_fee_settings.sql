-- ============================================================================
-- Add Alias Fee Configuration Settings
-- Date: 2025-11-28
-- ============================================================================
--
-- This migration adds Alias (GOAT) seller fee configuration fields to the
-- user_settings table:
-- - alias_region: Seller's region (UK, DE, NL, FR, AT, BE, IT, ES)
-- - alias_shipping_method: Shipping method (dropoff or prepaid)
-- - alias_commission_fee: Custom commission fee percentage (default 9.5%)
--
-- ============================================================================

-- Add alias_region column
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS alias_region TEXT DEFAULT 'uk';

-- Add alias_shipping_method column
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS alias_shipping_method TEXT DEFAULT 'dropoff';

-- Add alias_commission_fee column
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS alias_commission_fee NUMERIC(5,2) DEFAULT 9.5;

-- Add check constraints
DO $$
BEGIN
  -- Check if constraint exists before adding
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alias_region_check'
  ) THEN
    ALTER TABLE user_settings
    ADD CONSTRAINT alias_region_check
    CHECK (alias_region IN ('uk', 'de', 'nl', 'fr', 'at', 'be', 'it', 'es'));

    RAISE NOTICE '✓ Added alias_region_check constraint';
  ELSE
    RAISE NOTICE '- alias_region_check constraint already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alias_shipping_method_check'
  ) THEN
    ALTER TABLE user_settings
    ADD CONSTRAINT alias_shipping_method_check
    CHECK (alias_shipping_method IN ('dropoff', 'prepaid'));

    RAISE NOTICE '✓ Added alias_shipping_method_check constraint';
  ELSE
    RAISE NOTICE '- alias_shipping_method_check constraint already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alias_commission_fee_check'
  ) THEN
    ALTER TABLE user_settings
    ADD CONSTRAINT alias_commission_fee_check
    CHECK (alias_commission_fee >= 0 AND alias_commission_fee <= 100);

    RAISE NOTICE '✓ Added alias_commission_fee_check constraint';
  ELSE
    RAISE NOTICE '- alias_commission_fee_check constraint already exists';
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN user_settings.alias_region IS 'Seller region for Alias (GOAT) fee calculation';
COMMENT ON COLUMN user_settings.alias_shipping_method IS 'Shipping method for Alias (GOAT) - dropoff or prepaid';
COMMENT ON COLUMN user_settings.alias_commission_fee IS 'Custom commission fee percentage for Alias (GOAT), default 9.5%';

-- Verify columns exist
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'user_settings'
    AND column_name IN ('alias_region', 'alias_shipping_method', 'alias_commission_fee');

  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'ALIAS FEE SETTINGS MIGRATION';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Columns added: %/3', col_count;
  RAISE NOTICE '';
END $$;
