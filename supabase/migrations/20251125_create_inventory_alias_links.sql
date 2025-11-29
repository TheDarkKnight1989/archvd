-- ============================================================================
-- Create inventory_alias_links table (separate from StockX)
-- ============================================================================
-- Purpose: Link Inventory items to Alias catalog items
-- Design: Parallel to inventory_market_links but Alias-specific
-- Non-destructive: Does NOT modify existing StockX schema
-- ============================================================================

-- Create inventory_alias_links table
CREATE TABLE IF NOT EXISTS public.inventory_alias_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to inventory
  inventory_id UUID NOT NULL REFERENCES public."Inventory"(id) ON DELETE CASCADE,

  -- Alias catalog identifiers (from Alias API)
  alias_catalog_id TEXT NOT NULL,           -- catalog_id from SearchCatalog endpoint
  alias_listing_id TEXT,                     -- listing ID if item is listed on Alias

  -- Product metadata (denormalized for performance)
  alias_sku TEXT,                            -- SKU from Alias catalog
  alias_product_name TEXT,
  alias_brand TEXT,

  -- Mapping confidence & status
  match_confidence NUMERIC(3, 2) DEFAULT 1.0 CHECK (match_confidence >= 0 AND match_confidence <= 1),
  mapping_status TEXT DEFAULT 'ok' CHECK (mapping_status IN ('ok', 'alias_404', 'invalid', 'unmapped')),

  -- Sync tracking
  last_sync_success_at TIMESTAMPTZ,
  last_sync_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One mapping per inventory item
  CONSTRAINT unique_inventory_alias_link UNIQUE (inventory_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_alias_links_inventory
  ON public.inventory_alias_links(inventory_id);

CREATE INDEX IF NOT EXISTS idx_inventory_alias_links_catalog
  ON public.inventory_alias_links(alias_catalog_id);

CREATE INDEX IF NOT EXISTS idx_inventory_alias_links_listing
  ON public.inventory_alias_links(alias_listing_id)
  WHERE alias_listing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_alias_links_status
  ON public.inventory_alias_links(mapping_status)
  WHERE mapping_status != 'ok';

-- Comments
COMMENT ON TABLE public.inventory_alias_links IS 'Links inventory items to Alias catalog items (separate from StockX)';
COMMENT ON COLUMN public.inventory_alias_links.alias_catalog_id IS 'Catalog ID from Alias API (e.g., air-jordan-5-retro-grape-2025-hq7978-100)';
COMMENT ON COLUMN public.inventory_alias_links.alias_listing_id IS 'Alias listing ID if item is actively listed';
COMMENT ON COLUMN public.inventory_alias_links.match_confidence IS 'Confidence score of SKU match (0-1)';
COMMENT ON COLUMN public.inventory_alias_links.mapping_status IS 'Status of Alias mapping: ok | alias_404 | invalid | unmapped';

-- RLS Policies (user-scoped via inventory_id)
ALTER TABLE public.inventory_alias_links ENABLE ROW LEVEL SECURITY;

-- Users can view their own Alias links
CREATE POLICY "Users can view their own Alias links"
  ON public.inventory_alias_links FOR SELECT
  USING (
    inventory_id IN (SELECT id FROM public."Inventory" WHERE user_id = auth.uid())
  );

-- Users can insert their own Alias links
CREATE POLICY "Users can insert their own Alias links"
  ON public.inventory_alias_links FOR INSERT
  WITH CHECK (
    inventory_id IN (SELECT id FROM public."Inventory" WHERE user_id = auth.uid())
  );

-- Users can update their own Alias links
CREATE POLICY "Users can update their own Alias links"
  ON public.inventory_alias_links FOR UPDATE
  USING (
    inventory_id IN (SELECT id FROM public."Inventory" WHERE user_id = auth.uid())
  );

-- Users can delete their own Alias links
CREATE POLICY "Users can delete their own Alias links"
  ON public.inventory_alias_links FOR DELETE
  USING (
    inventory_id IN (SELECT id FROM public."Inventory" WHERE user_id = auth.uid())
  );

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_inventory_alias_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_inventory_alias_links_updated_at
  BEFORE UPDATE ON public.inventory_alias_links
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_alias_links_updated_at();

-- Migration complete
