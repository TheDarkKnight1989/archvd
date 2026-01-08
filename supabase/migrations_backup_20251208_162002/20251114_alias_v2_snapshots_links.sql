-- =============================================================================
-- Alias (GOAT) Integration - Phase 1 Snapshots & Links
-- Date: 2025-11-14
-- Purpose: Market price snapshots and inventory linkage
-- Requires: 20251114_alias_v1_core.sql
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ALIAS MARKET SNAPSHOTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alias_market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product identifiers
  alias_product_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  size TEXT NOT NULL,

  -- Pricing data
  lowest_ask NUMERIC(10, 2),
  highest_bid NUMERIC(10, 2),
  last_sale NUMERIC(10, 2),
  currency TEXT NOT NULL DEFAULT 'GBP',

  -- Market depth
  ask_count INT DEFAULT 0,
  bid_count INT DEFAULT 0,
  sales_last_72h INT DEFAULT 0,

  -- Spread metrics
  spread_absolute NUMERIC(10, 2),
  spread_percentage NUMERIC(5, 2),

  -- Snapshot timestamp
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Composite index for efficient lookups
  CONSTRAINT unique_market_snapshot UNIQUE (alias_product_id, size, snapshot_at)
);

CREATE INDEX idx_alias_market_snapshots_sku_size ON public.alias_market_snapshots(sku, size, snapshot_at DESC);
CREATE INDEX idx_alias_market_snapshots_product_size ON public.alias_market_snapshots(alias_product_id, size, snapshot_at DESC);
CREATE INDEX idx_alias_market_snapshots_snapshot_at ON public.alias_market_snapshots(snapshot_at DESC);

COMMENT ON TABLE public.alias_market_snapshots IS 'Point-in-time market pricing data from Alias (GOAT) for historical charting and alerts';
COMMENT ON COLUMN public.alias_market_snapshots.snapshot_at IS 'When this pricing snapshot was captured';
COMMENT ON COLUMN public.alias_market_snapshots.spread_percentage IS 'Percentage difference between ask and bid';

-- RLS: Public read (market data), service role write
ALTER TABLE public.alias_market_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view market snapshots" ON public.alias_market_snapshots;
CREATE POLICY "Anyone can view market snapshots"
  ON public.alias_market_snapshots FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage market snapshots" ON public.alias_market_snapshots;
CREATE POLICY "Service role can manage market snapshots"
  ON public.alias_market_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INVENTORY → ALIAS LISTINGS LINKAGE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_alias_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  inventory_id UUID NOT NULL REFERENCES public."Inventory"(id) ON DELETE CASCADE,
  alias_listing_id UUID NOT NULL REFERENCES public.alias_listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Link metadata
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'error')),
  sync_error TEXT,
  last_sync_at TIMESTAMPTZ,

  -- Price tracking
  inventory_purchase_price NUMERIC(10, 2), -- cached from Inventory
  alias_ask_price NUMERIC(10, 2),          -- cached from alias_listings
  spread NUMERIC(10, 2) GENERATED ALWAYS AS (alias_ask_price - inventory_purchase_price) STORED,
  spread_pct NUMERIC(5, 2) GENERATED ALWAYS AS (
    CASE
      WHEN inventory_purchase_price > 0 THEN
        ((alias_ask_price - inventory_purchase_price) / inventory_purchase_price) * 100
      ELSE NULL
    END
  ) STORED,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_inventory_alias_link UNIQUE (inventory_id)
);

CREATE INDEX idx_inventory_alias_links_inventory_id ON public.inventory_alias_links(inventory_id);
CREATE INDEX idx_inventory_alias_links_alias_listing_id ON public.inventory_alias_links(alias_listing_id);
CREATE INDEX idx_inventory_alias_links_user_id ON public.inventory_alias_links(user_id);
CREATE INDEX idx_inventory_alias_links_sync_status ON public.inventory_alias_links(sync_status) WHERE sync_status != 'synced';

