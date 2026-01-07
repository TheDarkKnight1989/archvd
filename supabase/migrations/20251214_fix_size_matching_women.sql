-- ============================================================================
-- FIX: Flexible size matching for women's shoes (12 matches 12W)
-- Date: 2025-12-14
-- Issue: Exact size match fails for women's shoes (inventory has "12", StockX has "12W")
-- Solution: Match on numeric part of size, ignoring W/M suffixes
-- ============================================================================

-- Only update the batch function - single SKU function is fine
DROP FUNCTION IF EXISTS get_unified_market_data_batch(TEXT[], TEXT[], TEXT, BOOLEAN, TEXT, INT);

CREATE OR REPLACE FUNCTION get_unified_market_data_batch(
  p_style_ids TEXT[],
  p_sizes TEXT[],
  p_alias_region TEXT DEFAULT '1',
  p_consigned BOOLEAN DEFAULT false,
  p_stockx_currency TEXT DEFAULT 'GBP',
  p_limit INT DEFAULT 500
)
RETURNS TABLE (
  style_id TEXT,
  size_display TEXT,
  stockx_lowest_ask NUMERIC(12,2),
  stockx_highest_bid NUMERIC(12,2),
  stockx_currency TEXT,
  alias_lowest_ask NUMERIC(12,2),
  alias_highest_bid NUMERIC(12,2),
  alias_currency TEXT,
  has_stockx BOOLEAN,
  has_alias BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.style_id,
    umd.size_display,
    umd.stockx_lowest_ask,
    umd.stockx_highest_bid,
    umd.stockx_currency,
    umd.alias_lowest_ask,
    umd.alias_highest_bid,
    umd.alias_currency,
    umd.has_stockx,
    umd.has_alias
  FROM unnest(p_style_ids) AS s(style_id)
  CROSS JOIN LATERAL get_unified_market_data(s.style_id, p_alias_region, p_consigned, p_stockx_currency) AS umd
  WHERE
    -- Flexible size matching: extract numeric part and compare
    -- This handles: "12" matching "12W", "12M", "12", etc.
    -- Also handles: "12W" matching "12W", "12", etc.
    regexp_replace(umd.size_display, '[^0-9.]', '', 'g') = ANY(
      SELECT regexp_replace(s, '[^0-9.]', '', 'g') FROM unnest(p_sizes) AS s
    )
  LIMIT p_limit;
$$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION get_unified_market_data_batch TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_market_data_batch TO anon;

COMMENT ON FUNCTION get_unified_market_data_batch IS
  'Get combined StockX + Alias market data for multiple SKUs + sizes. Flexible size matching (12 matches 12W).';
