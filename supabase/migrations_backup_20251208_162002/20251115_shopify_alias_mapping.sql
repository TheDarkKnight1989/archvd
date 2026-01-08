-- ============================================================================
-- Shopify → Alias Mapping Enhancement
-- Adds fields to support Shopify import and Alias product mapping
-- ============================================================================

-- Add columns to inventory_alias_links for better product tracking
ALTER TABLE public.inventory_alias_links
  ADD COLUMN IF NOT EXISTS alias_product_id TEXT,
  ADD COLUMN IF NOT EXISTS alias_product_sku TEXT,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

COMMENT ON COLUMN public.inventory_alias_links.alias_product_id IS 'Alias product template ID for matching';
COMMENT ON COLUMN public.inventory_alias_links.alias_product_sku IS 'Alias product SKU for matching';
COMMENT ON COLUMN public.inventory_alias_links.last_sync_at IS 'Last time this mapping was synced';

-- Create index on alias_product_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_inventory_alias_links_product_id
  ON public.inventory_alias_links(alias_product_id);

-- Create index on alias_product_sku for faster lookups
CREATE INDEX IF NOT EXISTS idx_inventory_alias_links_product_sku
  ON public.inventory_alias_links(alias_product_sku);

-- ============================================================================
-- Unmatched SKUs Log
-- Tracks SKUs that couldn't be matched to Alias products
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alias_unmatched_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES public."Inventory"(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  reason TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.alias_unmatched_log IS 'Log of SKUs that could not be matched to Alias products';

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_alias_unmatched_log_inventory_id
  ON public.alias_unmatched_log(inventory_id);

CREATE INDEX IF NOT EXISTS idx_alias_unmatched_log_sku
  ON public.alias_unmatched_log(sku);

CREATE INDEX IF NOT EXISTS idx_alias_unmatched_log_resolved
  ON public.alias_unmatched_log(resolved_at) WHERE resolved_at IS NULL;

-- RLS Policies
ALTER TABLE public.alias_unmatched_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own unmatched SKUs
CREATE POLICY "Users can view their own unmatched SKUs"
  ON public.alias_unmatched_log
  FOR SELECT
  TO authenticated
  USING (
    inventory_id IN (
      SELECT id FROM public."Inventory"
      WHERE user_id = auth.uid()
    )
  );

-- Service role can manage all unmatched SKUs
CREATE POLICY "Service role can manage unmatched SKUs"
  ON public.alias_unmatched_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Add source and source_id to Inventory table (if not exists)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Inventory'
      AND column_name = 'source'
  ) THEN
    ALTER TABLE public."Inventory"
      ADD COLUMN source TEXT DEFAULT 'manual',
      ADD COLUMN source_id TEXT;

    CREATE INDEX idx_inventory_source ON public."Inventory"(source);
    CREATE INDEX idx_inventory_source_id ON public."Inventory"(source_id);

    COMMENT ON COLUMN public."Inventory".source IS 'Source of inventory item (manual, shopify, import, etc.)';
    COMMENT ON COLUMN public."Inventory".source_id IS 'External ID from source system';
  END IF;
END $$;

-- ============================================================================
-- Helper View: Inventory with Alias Mapping Status
-- ============================================================================

CREATE OR REPLACE VIEW public.inventory_with_alias_status AS
SELECT
  i.*,
  ial.id AS alias_link_id,
  ial.alias_product_id,
  ial.alias_product_sku,
  ial.alias_listing_id,
  ial.alias_ask_price,
  ial.last_sync_at AS alias_last_sync_at,
  al.status AS alias_listing_status,
  CASE
    WHEN ial.id IS NOT NULL THEN 'mapped'
    WHEN aul.id IS NOT NULL THEN 'unmatched'
    ELSE 'unmapped'
  END AS alias_mapping_status
FROM public."Inventory" i
LEFT JOIN public.inventory_alias_links ial ON i.id = ial.inventory_id
LEFT JOIN public.alias_listings al ON ial.alias_listing_id = al.id
LEFT JOIN public.alias_unmatched_log aul ON i.id = aul.inventory_id AND aul.resolved_at IS NULL
WHERE i.deleted_at IS NULL;

COMMENT ON VIEW public.inventory_with_alias_status IS 'Inventory items with Alias mapping status';

-- Grant access to view
GRANT SELECT ON public.inventory_with_alias_status TO authenticated;
GRANT SELECT ON public.inventory_with_alias_status TO service_role;
