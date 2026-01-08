-- =============================================================================
-- Alias (GOAT) Integration - Phase 1 Core Tables
-- Date: 2025-11-14
-- Purpose: User accounts, listings, orders, payouts (read-only sync)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ALIAS ACCOUNTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alias_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- OAuth credentials (encrypted at application layer)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Account info from Alias
  alias_user_id TEXT NOT NULL,
  alias_username TEXT,
  alias_email TEXT,
  seller_tier TEXT, -- 'standard', 'verified', 'power', 'enterprise'
  seller_rating NUMERIC(3, 2), -- 0.00 to 5.00

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'suspended')),
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_alias UNIQUE (user_id),
  CONSTRAINT unique_alias_user UNIQUE (alias_user_id)
);

CREATE INDEX idx_alias_accounts_user_id ON public.alias_accounts(user_id);
CREATE INDEX idx_alias_accounts_status ON public.alias_accounts(status) WHERE status = 'active';
CREATE INDEX idx_alias_accounts_last_sync ON public.alias_accounts(last_sync_at DESC) WHERE status = 'active';

COMMENT ON TABLE public.alias_accounts IS 'User connections to Alias (GOAT) marketplace accounts';
COMMENT ON COLUMN public.alias_accounts.access_token IS 'OAuth access token (encrypted)';
COMMENT ON COLUMN public.alias_accounts.last_sync_at IS 'Last successful sync of listings/orders';

-- RLS: User-scoped
ALTER TABLE public.alias_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own alias account" ON public.alias_accounts;
CREATE POLICY "Users can view own alias account"
  ON public.alias_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own alias account" ON public.alias_accounts;
CREATE POLICY "Users can insert own alias account"
  ON public.alias_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own alias account" ON public.alias_accounts;
CREATE POLICY "Users can update own alias account"
  ON public.alias_accounts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all alias accounts" ON public.alias_accounts;
CREATE POLICY "Service role can manage all alias accounts"
  ON public.alias_accounts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ALIAS LISTINGS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alias_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias_account_id UUID NOT NULL REFERENCES public.alias_accounts(id) ON DELETE CASCADE,

  -- Alias listing identifiers
  alias_listing_id TEXT NOT NULL,
  alias_product_id TEXT NOT NULL,

  -- Product details (denormalized for performance)
  sku TEXT NOT NULL,
  product_slug TEXT,
  product_name TEXT,
  brand TEXT,
  model TEXT,
  colorway TEXT,
  image_url TEXT,

  -- Listing details
  size TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT 'new' CHECK (condition IN ('new', 'used', 'defects')),
  box_condition TEXT CHECK (box_condition IN ('good_condition', 'no_original_box', 'damaged_box')),

  -- Pricing
  ask_price NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
  quantity INT NOT NULL DEFAULT 1,

  -- Engagement metrics
  views INT DEFAULT 0,
  favorites INT DEFAULT 0,

  -- Timestamps
  listed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  last_price_update TIMESTAMPTZ,

  -- Sync metadata
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_alias_listing UNIQUE (alias_listing_id)
);

CREATE INDEX idx_alias_listings_user_id ON public.alias_listings(user_id);
CREATE INDEX idx_alias_listings_account_id ON public.alias_listings(alias_account_id);
CREATE INDEX idx_alias_listings_status ON public.alias_listings(status);
CREATE INDEX idx_alias_listings_sku ON public.alias_listings(sku);
CREATE INDEX idx_alias_listings_listed_at ON public.alias_listings(listed_at DESC);
CREATE INDEX idx_alias_listings_active ON public.alias_listings(user_id, status) WHERE status = 'active';

COMMENT ON TABLE public.alias_listings IS 'Synced listings from Alias (GOAT) marketplace';
COMMENT ON COLUMN public.alias_listings.alias_listing_id IS 'Unique listing ID from Alias API';
COMMENT ON COLUMN public.alias_listings.synced_at IS 'When this record was last synced from Alias';

-- RLS: User-scoped
ALTER TABLE public.alias_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own alias listings" ON public.alias_listings;
CREATE POLICY "Users can view own alias listings"
  ON public.alias_listings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all alias listings" ON public.alias_listings;
CREATE POLICY "Service role can manage all alias listings"
  ON public.alias_listings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ALIAS ORDERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alias_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias_account_id UUID NOT NULL REFERENCES public.alias_accounts(id) ON DELETE CASCADE,
  alias_listing_id UUID REFERENCES public.alias_listings(id) ON DELETE SET NULL,

  -- Alias order identifiers
  alias_order_id TEXT NOT NULL,
  order_number TEXT NOT NULL,

  -- Product details (denormalized)
  alias_product_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT,
  size TEXT NOT NULL,
  condition TEXT,

  -- Financial details
  sale_price NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  commission NUMERIC(10, 2) NOT NULL DEFAULT 0,
  processing_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  net_payout NUMERIC(10, 2) NOT NULL,

  -- Order status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'completed', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'paid', 'failed')),

  -- Shipping
  tracking_number TEXT,
  shipping_label_url TEXT,
  carrier TEXT,

  -- Buyer info (anonymized)
  buyer_id TEXT,
  buyer_country TEXT,

  -- Timestamps
  sold_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Sync metadata
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_alias_order UNIQUE (alias_order_id)
);

