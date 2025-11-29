-- ============================================================================
-- Alias Integration - Remaining Tables
-- ============================================================================
-- Purpose: Create missing tables for complete Alias integration
-- Tables: alias_market_snapshots, alias_credentials, alias_payouts, alias_batch_operations
-- ============================================================================

-- ============================================================================
-- 1. ALIAS MARKET SNAPSHOTS (Price Data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alias_market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product identification
  catalog_id TEXT NOT NULL,                 -- Alias catalog ID
  size NUMERIC NOT NULL,                    -- Size value
  currency TEXT NOT NULL DEFAULT 'USD',     -- USD, GBP, EUR

  -- Pricing data (stored in CENTS per Alias API)
  lowest_ask_cents INTEGER,                 -- Lowest current ask price
  highest_bid_cents INTEGER,                -- Highest current bid price
  last_sold_price_cents INTEGER,            -- Most recent sale price
  global_indicator_price_cents INTEGER,     -- Alias global indicator price

  -- Metadata
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Composite index for fast lookups
  CONSTRAINT unique_alias_market_snapshot UNIQUE (catalog_id, size, currency, snapshot_at)
);

CREATE INDEX idx_alias_market_snapshots_catalog ON public.alias_market_snapshots(catalog_id);
CREATE INDEX idx_alias_market_snapshots_snapshot_at ON public.alias_market_snapshots(snapshot_at DESC);
CREATE INDEX idx_alias_market_snapshots_lookup ON public.alias_market_snapshots(catalog_id, size, currency);

COMMENT ON TABLE public.alias_market_snapshots IS 'Market pricing data from Alias API (pricing insights)';
COMMENT ON COLUMN public.alias_market_snapshots.catalog_id IS 'Alias catalog ID (e.g., air-jordan-5-retro-grape-2025-hq7978-100)';
COMMENT ON COLUMN public.alias_market_snapshots.lowest_ask_cents IS 'Lowest current asking price in cents';
COMMENT ON COLUMN public.alias_market_snapshots.highest_bid_cents IS 'Highest current offer price in cents';
COMMENT ON COLUMN public.alias_market_snapshots.global_indicator_price_cents IS 'Alias competitive price indicator in cents';

-- ============================================================================
-- 2. ALIAS CREDENTIALS (PAT Storage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alias_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Personal Access Token (encrypted at application layer)
  access_token TEXT NOT NULL,               -- Encrypted PAT

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked', 'expired')),
  last_verified_at TIMESTAMPTZ,
  last_error TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alias_credentials_user ON public.alias_credentials(user_id);
CREATE INDEX idx_alias_credentials_status ON public.alias_credentials(status) WHERE status != 'active';

COMMENT ON TABLE public.alias_credentials IS 'Stores encrypted Alias Personal Access Tokens per user';
COMMENT ON COLUMN public.alias_credentials.access_token IS 'Encrypted PAT token for Alias API authentication';
COMMENT ON COLUMN public.alias_credentials.status IS 'Token status: active | inactive | revoked | expired';

-- RLS for alias_credentials
ALTER TABLE public.alias_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Alias credentials"
  ON public.alias_credentials FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own Alias credentials"
  ON public.alias_credentials FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own Alias credentials"
  ON public.alias_credentials FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own Alias credentials"
  ON public.alias_credentials FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 3. ALIAS PAYOUTS (Payment Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alias_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Payout identification
  alias_payout_id TEXT UNIQUE NOT NULL,     -- Alias payout ID

  -- Payout details
  amount_cents INTEGER NOT NULL,            -- Payout amount in cents
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL,                     -- pending, processing, paid, failed

  -- Related orders
  order_ids TEXT[],                          -- Array of Alias order IDs included

  -- Payment method
  payment_method TEXT,                       -- bank_transfer, paypal, etc.
  payment_date TIMESTAMPTZ,

  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alias_payouts_user ON public.alias_payouts(user_id);
CREATE INDEX idx_alias_payouts_status ON public.alias_payouts(status);
CREATE INDEX idx_alias_payouts_payment_date ON public.alias_payouts(payment_date DESC);

COMMENT ON TABLE public.alias_payouts IS 'Tracks payouts from Alias for sold items';

-- RLS for alias_payouts
ALTER TABLE public.alias_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Alias payouts"
  ON public.alias_payouts FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- 4. ALIAS BATCH OPERATIONS (Async Job Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alias_batch_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Batch identification
  alias_batch_id TEXT UNIQUE NOT NULL,      -- Batch ID from Alias API

  -- Operation details
  operation_type TEXT NOT NULL CHECK (operation_type IN ('create', 'update', 'delete', 'activate', 'deactivate')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),

  -- Progress tracking
  total_items INTEGER NOT NULL,
  succeeded_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,

  -- Results
  results JSONB,                             -- Detailed per-item results
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_alias_batch_operations_user ON public.alias_batch_operations(user_id);
CREATE INDEX idx_alias_batch_operations_status ON public.alias_batch_operations(status) WHERE status != 'completed';
CREATE INDEX idx_alias_batch_operations_created ON public.alias_batch_operations(created_at DESC);

COMMENT ON TABLE public.alias_batch_operations IS 'Tracks async batch listing operations (create, update, delete, etc.)';
COMMENT ON COLUMN public.alias_batch_operations.alias_batch_id IS 'Batch ID returned from Alias batch endpoints';
COMMENT ON COLUMN public.alias_batch_operations.results IS 'Per-item success/failure details from batch operation';

-- RLS for alias_batch_operations
ALTER TABLE public.alias_batch_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Alias batch operations"
  ON public.alias_batch_operations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own Alias batch operations"
  ON public.alias_batch_operations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own Alias batch operations"
  ON public.alias_batch_operations FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================================
-- AUTO-UPDATE TRIGGERS
-- ============================================================================

-- Trigger for alias_credentials
CREATE OR REPLACE FUNCTION update_alias_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_alias_credentials_updated_at
  BEFORE UPDATE ON public.alias_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_alias_credentials_updated_at();

-- Trigger for alias_payouts
CREATE OR REPLACE FUNCTION update_alias_payouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_alias_payouts_updated_at
  BEFORE UPDATE ON public.alias_payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_alias_payouts_updated_at();

-- Migration complete
