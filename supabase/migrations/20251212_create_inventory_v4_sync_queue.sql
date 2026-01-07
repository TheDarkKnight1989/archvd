-- ============================================================================
-- INVENTORY V4 - SYNC QUEUE TABLE
-- ============================================================================
--
-- Purpose: Job queue for syncing market data from providers (StockX, Alias)
-- Date: 2025-12-12
--
-- Architecture:
--   - Stateful row model: one row per style + provider combination
--   - Workers poll for pending jobs, process, update status
--   - Retry logic with exponential backoff via next_retry_at
--   - Server-side only: privileges revoked from anon/authenticated
--
-- Status values:
--   - pending: Queued, waiting to be processed
--   - processing: Currently being synced
--   - completed: Successfully synced
--   - failed: Exhausted all retries
--
-- ============================================================================

-- ============================================================================
-- 1. CREATE SYNC QUEUE TABLE
-- ============================================================================

-- Drop existing objects if schema differs (fresh V4 start)
DROP TABLE IF EXISTS inventory_v4_sync_queue CASCADE;
DROP FUNCTION IF EXISTS claim_sync_jobs_v4(TEXT, INT);
DROP FUNCTION IF EXISTS complete_sync_job_v4(UUID);
DROP FUNCTION IF EXISTS fail_sync_job_v4(UUID, TEXT);
DROP FUNCTION IF EXISTS enqueue_sync_job_v4(TEXT, TEXT);
DROP FUNCTION IF EXISTS recover_stale_sync_jobs_v4();
DROP FUNCTION IF EXISTS get_sync_status_v4(TEXT);

CREATE TABLE inventory_v4_sync_queue (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What to sync
  style_id TEXT NOT NULL REFERENCES inventory_v4_style_catalog(style_id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stockx', 'alias')),

  -- Job status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- Queued, waiting
    'processing',  -- In progress
    'completed',   -- Success
    'failed'       -- Exhausted retries
  )),

  -- Retry tracking
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,

  -- Timestamps for retry logic
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  -- Error tracking
  last_error TEXT,

  -- Lifecycle timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  -- Stateful row model: one row per style+provider
  CONSTRAINT inventory_v4_sync_queue_unique_job UNIQUE (style_id, provider)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Workers poll for pending jobs (only pending, not processing)
CREATE INDEX IF NOT EXISTS idx_inventory_v4_sync_queue_pending
  ON inventory_v4_sync_queue(status, next_retry_at)
  WHERE status = 'pending';

-- Find stale processing jobs (for timeout recovery)
CREATE INDEX IF NOT EXISTS idx_inventory_v4_sync_queue_processing
  ON inventory_v4_sync_queue(last_attempt_at)
  WHERE status = 'processing';

-- Find jobs by style (for status lookups)
CREATE INDEX IF NOT EXISTS idx_inventory_v4_sync_queue_style
  ON inventory_v4_sync_queue(style_id);

-- Recent completed jobs (for monitoring)
CREATE INDEX IF NOT EXISTS idx_inventory_v4_sync_queue_completed
  ON inventory_v4_sync_queue(completed_at DESC)
  WHERE status = 'completed';

-- ============================================================================
-- 3. SECURITY - SERVER-SIDE ONLY
-- ============================================================================

-- Revoke all privileges from client roles and PUBLIC
REVOKE ALL ON inventory_v4_sync_queue FROM anon, authenticated, PUBLIC;

-- Explicitly grant to service_role (for PostgREST RPC and direct access)
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_v4_sync_queue TO service_role;

-- ============================================================================
-- 4. HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================================

-- Function to claim a batch of pending jobs (atomic, prevents race conditions)
CREATE OR REPLACE FUNCTION claim_sync_jobs_v4(
  p_provider TEXT,
  p_batch_size INT DEFAULT 10
)
RETURNS SETOF inventory_v4_sync_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM inventory_v4_sync_queue
    WHERE status = 'pending'
      AND provider = p_provider
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE inventory_v4_sync_queue q
  SET
    status = 'processing',
    last_attempt_at = now(),
    attempts = attempts + 1
  FROM claimed c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$;

