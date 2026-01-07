-- ============================================================================
-- Migration: Admin Sync Jobs Table for Progress Tracking
-- ============================================================================
-- This table tracks bulk sync job progress for the admin/styles page
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'catalog_sync',
  total_items INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NULL
);

-- Index for finding running jobs by user
CREATE INDEX IF NOT EXISTS idx_admin_sync_jobs_user_running
ON admin_sync_jobs(user_id, completed_at)
WHERE completed_at IS NULL;

-- Index for finding last completed job
CREATE INDEX IF NOT EXISTS idx_admin_sync_jobs_user_completed
ON admin_sync_jobs(user_id, completed_at DESC)
WHERE completed_at IS NOT NULL;

-- RLS Policies
ALTER TABLE admin_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Users can see their own jobs
CREATE POLICY "Users can view their own sync jobs"
ON admin_sync_jobs FOR SELECT
USING (auth.uid() = user_id);

-- Service role can do everything (needed for API route)
CREATE POLICY "Service role can manage all sync jobs"
ON admin_sync_jobs FOR ALL
USING (true)
WITH CHECK (true);

COMMENT ON TABLE admin_sync_jobs IS
'Tracks bulk sync job progress for the admin styles page. completed_at = NULL means job is running.';
