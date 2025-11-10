-- Make refresh_token nullable in stockx_accounts
-- Some OAuth providers (like StockX) may not issue refresh tokens
-- especially if offline_access scope is not granted

ALTER TABLE public.stockx_accounts
ALTER COLUMN refresh_token DROP NOT NULL;

COMMENT ON COLUMN public.stockx_accounts.refresh_token IS 'OAuth refresh token (may be NULL if provider does not issue refresh tokens)';