-- Function to mark job as completed
CREATE OR REPLACE FUNCTION complete_sync_job_v4(
  p_job_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE inventory_v4_sync_queue
  SET
    status = 'completed',
    completed_at = now(),
    last_error = NULL,
    next_retry_at = NULL
  WHERE id = p_job_id;
END;
$$;

-- Function to mark job as failed with retry logic
-- Exponential backoff: 1min, 4min, 16min (power(4, attempts-1))
CREATE OR REPLACE FUNCTION fail_sync_job_v4(
  p_job_id UUID,
  p_error TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts INT;
  v_max_attempts INT;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max_attempts
  FROM inventory_v4_sync_queue
  WHERE id = p_job_id;

  IF v_attempts >= v_max_attempts THEN
    -- Exhausted retries - mark as permanently failed
    UPDATE inventory_v4_sync_queue
    SET
      status = 'failed',
      last_error = p_error,
      completed_at = now(),
      next_retry_at = NULL
    WHERE id = p_job_id;
  ELSE
    -- Schedule retry with exponential backoff: 1min, 4min, 16min
    -- attempts is already incremented on claim, so use (attempts - 1)
    UPDATE inventory_v4_sync_queue
    SET
      status = 'pending',
      last_error = p_error,
      next_retry_at = now() + (power(4, v_attempts - 1) * interval '1 minute')
    WHERE id = p_job_id;
  END IF;
END;
$$;

-- Function to enqueue a sync job (upsert - resets completed/failed jobs)
-- Stateful row model: allows re-sync of previously synced styles
CREATE OR REPLACE FUNCTION enqueue_sync_job_v4(
  p_style_id TEXT,
  p_provider TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  INSERT INTO inventory_v4_sync_queue (style_id, provider)
  VALUES (p_style_id, p_provider)
  ON CONFLICT (style_id, provider) DO UPDATE
  SET
    -- Reset to pending if completed or failed (allows re-sync)
    status = CASE
      WHEN inventory_v4_sync_queue.status IN ('completed', 'failed') THEN 'pending'
      ELSE inventory_v4_sync_queue.status
    END,
    -- Reset attempts on re-queue
    attempts = CASE
      WHEN inventory_v4_sync_queue.status IN ('completed', 'failed') THEN 0
      ELSE inventory_v4_sync_queue.attempts
    END,
    -- Clear scheduling on re-queue
    next_retry_at = CASE
      WHEN inventory_v4_sync_queue.status IN ('completed', 'failed') THEN NULL
      ELSE inventory_v4_sync_queue.next_retry_at
    END,
    -- Clear error on re-queue
    last_error = CASE
      WHEN inventory_v4_sync_queue.status IN ('completed', 'failed') THEN NULL
      ELSE inventory_v4_sync_queue.last_error
    END,
    -- Clear completed_at on re-queue
    completed_at = CASE
      WHEN inventory_v4_sync_queue.status IN ('completed', 'failed') THEN NULL
      ELSE inventory_v4_sync_queue.completed_at
    END
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

-- Function to recover stale processing jobs (timeout > 5 minutes)
CREATE OR REPLACE FUNCTION recover_stale_sync_jobs_v4()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH stale AS (
    SELECT id
    FROM inventory_v4_sync_queue
    WHERE status = 'processing'
      AND last_attempt_at < now() - interval '5 minutes'
    FOR UPDATE SKIP LOCKED
  )
  UPDATE inventory_v4_sync_queue q
  SET
    status = 'pending',
    last_error = 'Timeout: job processing exceeded 5 minutes',
    next_retry_at = NULL  -- Immediately claimable
  FROM stale s
  WHERE q.id = s.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function to get sync status for a style
CREATE OR REPLACE FUNCTION get_sync_status_v4(
  p_style_id TEXT
)
RETURNS TABLE (
  provider TEXT,
  status TEXT,
  attempts INT,
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    provider,
    status,
    attempts,
    last_attempt_at,
    last_error
  FROM inventory_v4_sync_queue
  WHERE style_id = p_style_id;
$$;

-- Revoke EXECUTE on functions from client roles and PUBLIC
REVOKE EXECUTE ON FUNCTION claim_sync_jobs_v4(TEXT, INT) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION complete_sync_job_v4(UUID) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION fail_sync_job_v4(UUID, TEXT) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION enqueue_sync_job_v4(TEXT, TEXT) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION recover_stale_sync_jobs_v4() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION get_sync_status_v4(TEXT) FROM anon, authenticated, PUBLIC;

-- Grant EXECUTE to service_role
GRANT EXECUTE ON FUNCTION claim_sync_jobs_v4(TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION complete_sync_job_v4(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fail_sync_job_v4(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION enqueue_sync_job_v4(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION recover_stale_sync_jobs_v4() TO service_role;
GRANT EXECUTE ON FUNCTION get_sync_status_v4(TEXT) TO service_role;

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE inventory_v4_sync_queue IS
  'Stateful job queue for syncing market data. One row per style+provider. Server-side only.';

COMMENT ON COLUMN inventory_v4_sync_queue.style_id IS
  'FK to style_catalog - the SKU being synced';

COMMENT ON COLUMN inventory_v4_sync_queue.provider IS
  'Market data provider: stockx or alias';

COMMENT ON COLUMN inventory_v4_sync_queue.status IS
  'Job status: pending → processing → completed/failed';

COMMENT ON COLUMN inventory_v4_sync_queue.attempts IS
  'Number of sync attempts made (incremented on each claim)';

COMMENT ON COLUMN inventory_v4_sync_queue.max_attempts IS
  'Maximum attempts before marking as permanently failed (default: 3)';

COMMENT ON COLUMN inventory_v4_sync_queue.next_retry_at IS
  'When to retry a failed job (exponential backoff: 1min, 4min, 16min)';

COMMENT ON COLUMN inventory_v4_sync_queue.last_error IS
  'Error message from most recent failed attempt';

COMMENT ON COLUMN inventory_v4_sync_queue.completed_at IS
  'When the job completed (success) or permanently failed';

COMMENT ON FUNCTION claim_sync_jobs_v4(TEXT, INT) IS
  'Atomically claim a batch of pending jobs for processing. Server-side only.';

COMMENT ON FUNCTION complete_sync_job_v4(UUID) IS
  'Mark a job as successfully completed. Server-side only.';

COMMENT ON FUNCTION fail_sync_job_v4(UUID, TEXT) IS
  'Mark a job as failed with exponential backoff retry (1min, 4min, 16min). Server-side only.';

COMMENT ON FUNCTION enqueue_sync_job_v4(TEXT, TEXT) IS
  'Enqueue a sync job. Resets completed/failed jobs to pending for re-sync. Server-side only.';

COMMENT ON FUNCTION recover_stale_sync_jobs_v4() IS
  'Recover jobs stuck in processing state for > 5 minutes. Server-side only.';

COMMENT ON FUNCTION get_sync_status_v4(TEXT) IS
  'Get sync status for all providers of a style. Server-side only.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'inventory_v4_sync_queue'
  ) THEN
    RAISE EXCEPTION 'Table inventory_v4_sync_queue was not created';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ inventory_v4_sync_queue table created successfully';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Table Features:';
  RAISE NOTICE '  - Stateful row model (one row per style+provider)';
  RAISE NOTICE '  - Status workflow: pending → processing → completed/failed';
  RAISE NOTICE '  - Exponential backoff: 1min, 4min, 16min';
  RAISE NOTICE '  - Atomic job claiming (SKIP LOCKED)';
  RAISE NOTICE '  - Stale job recovery (5min timeout)';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Security:';
  RAISE NOTICE '  - Table privileges revoked from anon/authenticated';
  RAISE NOTICE '  - Functions are SECURITY DEFINER (run as owner)';
  RAISE NOTICE '  - Function EXECUTE revoked from anon/authenticated';
  RAISE NOTICE '  - Only service role can access';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Helper Functions:';
  RAISE NOTICE '  - claim_sync_jobs_v4(provider, batch_size)';
  RAISE NOTICE '  - complete_sync_job_v4(job_id)';
  RAISE NOTICE '  - fail_sync_job_v4(job_id, error)';
  RAISE NOTICE '  - enqueue_sync_job_v4(style_id, provider)';
  RAISE NOTICE '  - recover_stale_sync_jobs_v4()';
  RAISE NOTICE '  - get_sync_status_v4(style_id)';
  RAISE NOTICE '';
END $$;
