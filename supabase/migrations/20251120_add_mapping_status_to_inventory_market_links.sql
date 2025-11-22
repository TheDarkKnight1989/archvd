-- ============================================================================
-- Phase 3.11: Add mapping_status field to inventory_market_links
-- ============================================================================
-- Purpose: Track the health/validity of StockX product mappings
-- Values:
--   'ok'          - Mapping is valid, API returns 200
--   'stockx_404'  - StockX API returns 404 for this product/variant
--   'invalid'     - Mapping manually marked as invalid
--   'unmapped'    - Not yet mapped to StockX
-- ============================================================================

-- Add mapping_status column
ALTER TABLE inventory_market_links
ADD COLUMN IF NOT EXISTS mapping_status TEXT DEFAULT 'ok' CHECK (
  mapping_status IN ('ok', 'stockx_404', 'invalid', 'unmapped')
);

-- Add last_sync_success_at column to track when API last returned 200
ALTER TABLE inventory_market_links
ADD COLUMN IF NOT EXISTS last_sync_success_at TIMESTAMPTZ;

-- Add last_sync_error column to store error messages
ALTER TABLE inventory_market_links
ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

-- Create index on mapping_status for filtering
CREATE INDEX IF NOT EXISTS idx_inventory_market_links_status
  ON inventory_market_links(mapping_status)
  WHERE mapping_status != 'ok';

-- Add comments
COMMENT ON COLUMN inventory_market_links.mapping_status IS 'Status of StockX mapping: ok | stockx_404 | invalid | unmapped';
COMMENT ON COLUMN inventory_market_links.last_sync_success_at IS 'Timestamp of last successful API sync (HTTP 200)';
COMMENT ON COLUMN inventory_market_links.last_sync_error IS 'Error message from last failed sync attempt';

-- Migration complete
