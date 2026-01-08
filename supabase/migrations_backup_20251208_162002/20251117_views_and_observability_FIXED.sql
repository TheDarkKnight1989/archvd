-- ============================================================================
-- Portfolio Views V2 & Observability Tables (Fixed for existing schema)
-- ============================================================================

-- ============================================================================
-- 1. Portfolio Latest Prices V2
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

  -- Purchase info (using EXISTING column names)
  i.purchase_price,
  i.purchase_amount_base AS purchase_total_base,
  i.purchase_fx_rate AS fx_rate_at_purchase,

  -- Market price
  COALESCE(lmp.price, i.custom_market_value) AS market_price,
  lmp.source AS market_source,
  lmp.as_of AS market_as_of,
  CASE WHEN lmp.price IS NULL AND i.custom_market_value IS NULL
    THEN true ELSE false
  END AS missing_price,

  -- Unrealised profit
  CASE
    WHEN COALESCE(lmp.price, i.custom_market_value) IS NOT NULL
    THEN COALESCE(lmp.price, i.custom_market_value) - COALESCE(i.purchase_amount_base, i.purchase_price)
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
  AND i.status != 'sold';

COMMENT ON VIEW public.portfolio_latest_prices_v2 IS
'Enhanced portfolio view with FX-aware base currency amounts.';

GRANT SELECT ON public.portfolio_latest_prices_v2 TO authenticated;

-- ============================================================================
-- 2. Logs Tables
-- ============================================================================

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

COMMENT ON TABLE public.logs_app IS 'Application logs';

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

COMMENT ON TABLE public.logs_jobs IS 'Background job logs';

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

COMMENT ON TABLE public.logs_api IS 'API request logs';

-- ============================================================================
-- 3. RLS Policies
-- ============================================================================

ALTER TABLE public.logs_app ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS logs_app_select_own ON public.logs_app;
CREATE POLICY logs_app_select_own ON public.logs_app FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

ALTER TABLE public.logs_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS logs_jobs_service_only ON public.logs_jobs;
CREATE POLICY logs_jobs_service_only ON public.logs_jobs FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'service_role');

ALTER TABLE public.logs_api ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS logs_api_select_own ON public.logs_api;
CREATE POLICY logs_api_select_own ON public.logs_api FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 4. Helper Functions
-- ============================================================================

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
  SET status = p_status, completed_at = NOW(), duration_ms = v_duration,
      error = p_error, meta = COALESCE(p_meta, meta)
  WHERE run_id = p_run_id;
END;
$$;

-- ============================================================================
-- 5. Idempotency Keys
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

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS idempotency_keys_own ON public.idempotency_keys;
CREATE POLICY idempotency_keys_own ON public.idempotency_keys FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.fn_cleanup_expired_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.idempotency_keys WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ============================================================================
-- 6. Verification
-- ============================================================================

DO $$
BEGIN
  PERFORM public.fn_log_app('info', 'migration', 'Observability infrastructure initialized');
  RAISE NOTICE 'M4 migration complete - observability ready';
END $$;
