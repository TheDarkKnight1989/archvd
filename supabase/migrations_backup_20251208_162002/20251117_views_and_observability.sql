-- ============================================================================
-- Portfolio Views V2 & Observability Tables
-- Created: 2025-01-17
-- Purpose: Production-grade views and logging infrastructure
-- ============================================================================

-- ============================================================================
-- 1. Portfolio Latest Prices V2 (Enhanced with FX)
-- ============================================================================

CREATE OR REPLACE VIEW public.portfolio_latest_prices_v2
WITH (security_invoker = on) AS
SELECT
  i.id AS inventory_id,
  i.user_id,
  i.sku,
  i.size_uk,
  i.size,
  i.brand,
  i.model,
  i.category,
  i.status,

  -- Purchase info in base currency
  i.purchase_price,
  COALESCE(i.purchase_total_base, i.purchase_amount_base, i.purchase_price) AS purchase_total_base,
  COALESCE(i.fx_rate_at_purchase, i.purchase_fx_rate, 1.0) AS fx_rate_at_purchase,

  -- Market price (from latest market data)
  COALESCE(lmp.latest_price, i.custom_market_value) AS market_price,
  lmp.source AS market_source,
  lmp.as_of AS market_as_of,
  CASE WHEN lmp.latest_price IS NULL AND i.custom_market_value IS NULL
    THEN true ELSE false
  END AS missing_price,

  -- Unrealised profit (for display - not accounting)
  CASE
    WHEN COALESCE(lmp.latest_price, i.custom_market_value) IS NOT NULL
    THEN COALESCE(lmp.latest_price, i.custom_market_value) - COALESCE(i.purchase_total_base, i.purchase_amount_base, i.purchase_price)
    ELSE NULL
  END AS profit_unrealised_display,

  -- Metadata
  i.created_at,
  i.updated_at

FROM public."Inventory" i
LEFT JOIN public.latest_market_prices lmp
  ON lmp.sku = i.sku
  AND (lmp.size = i.size_uk OR lmp.size = i.size)
WHERE i.user_id = auth.uid()
  AND i.status != 'sold'; -- Only active inventory

COMMENT ON VIEW public.portfolio_latest_prices_v2 IS
'Enhanced portfolio view with FX-aware base currency amounts. Use this for portfolio value calculations.';

GRANT SELECT ON public.portfolio_latest_prices_v2 TO authenticated;

-- ============================================================================
-- 2. Logs Tables for Observability
-- ============================================================================

-- Application logs table
CREATE TABLE IF NOT EXISTS public.logs_app (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  module TEXT NOT NULL,
  message TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_app_created
ON public.logs_app(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_app_level_created
ON public.logs_app(level, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_app_user_created
ON public.logs_app(user_id, created_at DESC) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logs_app_module
ON public.logs_app(module, created_at DESC);

COMMENT ON TABLE public.logs_app IS
'Application-level logs for debugging and monitoring';

-- Jobs/tasks logs table
CREATE TABLE IF NOT EXISTS public.logs_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  run_id UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('started', 'running', 'completed', 'failed')),
  duration_ms INTEGER,
  error TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_jobs_job_name
ON public.logs_jobs(job_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_jobs_status
ON public.logs_jobs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_jobs_run_id
ON public.logs_jobs(run_id);

COMMENT ON TABLE public.logs_jobs IS
'Background job execution logs for monitoring scheduled tasks';

-- API request logs table
CREATE TABLE IF NOT EXISTS public.logs_api (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  duration_ms INTEGER,
  payload_hash TEXT,
  payload_size INTEGER,
  error TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_api_created
ON public.logs_api(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_api_user
ON public.logs_api(user_id, created_at DESC) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logs_api_status
ON public.logs_api(status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_api_path
ON public.logs_api(path, created_at DESC);

COMMENT ON TABLE public.logs_api IS
'API request logs for performance monitoring and debugging';

-- ============================================================================
-- 3. RLS Policies for Logs Tables
-- ============================================================================

-- logs_app: Only service role can write, users can read their own
ALTER TABLE public.logs_app ENABLE ROW LEVEL SECURITY;

CREATE POLICY logs_app_select_own
ON public.logs_app
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

-- logs_jobs: Service role only
ALTER TABLE public.logs_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY logs_jobs_service_only
ON public.logs_jobs
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'role' = 'service_role');

-- logs_api: Users can see their own requests
ALTER TABLE public.logs_api ENABLE ROW LEVEL SECURITY;

CREATE POLICY logs_api_select_own
ON public.logs_api
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 4. Helper Functions for Logging
-- ============================================================================

-- Log application event
CREATE OR REPLACE FUNCTION public.fn_log_app(
  p_level TEXT,
  p_module TEXT,
  p_message TEXT,
  p_meta JSONB DEFAULT '{}'::jsonb,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.logs_app (level, module, message, meta, user_id)
  VALUES (p_level, p_module, p_message, p_meta, p_user_id)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION public.fn_log_app IS
'Helper function to log application events';

-- Start job run
CREATE OR REPLACE FUNCTION public.fn_job_start(
  p_job_name TEXT,
  p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id UUID;
BEGIN
  v_run_id := gen_random_uuid();

  INSERT INTO public.logs_jobs (job_name, run_id, status, started_at, meta)
  VALUES (p_job_name, v_run_id, 'started', NOW(), p_meta);

  RETURN v_run_id;
END;
$$;

-- Complete job run
CREATE OR REPLACE FUNCTION public.fn_job_complete(
  p_run_id UUID,
  p_status TEXT DEFAULT 'completed',
  p_error TEXT DEFAULT NULL,
  p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started_at TIMESTAMPTZ;
  v_duration INTEGER;
BEGIN
  SELECT started_at INTO v_started_at
  FROM public.logs_jobs
  WHERE run_id = p_run_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_started_at IS NOT NULL THEN
    v_duration := EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000;
  END IF;

  UPDATE public.logs_jobs
  SET
    status = p_status,
    completed_at = NOW(),
    duration_ms = v_duration,
    error = p_error,
    meta = COALESCE(p_meta, meta)
  WHERE run_id = p_run_id;
END;
$$;

COMMENT ON FUNCTION public.fn_job_complete IS
'Complete a job run and calculate duration';

-- ============================================================================
-- 5. Idempotency Keys Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  response JSONB NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user
ON public.idempotency_keys(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
ON public.idempotency_keys(expires_at);

COMMENT ON TABLE public.idempotency_keys IS
'Stores idempotency keys for API requests. Keys expire after 24 hours.';

-- RLS for idempotency_keys
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY idempotency_keys_own
ON public.idempotency_keys
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Cleanup function for expired keys
CREATE OR REPLACE FUNCTION public.fn_cleanup_expired_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE expires_at < NOW();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.fn_cleanup_expired_idempotency_keys IS
'Deletes expired idempotency keys. Should be run as a scheduled job.';

-- ============================================================================
-- 6. Verification
-- ============================================================================

DO $$
DECLARE
  v_table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('logs_app', 'logs_jobs', 'logs_api', 'idempotency_keys');

  RAISE NOTICE 'Observability tables created: %/4', v_table_count;

  -- Test logging functions
  PERFORM public.fn_log_app('info', 'migration', 'Observability infrastructure initialized');

  RAISE NOTICE 'portfolio_latest_prices_v2 view created successfully';
END $$;

-- ============================================================================
-- END OF VIEWS & OBSERVABILITY MIGRATION
-- ============================================================================
