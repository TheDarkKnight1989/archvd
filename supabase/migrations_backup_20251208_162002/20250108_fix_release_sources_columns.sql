-- Fix release_sources_whitelist column names
-- The table was created with 'domain' and 'name' but should use 'source_name' and 'source_url'

-- Check if old columns exist and rename them
DO $$
BEGIN
  -- Rename 'name' to 'source_name' if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'release_sources_whitelist'
    AND column_name = 'name'
  ) THEN
    ALTER TABLE public.release_sources_whitelist RENAME COLUMN name TO source_name;
  END IF;

  -- Rename 'domain' to 'source_url' if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'release_sources_whitelist'
    AND column_name = 'domain'
  ) THEN
    ALTER TABLE public.release_sources_whitelist RENAME COLUMN domain TO source_url;
  END IF;
END $$;

-- Ensure source_name is unique and not null
DO $$
BEGIN
  -- Add unique constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'release_sources_whitelist_source_name_key'
  ) THEN
    ALTER TABLE public.release_sources_whitelist
    ADD CONSTRAINT release_sources_whitelist_source_name_key UNIQUE (source_name);
  END IF;

  -- Make source_name NOT NULL if not already
  ALTER TABLE public.release_sources_whitelist
  ALTER COLUMN source_name SET NOT NULL;

  -- Make source_url NOT NULL if not already
  ALTER TABLE public.release_sources_whitelist
  ALTER COLUMN source_url SET NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Column constraints may already exist
    NULL;
END $$;

-- Create worker_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.worker_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL, -- success, partial_success, failed
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_logs_worker_name ON public.worker_logs(worker_name);
CREATE INDEX IF NOT EXISTS idx_worker_logs_started_at ON public.worker_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_logs_status ON public.worker_logs(status);

ALTER TABLE public.worker_logs DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.worker_logs IS 'Execution logs for background workers';
COMMENT ON COLUMN public.worker_logs.metrics IS 'JSON metrics: sources_processed, items_updated, errors, etc';
