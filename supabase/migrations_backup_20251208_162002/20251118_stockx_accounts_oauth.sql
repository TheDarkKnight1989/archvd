-- ============================================================================
-- StockX OAuth Accounts
-- ============================================================================
-- Store OAuth tokens and account info for connected StockX accounts
-- Each user can have one connected StockX account

CREATE TABLE IF NOT EXISTS public.stockx_accounts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- OAuth tokens
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  scope TEXT,
  expires_at TIMESTAMPTZ NOT NULL,

  -- Account info
  account_email TEXT,
  account_id TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id)
);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.stockx_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own StockX account
DROP POLICY IF EXISTS "Users can read own StockX account" ON public.stockx_accounts;
CREATE POLICY "Users can read own StockX account"
  ON public.stockx_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own StockX account" ON public.stockx_accounts;
CREATE POLICY "Users can insert own StockX account"
  ON public.stockx_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own StockX account" ON public.stockx_accounts;
CREATE POLICY "Users can update own StockX account"
  ON public.stockx_accounts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own StockX account" ON public.stockx_accounts;
CREATE POLICY "Users can delete own StockX account"
  ON public.stockx_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_stockx_accounts_user_id
  ON public.stockx_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_stockx_accounts_expires_at
  ON public.stockx_accounts(expires_at);

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_stockx_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stockx_accounts_updated_at ON public.stockx_accounts;
CREATE TRIGGER stockx_accounts_updated_at
  BEFORE UPDATE ON public.stockx_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stockx_accounts_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.stockx_accounts IS 'OAuth tokens and account info for connected StockX accounts';
COMMENT ON COLUMN public.stockx_accounts.user_id IS 'Foreign key to auth.users - one account per user';
COMMENT ON COLUMN public.stockx_accounts.access_token IS 'OAuth 2.0 access token (encrypted at rest)';
COMMENT ON COLUMN public.stockx_accounts.refresh_token IS 'OAuth 2.0 refresh token for token renewal';
COMMENT ON COLUMN public.stockx_accounts.expires_at IS 'When the access_token expires';
COMMENT ON COLUMN public.stockx_accounts.account_email IS 'StockX account email (from userinfo)';
COMMENT ON COLUMN public.stockx_accounts.account_id IS 'StockX account ID (from userinfo)';
