-- Add status field to stockx_accounts table
-- Tracks if the StockX connection is working or broken

-- Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stockx_accounts'
    AND column_name = 'status'
  ) THEN
    ALTER TABLE stockx_accounts
    ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE';
  END IF;
END $$;

-- Add check constraint for valid statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stockx_accounts_status_check'
  ) THEN
    ALTER TABLE stockx_accounts
    ADD CONSTRAINT stockx_accounts_status_check
    CHECK (status IN ('ACTIVE', 'BROKEN', 'EXPIRED', 'REVOKED'));
  END IF;
END $$;

-- Add index for filtering by status
CREATE INDEX IF NOT EXISTS idx_stockx_accounts_status
  ON stockx_accounts(status);

COMMENT ON COLUMN stockx_accounts.status IS 'Connection status: ACTIVE (working), BROKEN (auth failed), EXPIRED (token expired), REVOKED (user revoked access)';
