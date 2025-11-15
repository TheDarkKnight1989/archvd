-- WHY: Track worker performance metrics for observability and admin dashboard
-- Logs batch execution time, success/fail counts, token usage

CREATE TABLE IF NOT EXISTS public.market_provider_metrics (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('stockx', 'alias', 'ebay')),
  took_ms INTEGER NOT NULL,
  jobs_success INTEGER NOT NULL DEFAULT 0,
  jobs_failed INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  next_refill_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast queries by provider and time range
CREATE INDEX IF NOT EXISTS ix_market_provider_metrics_lookup
  ON market_provider_metrics (provider, created_at DESC);

-- RLS: Service role only
ALTER TABLE market_provider_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only on market_provider_metrics"
  ON market_provider_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE market_provider_metrics IS 'Worker batch execution metrics for admin observability';
