-- ============================================================================
-- Market Queue System - Jobs, Budgets, and Runs
-- Migration: 20251118_market_queue.sql
-- ============================================================================

-- Job status enum
CREATE TYPE job_status AS ENUM ('pending', 'running', 'done', 'failed', 'deferred');

-- ============================================================================
-- 1. Market Jobs Queue
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.market_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('stockx', 'alias', 'ebay')),
  sku TEXT NOT NULL,
  size TEXT NULL, -- normalized UK format where possible
  priority INT NOT NULL DEFAULT 100, -- 200 manual, 150 hot, 100 normal
  not_before TIMESTAMPTZ NULL,
  retry_count INT NOT NULL DEFAULT 0,
  status job_status NOT NULL DEFAULT 'pending',
  error_message TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  dedupe_key TEXT GENERATED ALWAYS AS (provider || '|' || COALESCE(sku, '') || '|' || COALESCE(size, '')) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: only one pending/running job per (provider, sku, size)
CREATE UNIQUE INDEX IF NOT EXISTS uq_market_jobs_dedupe_pending
  ON public.market_jobs (dedupe_key)
  WHERE status IN ('pending', 'running');

-- Index for picking ready jobs
CREATE INDEX IF NOT EXISTS ix_market_jobs_ready
  ON public.market_jobs (status, priority DESC, created_at ASC)
  WHERE status = 'pending';

-- Index for user jobs
CREATE INDEX IF NOT EXISTS ix_market_jobs_user_id
  ON public.market_jobs (user_id);

COMMENT ON TABLE public.market_jobs IS 'Queue for market data fetch jobs';
COMMENT ON COLUMN public.market_jobs.priority IS '200=manual refresh, 150=hot SKU, 100=background';
COMMENT ON COLUMN public.market_jobs.dedupe_key IS 'Ensures only one active job per (provider, SKU, size)';

-- ============================================================================
-- 2. Market Job Runs (Audit Log for Scheduler Runs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.market_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NULL,
  jobs_selected INT NOT NULL DEFAULT 0,
  jobs_succeeded INT NOT NULL DEFAULT 0,
  jobs_failed INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_market_job_runs_run_id
  ON public.market_job_runs (run_id);

CREATE INDEX IF NOT EXISTS ix_market_job_runs_started_at
  ON public.market_job_runs (started_at DESC);

COMMENT ON TABLE public.market_job_runs IS 'Audit log of scheduler runs (not individual jobs)';

-- ============================================================================
-- 3. Market Budgets (Token Bucket Rate Limiting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.market_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stockx', 'alias', 'ebay')),
  hour_window TIMESTAMPTZ NOT NULL, -- start of hour (e.g. 2025-11-18 14:00:00)
  rate_limit INT NOT NULL,
  used INT NOT NULL DEFAULT 0,
  UNIQUE (provider, hour_window)
);

CREATE INDEX IF NOT EXISTS ix_market_budgets_active
  ON public.market_budgets (provider, hour_window DESC);

COMMENT ON TABLE public.market_budgets IS 'Hourly token bucket for rate limiting per provider';
COMMENT ON COLUMN public.market_budgets.rate_limit IS 'Maximum requests allowed in this hour';
COMMENT ON COLUMN public.market_budgets.used IS 'Requests consumed so far';

-- ============================================================================
-- 4. Provider Metrics (Observability)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.market_provider_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stockx', 'alias', 'ebay')),
  run_id TEXT NOT NULL,
  batch_size INT NOT NULL DEFAULT 0,
  succeeded INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  deferred INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_market_provider_metrics_provider
  ON public.market_provider_metrics (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_market_provider_metrics_run_id
  ON public.market_provider_metrics (run_id);

COMMENT ON TABLE public.market_provider_metrics IS 'Provider batch execution metrics per scheduler run';

-- ============================================================================
-- 5. Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.market_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_provider_metrics ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own jobs
CREATE POLICY "read_own_jobs" ON public.market_jobs
  FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'authenticated');

-- Authenticated users can read job runs
CREATE POLICY "read_runs_authenticated" ON public.market_job_runs
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can read budgets
CREATE POLICY "read_budgets_authenticated" ON public.market_budgets
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can read metrics
CREATE POLICY "read_metrics_authenticated" ON public.market_provider_metrics
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role can do everything
CREATE POLICY "service_role_all_jobs" ON public.market_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_runs" ON public.market_job_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_budgets" ON public.market_budgets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_metrics" ON public.market_provider_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 6. Helper Functions
-- ============================================================================

-- Increment budget usage atomically
CREATE OR REPLACE FUNCTION increment_market_budget(
  p_provider TEXT,
  p_hour_window TIMESTAMPTZ,
  p_increment INT
) RETURNS VOID AS $$
BEGIN
  UPDATE public.market_budgets
  SET used = used + p_increment
  WHERE provider = p_provider
    AND hour_window = p_hour_window;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
