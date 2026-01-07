-- ============================================================================
-- UNIFIED MARKET DATA - Simple Join Function
-- Date: 2025-12-11
-- Purpose: Query both StockX and Alias market data via style_catalog join
-- Pattern: Simple parameterized query (not materialized view)
-- ============================================================================

-- ============================================================================
-- FUNCTION: get_unified_market_data
-- ============================================================================
-- Purpose: Get combined market data for a SKU across StockX and Alias
-- Usage: SELECT * FROM get_unified_market_data('DD1391-100', '1', false)
--
-- Parameters:
--   p_style_id     - SKU (e.g., 'DD1391-100')
--   p_alias_region - Alias region ('1'=UK, '2'=EU, '3'=US)
--   p_consigned    - Include consigned listings (default false = new only)
--
-- Returns: One row per size with both providers' pricing
-- ============================================================================

CREATE OR REPLACE FUNCTION get_unified_market_data(
  p_style_id TEXT,
  p_alias_region TEXT DEFAULT '1',
  p_consigned BOOLEAN DEFAULT false
)
RETURNS TABLE (
  -- Size info
  size_display TEXT,
  size_numeric NUMERIC(6,2),

  -- StockX data
  stockx_variant_id UUID,
  stockx_lowest_ask NUMERIC(12,2),
  stockx_highest_bid NUMERIC(12,2),
  stockx_flex_lowest_ask NUMERIC(12,2),
  stockx_earn_more NUMERIC(12,2),
  stockx_sell_faster NUMERIC(12,2),
  stockx_currency TEXT,
  stockx_updated_at TIMESTAMPTZ,

  -- Alias data
  alias_variant_id BIGINT,
  alias_lowest_ask NUMERIC(12,2),
  alias_highest_bid NUMERIC(12,2),
  alias_last_sale NUMERIC(12,2),
  alias_global_indicator NUMERIC(12,2),
  alias_currency TEXT,
  alias_updated_at TIMESTAMPTZ,

  -- Provider flags
  has_stockx BOOLEAN,
  has_alias BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  WITH style AS (
    -- Get the style catalog entry
    SELECT
      style_id,
      stockx_product_id,
      alias_catalog_id
    FROM inventory_v4_style_catalog
    WHERE style_id = p_style_id
  ),
  stockx_data AS (
    -- Get StockX variants + market data
    SELECT
      sv.stockx_variant_id,
      sv.variant_value AS size_display,
      -- Try to cast to numeric, fallback to NULL for non-numeric sizes
      CASE
        WHEN sv.variant_value ~ '^[0-9]+\.?[0-9]*$'
        THEN sv.variant_value::NUMERIC(6,2)
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
    LEFT JOIN inventory_v4_stockx_market_data sm ON sm.stockx_variant_id = sv.stockx_variant_id
    WHERE s.stockx_product_id IS NOT NULL
  ),
  alias_data AS (
    -- Get Alias variants + market data for specified region
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
  -- Use UNION approach since FULL OUTER JOIN doesn't support OR conditions in PostgreSQL
  -- 1. StockX rows with matched Alias (by size_numeric or size_display)
  -- 2. StockX rows with no Alias match
  -- 3. Alias rows with no StockX match
  SELECT DISTINCT ON (COALESCE(size_numeric, size_display::NUMERIC))
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
  ORDER BY COALESCE(size_numeric, size_display::NUMERIC) NULLS LAST;
$$;

-- ============================================================================
-- FUNCTION: get_unified_market_data_batch
-- ============================================================================
-- Purpose: Get combined market data for MULTIPLE SKUs (for inventory table)
-- Usage: SELECT * FROM get_unified_market_data_batch(ARRAY['DD1391-100', 'DZ5485-612'], ARRAY['10', '11'], '1', false, 500)
--
-- Parameters:
--   p_style_ids    - Array of SKUs
--   p_sizes        - Array of sizes to fetch (matches by size_display)
--   p_alias_region - Alias region ('1'=UK, '2'=EU, '3'=US)
--   p_consigned    - Include consigned listings (default false = new only)
--   p_limit        - Max rows to return (default 500, prevents runaway queries)
--
-- Returns: One row per SKU+size combination
-- Implementation: Uses LATERAL join to call single-SKU function, avoiding cross-join bugs
-- ============================================================================

CREATE OR REPLACE FUNCTION get_unified_market_data_batch(
  p_style_ids TEXT[],
  p_sizes TEXT[],
  p_alias_region TEXT DEFAULT '1',
  p_consigned BOOLEAN DEFAULT false,
  p_limit INT DEFAULT 500
)
RETURNS TABLE (
  -- Identity
  style_id TEXT,
  size_display TEXT,

  -- StockX data
  stockx_lowest_ask NUMERIC(12,2),
  stockx_highest_bid NUMERIC(12,2),
  stockx_currency TEXT,

  -- Alias data
  alias_lowest_ask NUMERIC(12,2),
  alias_highest_bid NUMERIC(12,2),
  alias_currency TEXT,

  -- Provider flags
  has_stockx BOOLEAN,
  has_alias BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  -- Reuse single-SKU function via LATERAL to avoid cross-join between StockX and Alias
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
  CROSS JOIN LATERAL get_unified_market_data(s.style_id, p_alias_region, p_consigned) AS umd
  WHERE umd.size_display = ANY(p_sizes)
  LIMIT p_limit;
$$;

-- ============================================================================
-- ADDITIONAL INDEXES (if not already present)
-- ============================================================================

-- Composite index for the batch function join
CREATE INDEX IF NOT EXISTS idx_stockx_variants_product_value
  ON inventory_v4_stockx_variants(stockx_product_id, variant_value);

CREATE INDEX IF NOT EXISTS idx_alias_variants_catalog_size_region
  ON inventory_v4_alias_variants(alias_catalog_id, size_display, region_id)
  WHERE consigned = false;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_unified_market_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_market_data TO anon;
GRANT EXECUTE ON FUNCTION get_unified_market_data_batch TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_market_data_batch TO anon;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_unified_market_data IS
  'Get combined StockX + Alias market data for a single SKU. Returns all sizes with pricing from both providers.';

COMMENT ON FUNCTION get_unified_market_data_batch IS
  'Get combined StockX + Alias market data for multiple SKUs + sizes. Optimized for inventory table queries.';
