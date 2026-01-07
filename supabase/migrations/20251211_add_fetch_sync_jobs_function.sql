-- ============================================================================
-- ADD MISSING fetch_sync_jobs FUNCTION
-- ============================================================================
--
-- This function was missing from the initial migration.
-- It provides concurrent-safe job fetching using FOR UPDATE SKIP LOCKED.
--
-- ============================================================================

-- Fetch and lock pending jobs for processing
-- Uses FOR UPDATE SKIP LOCKED for safe concurrent worker execution
-- Multiple workers can safely run in parallel without job conflicts
CREATE OR REPLACE FUNCTION fetch_sync_jobs(
  _limit INTEGER,
  _provider TEXT DEFAULT NULL
)
RETURNS SETOF inventory_v4_sync_queue AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM inventory_v4_sync_queue
  WHERE status = 'pending'
    AND (_provider IS NULL OR provider = _provider)
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT _limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success
DO $$
BEGIN
  RAISE NOTICE '✅ fetch_sync_jobs() function created successfully';
END $$;
