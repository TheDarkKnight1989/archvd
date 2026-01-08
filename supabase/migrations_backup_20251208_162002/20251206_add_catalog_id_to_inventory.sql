-- Fix BUG #16: Add catalog_id column to Inventory table
-- This column links inventory items to product_catalog for brand/model/image data

ALTER TABLE public."Inventory"
  ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES public.product_catalog(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_inventory_catalog_id
  ON public."Inventory"(catalog_id);

-- Add comment
COMMENT ON COLUMN public."Inventory".catalog_id IS
  'Foreign key to product_catalog table. Provides brand, model, image, and other product metadata.';
