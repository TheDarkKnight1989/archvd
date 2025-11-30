-- Migration: Add StockX Listing Sync Columns
-- Purpose: Enable manual and automated sync of StockX listing statuses
-- Date: 2025-11-30

-- ============================================================================
-- 1. Add sync columns to inventory_market_links
-- ============================================================================

ALTER TABLE inventory_market_links
ADD COLUMN IF NOT EXISTS stockx_listing_status TEXT DEFAULT 'UNKNOWN',
ADD COLUMN IF NOT EXISTS stockx_last_listing_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stockx_listing_payload JSONB;

-- Add index for efficient status filtering
CREATE INDEX IF NOT EXISTS idx_inventory_market_links_stockx_status
  ON inventory_market_links (stockx_listing_status);

-- Add comments for documentation
COMMENT ON COLUMN inventory_market_links.stockx_listing_status IS
  'Mirror of StockX listing.status. NULL = never synced, UNKNOWN = legacy rows before sync introduced, MISSING = listing no longer exists on StockX';

COMMENT ON COLUMN inventory_market_links.stockx_last_listing_sync_at IS
  'Timestamp of last successful listing status sync from StockX';

COMMENT ON COLUMN inventory_market_links.stockx_listing_payload IS
  'Full JSON listing object from StockX API for debugging and audit trail';

-- ============================================================================
-- 2. Add last sync timestamp to stockx_accounts
-- ============================================================================

ALTER TABLE stockx_accounts
ADD COLUMN IF NOT EXISTS last_listing_sync_at TIMESTAMPTZ;

COMMENT ON COLUMN stockx_accounts.last_listing_sync_at IS
  'Timestamp of last successful listing sync for this user';
