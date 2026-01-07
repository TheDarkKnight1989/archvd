-- ============================================================================
-- FIX: Handle non-numeric sizes (e.g., "14W" for women's shoes)
-- Date: 2025-12-14
-- Issue: COALESCE(size_numeric, size_display::NUMERIC) fails for "14W"
-- Solution: Use text-based sorting fallback for non-numeric sizes
-- ============================================================================

-- Drop existing functions (parameter list changed)
DROP FUNCTION IF EXISTS get_unified_market_data(TEXT, TEXT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS get_unified_market_data_batch(TEXT[], TEXT[], TEXT, BOOLEAN, TEXT, INT);

-- ============================================================================
-- FUNCTION: get_unified_market_data (FIXED)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_unified_market_data(
  p_style_id TEXT,
  p_alias_region TEXT DEFAULT '1',
  p_consigned BOOLEAN DEFAULT false,
  p_stockx_currency TEXT DEFAULT 'GBP'
)
RETURNS TABLE (
  size_display TEXT,
  size_numeric NUMERIC(6,2),
  stockx_variant_id UUID,
  stockx_lowest_ask NUMERIC(12,2),
  stockx_highest_bid NUMERIC(12,2),
  stockx_flex_lowest_ask NUMERIC(12,2),
  stockx_earn_more NUMERIC(12,2),
  stockx_sell_faster NUMERIC(12,2),
  stockx_currency TEXT,
  stockx_updated_at TIMESTAMPTZ,
  alias_variant_id BIGINT,
  alias_lowest_ask NUMERIC(12,2),
  alias_highest_bid NUMERIC(12,2),
  alias_last_sale NUMERIC(12,2),
  alias_global_indicator NUMERIC(12,2),
  alias_currency TEXT,
  alias_updated_at TIMESTAMPTZ,
  has_stockx BOOLEAN,
  has_alias BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  WITH style AS (
    SELECT
      style_id,
      stockx_product_id,
      alias_catalog_id
    FROM inventory_v4_style_catalog
    WHERE style_id = p_style_id
  ),
  stockx_data AS (
    SELECT
      sv.stockx_variant_id,
      sv.variant_value AS size_display,
      -- Extract numeric part from size (handles "10W" -> 10, "10.5W" -> 10.5)
      CASE
        WHEN sv.variant_value ~ '^[0-9]+\.?[0-9]*'
        THEN (regexp_match(sv.variant_value, '^([0-9]+\.?[0-9]*)'))[1]::NUMERIC(6,2)
        ELSE NULL
      END AS size_numeric,
      sm.lowest_ask,
      sm.highest_bid,
      sm.flex_lowest_ask,
      sm.earn_more,
      sm.sell_faster,
      sm.currency_code,
      sm.updated_at
    FROM style s
    JOIN inventory_v4_stockx_variants sv ON sv.stockx_product_id = s.stockx_product_id
    LEFT JOIN inventory_v4_stockx_market_data sm
      ON sm.stockx_variant_id = sv.stockx_variant_id
      AND sm.currency_code = p_stockx_currency
    WHERE s.stockx_product_id IS NOT NULL
  ),
  alias_data AS (
    SELECT
      av.id AS alias_variant_id,
      av.size_display,
      av.size_value AS size_numeric,
      am.lowest_ask,
      am.highest_bid,
      am.last_sale_price,
      am.global_indicator_price,
      am.currency_code,
      am.updated_at
    FROM style s
    JOIN inventory_v4_alias_variants av ON av.alias_catalog_id = s.alias_catalog_id
    LEFT JOIN inventory_v4_alias_market_data am ON am.alias_variant_id = av.id
    WHERE s.alias_catalog_id IS NOT NULL
      AND av.region_id = p_alias_region
      AND av.consigned = p_consigned
  )
  -- FIXED: Use size_numeric for DISTINCT ON, with text fallback that doesn't cast
  SELECT DISTINCT ON (COALESCE(size_numeric::TEXT, size_display))
    size_display,
    size_numeric,
    stockx_variant_id,
    stockx_lowest_ask,
    stockx_highest_bid,
    stockx_flex_lowest_ask,
    stockx_earn_more,
    stockx_sell_faster,
    stockx_currency,
    stockx_updated_at,
    alias_variant_id,
    alias_lowest_ask,
    alias_highest_bid,
    alias_last_sale,
    alias_global_indicator,
    alias_currency,
    alias_updated_at,
    has_stockx,
    has_alias
  FROM (
    -- StockX with Alias match on size_numeric
    SELECT
      COALESCE(sx.size_display, al.size_display) AS size_display,
      COALESCE(sx.size_numeric, al.size_numeric) AS size_numeric,
      sx.stockx_variant_id,
      sx.lowest_ask AS stockx_lowest_ask,
      sx.highest_bid AS stockx_highest_bid,
      sx.flex_lowest_ask AS stockx_flex_lowest_ask,
      sx.earn_more AS stockx_earn_more,
      sx.sell_faster AS stockx_sell_faster,
      sx.currency_code AS stockx_currency,
      sx.updated_at AS stockx_updated_at,
      al.alias_variant_id,
      al.lowest_ask AS alias_lowest_ask,
      al.highest_bid AS alias_highest_bid,
      al.last_sale_price AS alias_last_sale,
      al.global_indicator_price AS alias_global_indicator,
      al.currency_code AS alias_currency,
      al.updated_at AS alias_updated_at,
      true AS has_stockx,
      al.alias_variant_id IS NOT NULL AS has_alias
    FROM stockx_data sx
    LEFT JOIN alias_data al ON sx.size_numeric = al.size_numeric
    WHERE sx.size_numeric IS NOT NULL

    UNION ALL

    -- StockX with Alias match on size_display (for non-numeric sizes)
    SELECT
      COALESCE(sx.size_display, al.size_display) AS size_display,
      COALESCE(sx.size_numeric, al.size_numeric) AS size_numeric,
      sx.stockx_variant_id,
      sx.lowest_ask AS stockx_lowest_ask,
      sx.highest_bid AS stockx_highest_bid,
      sx.flex_lowest_ask AS stockx_flex_lowest_ask,
      sx.earn_more AS stockx_earn_more,
      sx.sell_faster AS stockx_sell_faster,
      sx.currency_code AS stockx_currency,
      sx.updated_at AS stockx_updated_at,
      al.alias_variant_id,
      al.lowest_ask AS alias_lowest_ask,
      al.highest_bid AS alias_highest_bid,
      al.last_sale_price AS alias_last_sale,
      al.global_indicator_price AS alias_global_indicator,
      al.currency_code AS alias_currency,
      al.updated_at AS alias_updated_at,
      true AS has_stockx,
      al.alias_variant_id IS NOT NULL AS has_alias
    FROM stockx_data sx
    LEFT JOIN alias_data al ON sx.size_display = al.size_display
    WHERE sx.size_numeric IS NULL

    UNION ALL

    -- Alias-only rows (no StockX match)
    SELECT
      al.size_display,
      al.size_numeric,
      NULL::UUID AS stockx_variant_id,
      NULL::NUMERIC(12,2) AS stockx_lowest_ask,
      NULL::NUMERIC(12,2) AS stockx_highest_bid,
      NULL::NUMERIC(12,2) AS stockx_flex_lowest_ask,
      NULL::NUMERIC(12,2) AS stockx_earn_more,
      NULL::NUMERIC(12,2) AS stockx_sell_faster,
      NULL::TEXT AS stockx_currency,
      NULL::TIMESTAMPTZ AS stockx_updated_at,
      al.alias_variant_id,
      al.lowest_ask AS alias_lowest_ask,
      al.highest_bid AS alias_highest_bid,
      al.last_sale_price AS alias_last_sale,
      al.global_indicator_price AS alias_global_indicator,
      al.currency_code AS alias_currency,
      al.updated_at AS alias_updated_at,
      false AS has_stockx,
      true AS has_alias
    FROM alias_data al
    WHERE NOT EXISTS (
      SELECT 1 FROM stockx_data sx
      WHERE (sx.size_numeric = al.size_numeric AND sx.size_numeric IS NOT NULL)
         OR (sx.size_numeric IS NULL AND al.size_numeric IS NULL AND sx.size_display = al.size_display)
    )
  ) combined
  -- FIXED: Sort by numeric first, then text for non-numeric
  ORDER BY COALESCE(size_numeric::TEXT, size_display), size_numeric NULLS LAST;
$$;

-- ============================================================================
-- FUNCTION: get_unified_market_data_batch (FIXED)
-- ============================================================================

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
  WHERE umd.size_display = ANY(p_sizes)
  LIMIT p_limit;
$$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_unified_market_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_market_data TO anon;
GRANT EXECUTE ON FUNCTION get_unified_market_data_batch TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_market_data_batch TO anon;
