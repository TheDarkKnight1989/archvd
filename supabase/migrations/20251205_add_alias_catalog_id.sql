-- ============================================================================
-- Add Alias Catalog ID to Product Catalog
-- Date: 2025-12-05
-- Purpose: Store Alias catalog ID for product mapping
-- ============================================================================

-- Add alias_catalog_id column to product_catalog
ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS alias_catalog_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_catalog_alias_catalog_id
  ON public.product_catalog(alias_catalog_id)
  WHERE alias_catalog_id IS NOT NULL;

-- Add unique constraint to prevent duplicate mappings
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_catalog_alias_catalog_id_unique
  ON public.product_catalog(alias_catalog_id)
  WHERE alias_catalog_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.product_catalog.alias_catalog_id IS 'Alias catalog ID for product mapping (e.g., "air-jordan-1-retro-high-og-panda-dd1391-100")';

-- ============================================================================
-- Done!
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ alias_catalog_id column added to product_catalog';
  RAISE NOTICE '📝 Column is indexed and enforces uniqueness';
END $$;
