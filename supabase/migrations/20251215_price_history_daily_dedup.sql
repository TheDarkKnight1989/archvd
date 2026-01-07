-- ============================================================================
-- Migration: Daily Dedup for Price History
-- ============================================================================
-- Problem: Running sync multiple times per day creates redundant rows
-- Solution: One row per (variant, currency, day) - UPSERT overwrites
-- ============================================================================

-- Step 1: Add snapshot_date column with default CURRENT_DATE
ALTER TABLE inventory_v4_stockx_price_history
ADD COLUMN IF NOT EXISTS snapshot_date DATE DEFAULT CURRENT_DATE;

-- Step 2: Backfill existing rows (set snapshot_date from recorded_at)
UPDATE inventory_v4_stockx_price_history
SET snapshot_date = DATE(recorded_at)
WHERE snapshot_date IS NULL OR snapshot_date = CURRENT_DATE;

-- Step 3: Remove duplicates - keep latest entry per day
-- This deletes older duplicates, keeping only the most recent per day
DELETE FROM inventory_v4_stockx_price_history a
USING inventory_v4_stockx_price_history b
WHERE a.stockx_variant_id = b.stockx_variant_id
  AND a.currency_code = b.currency_code
  AND a.snapshot_date = b.snapshot_date
  AND a.recorded_at < b.recorded_at;

-- Step 4: Add unique constraint for UPSERT
-- This ensures only one row per (variant, currency, day)
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_history_daily_unique
ON inventory_v4_stockx_price_history(stockx_variant_id, currency_code, snapshot_date);

-- Step 5: Add index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_price_history_snapshot_date
ON inventory_v4_stockx_price_history(snapshot_date DESC);

COMMENT ON COLUMN inventory_v4_stockx_price_history.snapshot_date IS
  'Date of the snapshot (one row per variant+currency+day). UPSERT overwrites if re-synced same day.';
