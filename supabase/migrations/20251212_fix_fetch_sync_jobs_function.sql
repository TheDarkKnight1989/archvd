-- ============================================================================
-- FIX fetch_sync_jobs FUNCTION - Atomic claim + return (HARDENED)
-- ============================================================================
--
-- Changes from original:
-- 1. Added next_retry_at filter
-- 2. Atomically updates status to 'processing' and increments attempts
-- 3. Returns the claimed jobs (already marked as processing)
-- 4. Added attempts < max_attempts guard to prevent infinite retry loops
-- 5. Added search_path hardening for SECURITY DEFINER
-- 6. Added _limit clamping (1-50)
-- 7. Added privilege restrictions (service_role only)
--
-- This eliminates the race window between fetch and mark-processing.
--
-- ============================================================================

-- Fetch, lock, and claim pending jobs for processing
-- Uses FOR UPDATE SKIP LOCKED + immediate UPDATE for atomic claim
-- Multiple workers can safely run in parallel without job conflicts
CREATE OR REPLACE FUNCTION fetch_sync_jobs(
  _limit INTEGER,
  _provider TEXT DEFAULT NULL
)
RETURNS SETOF inventory_v4_sync_queue AS $$
DECLARE
  _safe_limit INTEGER;
BEGIN
  -- Clamp limit to safe range (1-50)
  _safe_limit := GREATEST(1, LEAST(COALESCE(_limit, 10), 50));

  -- Atomically claim jobs: select + update in one statement
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM inventory_v4_sync_queue
    WHERE status = 'pending'
      AND (_provider IS NULL OR provider = _provider)
      AND (next_retry_at IS NULL OR next_retry_at <= now())
      AND attempts < max_attempts  -- Guard: don't retry beyond max
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT _safe_limit
  )
  UPDATE inventory_v4_sync_queue q
  SET
    status = 'processing',
    attempts = attempts + 1,
    last_attempt_at = now()
  FROM claimed c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Restrict access to service_role only
REVOKE ALL ON FUNCTION fetch_sync_jobs(INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fetch_sync_jobs(INTEGER, TEXT) TO service_role;

-- ============================================================================
-- ADD queue_stats_v4 FUNCTION - Efficient grouped count
-- ============================================================================

CREATE OR REPLACE FUNCTION queue_stats_v4()
RETURNS TABLE (
  status TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.status::TEXT,
    COUNT(*)::BIGINT
  FROM inventory_v4_sync_queue q
  GROUP BY q.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Restrict access to service_role only
REVOKE ALL ON FUNCTION queue_stats_v4() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION queue_stats_v4() TO service_role;

-- ============================================================================
-- Success message
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ fetch_sync_jobs() updated with atomic claim + hardening';
  RAISE NOTICE '✅ queue_stats_v4() function created with hardening';
  RAISE NOTICE '✅ Both functions restricted to service_role only';
END $$;
