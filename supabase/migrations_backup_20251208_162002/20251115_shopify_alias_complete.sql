-- ============================================================================
-- Shopify + Alias Integration - Complete Migration
-- Creates all necessary tables and relationships
-- ============================================================================

-- ============================================================================
-- 1. Alias Core Tables (from Phase 1)
-- ============================================================================

-- Alias Accounts (OAuth connections)
CREATE TABLE IF NOT EXISTS public.alias_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  alias_user_id TEXT NOT NULL,
  alias_username TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'suspended')),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_alias UNIQUE (user_id)
);

COMMENT ON TABLE public.alias_accounts IS 'User OAuth connections to Alias (GOAT)';

-- Alias Listings
CREATE TABLE IF NOT EXISTS public.alias_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias_account_id UUID REFERENCES public.alias_accounts(id) ON DELETE CASCADE,
  alias_listing_id TEXT NOT NULL,
  alias_product_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_slug TEXT,
  product_name TEXT,
  brand TEXT,
  model TEXT,
  colorway TEXT,
  image_url TEXT,
  size TEXT NOT NULL,
  condition TEXT DEFAULT 'New',
  box_condition TEXT,
  ask_price NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
  quantity INTEGER DEFAULT 1,
  views INTEGER DEFAULT 0,
  favorites INTEGER DEFAULT 0,
  listed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  last_price_update TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_alias_listing UNIQUE (alias_listing_id)
);

COMMENT ON TABLE public.alias_listings IS 'Synced listings from Alias (GOAT)';

CREATE INDEX IF NOT EXISTS idx_alias_listings_user_id ON public.alias_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_alias_listings_status ON public.alias_listings(status);
CREATE INDEX IF NOT EXISTS idx_alias_listings_sku ON public.alias_listings(sku);

-- Alias Orders
CREATE TABLE IF NOT EXISTS public.alias_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias_account_id UUID REFERENCES public.alias_accounts(id) ON DELETE CASCADE,
  alias_order_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  alias_product_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT,
  size TEXT NOT NULL,
  condition TEXT DEFAULT 'New',
  sale_price NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  commission NUMERIC(10, 2) NOT NULL,
  processing_fee NUMERIC(10, 2) NOT NULL,
  shipping_cost NUMERIC(10, 2),
  net_payout NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending',
  tracking_number TEXT,
  shipping_label_url TEXT,
  carrier TEXT,
  buyer_id TEXT,
  buyer_country TEXT,
  sold_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_to_sales_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_alias_order UNIQUE (alias_order_id)
);

COMMENT ON TABLE public.alias_orders IS 'Synced orders from Alias (GOAT)';

CREATE INDEX IF NOT EXISTS idx_alias_orders_user_id ON public.alias_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_alias_orders_status ON public.alias_orders(status);
CREATE INDEX IF NOT EXISTS idx_alias_orders_imported ON public.alias_orders(imported_to_sales_at) WHERE imported_to_sales_at IS NULL;

-- ============================================================================
-- 2. Inventory Alias Links (with Shopify enhancements)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_alias_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES public."Inventory"(id) ON DELETE CASCADE,
  alias_listing_id UUID REFERENCES public.alias_listings(id) ON DELETE SET NULL,
  alias_product_id TEXT,
  alias_product_sku TEXT,
  inventory_purchase_price NUMERIC(10, 2),
  alias_ask_price NUMERIC(10, 2),
  spread NUMERIC(10, 2) GENERATED ALWAYS AS (alias_ask_price - inventory_purchase_price) STORED,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_inventory_alias_link UNIQUE (inventory_id)
);

COMMENT ON TABLE public.inventory_alias_links IS 'Links inventory items to Alias listings and products';

CREATE INDEX IF NOT EXISTS idx_inventory_alias_links_inventory ON public.inventory_alias_links(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alias_links_listing ON public.inventory_alias_links(alias_listing_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alias_links_product_id ON public.inventory_alias_links(alias_product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alias_links_product_sku ON public.inventory_alias_links(alias_product_sku);

-- ============================================================================
-- 3. Unmatched SKUs Log
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

CREATE INDEX IF NOT EXISTS idx_alias_unmatched_log_inventory_id ON public.alias_unmatched_log(inventory_id);
CREATE INDEX IF NOT EXISTS idx_alias_unmatched_log_sku ON public.alias_unmatched_log(sku);
CREATE INDEX IF NOT EXISTS idx_alias_unmatched_log_resolved ON public.alias_unmatched_log(resolved_at) WHERE resolved_at IS NULL;

-- ============================================================================
-- 4. Add source and source_id to Inventory table
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
-- 5. RLS Policies
-- ============================================================================

-- Alias Accounts
ALTER TABLE public.alias_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own alias accounts" ON public.alias_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own alias accounts" ON public.alias_accounts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own alias accounts" ON public.alias_accounts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage alias accounts" ON public.alias_accounts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Alias Listings
ALTER TABLE public.alias_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own alias listings" ON public.alias_listings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage alias listings" ON public.alias_listings
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Alias Orders
ALTER TABLE public.alias_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own alias orders" ON public.alias_orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage alias orders" ON public.alias_orders
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Inventory Alias Links
ALTER TABLE public.inventory_alias_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own inventory alias links" ON public.inventory_alias_links
  FOR SELECT TO authenticated
  USING (
    inventory_id IN (
      SELECT id FROM public."Inventory" WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage inventory alias links" ON public.inventory_alias_links
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Unmatched SKUs Log
ALTER TABLE public.alias_unmatched_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own unmatched SKUs" ON public.alias_unmatched_log
  FOR SELECT TO authenticated
  USING (
    inventory_id IN (
      SELECT id FROM public."Inventory" WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage unmatched SKUs" ON public.alias_unmatched_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. Helper Views
-- ============================================================================

-- Inventory with Alias Status
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
LEFT JOIN public.alias_unmatched_log aul ON i.id = aul.inventory_id AND aul.resolved_at IS NULL;

COMMENT ON VIEW public.inventory_with_alias_status IS 'Inventory items with Alias mapping status';

GRANT SELECT ON public.inventory_with_alias_status TO authenticated;
GRANT SELECT ON public.inventory_with_alias_status TO service_role;

-- ============================================================================
-- 7. Triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_alias_accounts_updated_at
  BEFORE UPDATE ON public.alias_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_alias_links_updated_at
  BEFORE UPDATE ON public.inventory_alias_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Done!
-- ============================================================================
