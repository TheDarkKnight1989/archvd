-- Create StockX Listing History Table
-- Tracks all status changes and operations on listings

CREATE TABLE IF NOT EXISTS stockx_listing_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stockx_listing_id TEXT NOT NULL,
  action TEXT NOT NULL, -- create_listing, update_listing, delete_listing, etc.
  status TEXT NOT NULL, -- ACTIVE, INACTIVE, DELETED, FAILED, TIMEOUT
  changed_by TEXT NOT NULL DEFAULT 'system', -- user_id or 'system'
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by listing ID
CREATE INDEX IF NOT EXISTS idx_stockx_listing_history_listing_id
  ON stockx_listing_history(stockx_listing_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_stockx_listing_history_changed_at
  ON stockx_listing_history(changed_at DESC);

-- Add RLS policies
ALTER TABLE stockx_listing_history ENABLE ROW LEVEL SECURITY;

-- Users can view history for their own listings
CREATE POLICY "Users can view their own listing history"
  ON stockx_listing_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stockx_listings
      WHERE stockx_listings.stockx_listing_id = stockx_listing_history.stockx_listing_id
        AND stockx_listings.user_id = auth.uid()
    )
  );

-- System can insert history entries (no user context needed)
CREATE POLICY "System can insert history entries"
  ON stockx_listing_history
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE stockx_listing_history IS 'Audit trail for all StockX listing status changes';
COMMENT ON COLUMN stockx_listing_history.action IS 'The operation that triggered this history entry (e.g., create_listing, update_listing)';
COMMENT ON COLUMN stockx_listing_history.status IS 'The resulting status after the action';
COMMENT ON COLUMN stockx_listing_history.changed_by IS 'User ID or "system" if automated';
COMMENT ON COLUMN stockx_listing_history.metadata IS 'Additional context (operation_id, job_id, error details, etc.)';
