-- Migration: Add missing columns to stockx_products and product_catalog
-- Date: 2025-11-28
-- Purpose: Align database schema with code expectations for AddItemModal and catalog system

-- ============================================================================
-- Add missing columns to stockx_products
-- ============================================================================

-- Add silhouette column (nullable for now, can be populated later)
ALTER TABLE stockx_products
ADD COLUMN IF NOT EXISTS silhouette TEXT;

COMMENT ON COLUMN stockx_products.silhouette IS 'Product silhouette/model (e.g., "Air Jordan 1 High", "Dunk Low"). Nullable, populated when available.';

-- ============================================================================
-- Add missing columns to product_catalog
-- ============================================================================

-- Add category column
ALTER TABLE product_catalog
ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN product_catalog.category IS 'Product category from source (e.g., "sneakers", "apparel", "accessories")';

-- Add gender column if it doesn't exist
ALTER TABLE product_catalog
ADD COLUMN IF NOT EXISTS gender TEXT;

COMMENT ON COLUMN product_catalog.gender IS 'Product gender classification (e.g., "men", "women", "kids", "unisex")';

-- Add stockx_product_id for linking to StockX data
ALTER TABLE product_catalog
ADD COLUMN IF NOT EXISTS stockx_product_id TEXT;

COMMENT ON COLUMN product_catalog.stockx_product_id IS 'StockX product ID for market data linking (if product exists on StockX)';

-- ============================================================================
-- Create indexes for better query performance
-- ============================================================================

-- Index on category for filtering
CREATE INDEX IF NOT EXISTS idx_product_catalog_category
ON product_catalog(category)
WHERE category IS NOT NULL;

-- Index on gender for filtering
CREATE INDEX IF NOT EXISTS idx_product_catalog_gender
ON product_catalog(gender)
WHERE gender IS NOT NULL;

-- Index on silhouette for filtering
CREATE INDEX IF NOT EXISTS idx_stockx_products_silhouette
ON stockx_products(silhouette)
WHERE silhouette IS NOT NULL;

-- Index on stockx_product_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_product_catalog_stockx_product_id
ON product_catalog(stockx_product_id)
WHERE stockx_product_id IS NOT NULL;

-- ============================================================================
-- Verify the changes
-- ============================================================================

-- Log the completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully';
  RAISE NOTICE 'Added columns:';
  RAISE NOTICE '  - stockx_products.silhouette';
  RAISE NOTICE '  - product_catalog.category';
  RAISE NOTICE '  - product_catalog.gender';
  RAISE NOTICE '  - product_catalog.stockx_product_id';
  RAISE NOTICE 'Created indexes for optimized queries';
END $$;