COMMENT ON TABLE public.inventory_alias_links IS 'Links local Inventory items to their Alias (GOAT) listings for sync and display';
COMMENT ON COLUMN public.inventory_alias_links.spread IS 'Difference between ask price and purchase price';
COMMENT ON COLUMN public.inventory_alias_links.spread_pct IS 'Percentage profit margin on ask price';

-- RLS: User-scoped
ALTER TABLE public.inventory_alias_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own inventory links" ON public.inventory_alias_links;
CREATE POLICY "Users can view own inventory links"
  ON public.inventory_alias_links FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own inventory links" ON public.inventory_alias_links;
CREATE POLICY "Users can insert own inventory links"
  ON public.inventory_alias_links FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own inventory links" ON public.inventory_alias_links;
CREATE POLICY "Users can update own inventory links"
  ON public.inventory_alias_links FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all inventory links" ON public.inventory_alias_links;
CREATE POLICY "Service role can manage all inventory links"
  ON public.inventory_alias_links FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HELPER VIEWS
-- ─────────────────────────────────────────────────────────────────────────────

-- View: Inventory items with Alias listing info
DROP VIEW IF EXISTS public.inventory_with_alias;
CREATE VIEW public.inventory_with_alias AS
SELECT
  i.*,
  ial.id AS link_id,
  ial.alias_listing_id,
  al.alias_listing_id AS alias_external_id,
  al.status AS alias_status,
  al.ask_price AS alias_ask,
  al.currency AS alias_currency,
  al.listed_at AS alias_listed_at,
  al.views AS alias_views,
  al.favorites AS alias_favorites,
  ial.spread AS alias_spread,
  ial.spread_pct AS alias_spread_pct,
  ial.sync_status AS alias_sync_status,
  ial.last_sync_at AS alias_last_sync
FROM
  public."Inventory" i
  LEFT JOIN public.inventory_alias_links ial ON i.id = ial.inventory_id
  LEFT JOIN public.alias_listings al ON ial.alias_listing_id = al.id;

COMMENT ON VIEW public.inventory_with_alias IS 'Inventory items enriched with Alias (GOAT) listing data';

-- Grant access
GRANT SELECT ON public.inventory_with_alias TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trigger_inventory_alias_links_updated_at ON public.inventory_alias_links;
CREATE TRIGGER trigger_inventory_alias_links_updated_at
  BEFORE UPDATE ON public.inventory_alias_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alias_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. AUTO-SYNC TRIGGER (when Inventory purchase_price changes)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_inventory_alias_link_prices()
RETURNS TRIGGER AS $$
BEGIN
  -- Update cached prices in inventory_alias_links when Inventory.purchase_price changes
  IF NEW.purchase_price IS DISTINCT FROM OLD.purchase_price THEN
    UPDATE public.inventory_alias_links
    SET inventory_purchase_price = NEW.purchase_price,
        sync_status = 'pending'
    WHERE inventory_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_inventory_price_sync ON public."Inventory";
CREATE TRIGGER trigger_inventory_price_sync
  AFTER UPDATE ON public."Inventory"
  FOR EACH ROW
  WHEN (NEW.purchase_price IS DISTINCT FROM OLD.purchase_price)
  EXECUTE FUNCTION public.sync_inventory_alias_link_prices();

COMMENT ON FUNCTION public.sync_inventory_alias_link_prices IS 'Keeps inventory_alias_links.inventory_purchase_price in sync with Inventory.purchase_price';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PERMISSIONS
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT ON public.alias_market_snapshots TO authenticated;
GRANT ALL ON public.alias_market_snapshots TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.inventory_alias_links TO authenticated;
GRANT ALL ON public.inventory_alias_links TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. SUCCESS MESSAGE
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20251114_alias_v2_snapshots_links completed successfully';
  RAISE NOTICE '📦 Created tables: alias_market_snapshots, inventory_alias_links';
  RAISE NOTICE '📊 Created view: inventory_with_alias';
  RAISE NOTICE '🔗 Inventory linkage ready for sync';
END $$;
