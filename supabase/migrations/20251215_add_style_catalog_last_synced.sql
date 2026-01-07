-- ============================================================================
-- Migration: Add last_synced_at to Style Catalog
-- ============================================================================
-- Tracks when each style was last synced to avoid redundant API calls
-- "Sync All" will skip items synced within the last 6 hours
-- ============================================================================

ALTER TABLE inventory_v4_style_catalog
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient filtering of stale items
CREATE INDEX IF NOT EXISTS idx_style_catalog_last_synced
ON inventory_v4_style_catalog(last_synced_at)
WHERE last_synced_at IS NOT NULL;

COMMENT ON COLUMN inventory_v4_style_catalog.last_synced_at IS
'When this style was last synced with StockX/Alias APIs. NULL = never synced.';