CREATE INDEX idx_alias_orders_user_id ON public.alias_orders(user_id);
CREATE INDEX idx_alias_orders_account_id ON public.alias_orders(alias_account_id);
CREATE INDEX idx_alias_orders_listing_id ON public.alias_orders(alias_listing_id) WHERE alias_listing_id IS NOT NULL;
CREATE INDEX idx_alias_orders_status ON public.alias_orders(status);
CREATE INDEX idx_alias_orders_sold_at ON public.alias_orders(sold_at DESC);
CREATE INDEX idx_alias_orders_sku ON public.alias_orders(sku);

COMMENT ON TABLE public.alias_orders IS 'Synced orders (sales) from Alias (GOAT) marketplace';
COMMENT ON COLUMN public.alias_orders.net_payout IS 'Amount seller receives after fees';
COMMENT ON COLUMN public.alias_orders.synced_at IS 'When this record was last synced from Alias';

-- RLS: User-scoped
ALTER TABLE public.alias_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own alias orders" ON public.alias_orders;
CREATE POLICY "Users can view own alias orders"
  ON public.alias_orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all alias orders" ON public.alias_orders;
CREATE POLICY "Service role can manage all alias orders"
  ON public.alias_orders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ALIAS PAYOUTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alias_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias_account_id UUID NOT NULL REFERENCES public.alias_accounts(id) ON DELETE CASCADE,

  -- Alias payout identifiers
  alias_payout_id TEXT NOT NULL,

  -- Financial details
  gross_amount NUMERIC(10, 2) NOT NULL,
  fees NUMERIC(10, 2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',

  -- Payout details
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payment_method TEXT, -- 'bank_transfer', 'paypal', etc.

  -- Period covered
  period_start DATE,
  period_end DATE,

  -- Associated orders (JSONB array of order IDs)
  order_ids JSONB DEFAULT '[]'::jsonb,
  order_count INT DEFAULT 0,

  -- Timestamps
  initiated_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,

  -- Sync metadata
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_alias_payout UNIQUE (alias_payout_id)
);

CREATE INDEX idx_alias_payouts_user_id ON public.alias_payouts(user_id);
CREATE INDEX idx_alias_payouts_account_id ON public.alias_payouts(alias_account_id);
CREATE INDEX idx_alias_payouts_status ON public.alias_payouts(status);
CREATE INDEX idx_alias_payouts_initiated_at ON public.alias_payouts(initiated_at DESC);
CREATE INDEX idx_alias_payouts_period ON public.alias_payouts(period_start, period_end);

COMMENT ON TABLE public.alias_payouts IS 'Synced payout records from Alias (GOAT) marketplace';
COMMENT ON COLUMN public.alias_payouts.order_ids IS 'Array of alias_order_id values included in this payout';
COMMENT ON COLUMN public.alias_payouts.synced_at IS 'When this record was last synced from Alias';

-- RLS: User-scoped
ALTER TABLE public.alias_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own alias payouts" ON public.alias_payouts;
CREATE POLICY "Users can view own alias payouts"
  ON public.alias_payouts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all alias payouts" ON public.alias_payouts;
CREATE POLICY "Service role can manage all alias payouts"
  ON public.alias_payouts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. UPDATED_AT TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_alias_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_alias_accounts_updated_at ON public.alias_accounts;
CREATE TRIGGER trigger_alias_accounts_updated_at
  BEFORE UPDATE ON public.alias_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alias_updated_at();

DROP TRIGGER IF EXISTS trigger_alias_listings_updated_at ON public.alias_listings;
CREATE TRIGGER trigger_alias_listings_updated_at
  BEFORE UPDATE ON public.alias_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alias_updated_at();

DROP TRIGGER IF EXISTS trigger_alias_orders_updated_at ON public.alias_orders;
CREATE TRIGGER trigger_alias_orders_updated_at
  BEFORE UPDATE ON public.alias_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alias_updated_at();

DROP TRIGGER IF EXISTS trigger_alias_payouts_updated_at ON public.alias_payouts;
CREATE TRIGGER trigger_alias_payouts_updated_at
  BEFORE UPDATE ON public.alias_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alias_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PERMISSIONS
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT ON public.alias_accounts TO authenticated;
GRANT INSERT ON public.alias_accounts TO authenticated;
GRANT UPDATE ON public.alias_accounts TO authenticated;
GRANT ALL ON public.alias_accounts TO service_role;

GRANT SELECT ON public.alias_listings TO authenticated;
GRANT ALL ON public.alias_listings TO service_role;

GRANT SELECT ON public.alias_orders TO authenticated;
GRANT ALL ON public.alias_orders TO service_role;

GRANT SELECT ON public.alias_payouts TO authenticated;
GRANT ALL ON public.alias_payouts TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. SUCCESS MESSAGE
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20251114_alias_v1_core completed successfully';
  RAISE NOTICE '📦 Created tables: alias_accounts, alias_listings, alias_orders, alias_payouts';
  RAISE NOTICE '🔒 RLS enabled (user-scoped)';
  RAISE NOTICE '📊 Indexes created for performance';
END $$;
