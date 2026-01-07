-- ============================================================================
-- INVENTORY V4 - SYNC QUEUE SYSTEM
-- ============================================================================
--
-- Purpose: Auto-queue sync jobs when StockX or Alias mappings change
--
-- Architecture:
--   1. Queue table (inventory_v4_sync_queue) stores pending/processing/completed jobs
--   2. Triggers on inventory_v4_style_catalog auto-create jobs when mappings change
--   3. Worker script processes jobs using existing sync functions
--
-- Features:
--   - Multi-provider support (StockX, Alias)
--   - Retry tracking with attempt counts
--   - Error logging
--   - Race condition protection (FOR UPDATE SKIP LOCKED)
--   - RLS policies for security
--
-- Usage:
--   - Triggers auto-queue jobs when style_catalog changes
--   - Run worker: npx tsx scripts/inventory-v4-sync-worker.ts
--
-- ============================================================================

-- ============================================================================
-- 1. CREATE QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_v4_sync_queue (
  id BIGSERIAL PRIMARY KEY,

  -- Job identification
  style_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('stockx', 'alias')),

  -- Job status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,

  -- Error tracking
  last_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Create unique partial index: only one pending job per (style_id, provider)
-- This prevents duplicate pending jobs while allowing multiple completed/failed jobs
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_queue_unique_pending
  ON inventory_v4_sync_queue (style_id, provider)
  WHERE status = 'pending';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending
  ON inventory_v4_sync_queue (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sync_queue_processing
  ON inventory_v4_sync_queue (updated_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_sync_queue_provider_status
  ON inventory_v4_sync_queue (provider, status);

-- Index for foreign key-like lookups on style_id
CREATE INDEX IF NOT EXISTS idx_sync_queue_style_id
  ON inventory_v4_sync_queue (style_id);

-- Add comment
COMMENT ON TABLE inventory_v4_sync_queue IS 'Auto-sync queue for StockX and Alias product data. Jobs are created by triggers and processed by worker script.';

-- ============================================================================
-- 2. AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_sync_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_queue_updated_at
  BEFORE UPDATE ON inventory_v4_sync_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_queue_timestamp();

-- ============================================================================
-- 2B. FETCH JOBS FUNCTION (WITH LOCKING)
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

-- ============================================================================
-- 3. AUTO-QUEUE TRIGGER FUNCTIONS
-- ============================================================================

-- StockX Trigger: Queue sync job when stockx_url_key is set/changed
CREATE OR REPLACE FUNCTION queue_stockx_sync_job()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue if stockx_url_key is not null
  IF NEW.stockx_url_key IS NOT NULL THEN
    -- On INSERT or UPDATE where stockx_url_key changed
    IF (TG_OP = 'INSERT') OR
       (TG_OP = 'UPDATE' AND (NEW.stockx_url_key IS DISTINCT FROM OLD.stockx_url_key)) THEN

      -- Insert job (will be ignored if duplicate pending job exists due to partial unique index)
      INSERT INTO inventory_v4_sync_queue (style_id, provider, status)
      VALUES (NEW.style_id, 'stockx', 'pending')
      ON CONFLICT (style_id, provider) DO NOTHING;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Alias Trigger: Queue sync job when alias_catalog_id is set/changed
CREATE OR REPLACE FUNCTION queue_alias_sync_job()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue if alias_catalog_id is not null
  IF NEW.alias_catalog_id IS NOT NULL THEN
    -- On INSERT or UPDATE where alias_catalog_id changed
    IF (TG_OP = 'INSERT') OR
       (TG_OP = 'UPDATE' AND (NEW.alias_catalog_id IS DISTINCT FROM OLD.alias_catalog_id)) THEN

      -- Insert job (will be ignored if duplicate pending job exists due to partial unique index)
      INSERT INTO inventory_v4_sync_queue (style_id, provider, status)
      VALUES (NEW.style_id, 'alias', 'pending')
      ON CONFLICT (style_id, provider) DO NOTHING;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. ATTACH TRIGGERS TO STYLE CATALOG
-- ============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS stockx_sync_trigger ON inventory_v4_style_catalog;
DROP TRIGGER IF EXISTS alias_sync_trigger ON inventory_v4_style_catalog;

-- Create triggers
CREATE TRIGGER stockx_sync_trigger
  AFTER INSERT OR UPDATE ON inventory_v4_style_catalog
  FOR EACH ROW
  EXECUTE FUNCTION queue_stockx_sync_job();

CREATE TRIGGER alias_sync_trigger
  AFTER INSERT OR UPDATE ON inventory_v4_style_catalog
  FOR EACH ROW
  EXECUTE FUNCTION queue_alias_sync_job();

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE inventory_v4_sync_queue ENABLE ROW LEVEL SECURITY;

-- Service role: full access (for worker script)
CREATE POLICY "service_role_all_access"
  ON inventory_v4_sync_queue
  FOR ALL
  USING (auth.role() = 'service_role');

-- User access: SELECT only (for future admin UI)
CREATE POLICY "user_select_access"
  ON inventory_v4_sync_queue
  FOR SELECT
  TO authenticated
  USING (auth.uid() = 'fbcde760-820b-4eaf-949f-534a8130d44b'::uuid);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory_v4_sync_queue') THEN
    RAISE EXCEPTION 'Table inventory_v4_sync_queue was not created';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Sync queue system created successfully';
  RAISE NOTICE '';
  RAISE NOTICE '📊 System Components:';
  RAISE NOTICE '  - Table: inventory_v4_sync_queue';
  RAISE NOTICE '  - Triggers: stockx_sync_trigger, alias_sync_trigger';
  RAISE NOTICE '  - Indexes: 3 indexes for performance';
  RAISE NOTICE '  - RLS: Service role + user SELECT access';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Next Steps:';
  RAISE NOTICE '  1. Run worker: npx tsx scripts/inventory-v4-sync-worker.ts';
  RAISE NOTICE '  2. Test by updating a row in inventory_v4_style_catalog';
  RAISE NOTICE '';
END $$;
