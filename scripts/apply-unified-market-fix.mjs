import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Read the migration file
const sql = fs.readFileSync('supabase/migrations/20251211_unified_market_data.sql', 'utf-8')

console.log('Applying unified market data migration...')

// Execute via rpc (supabase doesn't have a direct SQL execute, so we need to use pg)
// Actually, let's just extract and run the CREATE FUNCTION statements

// For Supabase, we need to use the SQL editor or dashboard
// Let's create a simpler approach - just the function definition

const functionSql = `
CREATE OR REPLACE FUNCTION get_unified_market_data(
  p_style_id TEXT,
  p_alias_region TEXT DEFAULT '1',
  p_consigned BOOLEAN DEFAULT false
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
    SELECT style_id, stockx_product_id, alias_catalog_id
    FROM inventory_v4_style_catalog
    WHERE style_id = p_style_id
  ),
  stockx_data AS (
    SELECT
      sv.stockx_variant_id,
      sv.variant_value AS size_display,
      CASE WHEN sv.variant_value ~ '^[0-9]+\\.?[0-9]*$' THEN sv.variant_value::NUMERIC(6,2) ELSE NULL END AS size_numeric,
      sm.lowest_ask, sm.highest_bid, sm.flex_lowest_ask, sm.earn_more, sm.sell_faster, sm.currency_code, sm.updated_at
    FROM style s
    JOIN inventory_v4_stockx_variants sv ON sv.stockx_product_id = s.stockx_product_id
    LEFT JOIN inventory_v4_stockx_market_data sm ON sm.stockx_variant_id = sv.stockx_variant_id
    WHERE s.stockx_product_id IS NOT NULL
  ),
  alias_data AS (
    SELECT
      av.id AS alias_variant_id, av.size_display, av.size_value AS size_numeric,
      am.lowest_ask, am.highest_bid, am.last_sale_price, am.global_indicator_price, am.currency_code, am.updated_at
    FROM style s
    JOIN inventory_v4_alias_variants av ON av.alias_catalog_id = s.alias_catalog_id
    LEFT JOIN inventory_v4_alias_market_data am ON am.alias_variant_id = av.id
    WHERE s.alias_catalog_id IS NOT NULL AND av.region_id = p_alias_region AND av.consigned = p_consigned
  )
  SELECT DISTINCT ON (COALESCE(size_numeric, size_display::NUMERIC))
    size_display, size_numeric, stockx_variant_id, stockx_lowest_ask, stockx_highest_bid,
    stockx_flex_lowest_ask, stockx_earn_more, stockx_sell_faster, stockx_currency, stockx_updated_at,
    alias_variant_id, alias_lowest_ask, alias_highest_bid, alias_last_sale, alias_global_indicator,
    alias_currency, alias_updated_at, has_stockx, has_alias
  FROM (
    SELECT COALESCE(sx.size_display, al.size_display) AS size_display, COALESCE(sx.size_numeric, al.size_numeric) AS size_numeric,
      sx.stockx_variant_id, sx.lowest_ask AS stockx_lowest_ask, sx.highest_bid AS stockx_highest_bid,
      sx.flex_lowest_ask AS stockx_flex_lowest_ask, sx.earn_more AS stockx_earn_more, sx.sell_faster AS stockx_sell_faster,
      sx.currency_code AS stockx_currency, sx.updated_at AS stockx_updated_at,
      al.alias_variant_id, al.lowest_ask AS alias_lowest_ask, al.highest_bid AS alias_highest_bid,
      al.last_sale_price AS alias_last_sale, al.global_indicator_price AS alias_global_indicator,
      al.currency_code AS alias_currency, al.updated_at AS alias_updated_at,
      true AS has_stockx, al.alias_variant_id IS NOT NULL AS has_alias
    FROM stockx_data sx LEFT JOIN alias_data al ON sx.size_numeric = al.size_numeric WHERE sx.size_numeric IS NOT NULL
    UNION ALL
    SELECT COALESCE(sx.size_display, al.size_display), COALESCE(sx.size_numeric, al.size_numeric),
      sx.stockx_variant_id, sx.lowest_ask, sx.highest_bid, sx.flex_lowest_ask, sx.earn_more, sx.sell_faster,
      sx.currency_code, sx.updated_at, al.alias_variant_id, al.lowest_ask, al.highest_bid, al.last_sale_price,
      al.global_indicator_price, al.currency_code, al.updated_at, true, al.alias_variant_id IS NOT NULL
    FROM stockx_data sx LEFT JOIN alias_data al ON sx.size_display = al.size_display WHERE sx.size_numeric IS NULL
    UNION ALL
    SELECT al.size_display, al.size_numeric, NULL::UUID, NULL::NUMERIC(12,2), NULL::NUMERIC(12,2), NULL::NUMERIC(12,2),
      NULL::NUMERIC(12,2), NULL::NUMERIC(12,2), NULL::TEXT, NULL::TIMESTAMPTZ, al.alias_variant_id, al.lowest_ask,
      al.highest_bid, al.last_sale_price, al.global_indicator_price, al.currency_code, al.updated_at, false, true
    FROM alias_data al WHERE NOT EXISTS (
      SELECT 1 FROM stockx_data sx WHERE (sx.size_numeric = al.size_numeric AND sx.size_numeric IS NOT NULL)
        OR (sx.size_numeric IS NULL AND al.size_numeric IS NULL AND sx.size_display = al.size_display)
    )
  ) combined
  ORDER BY COALESCE(size_numeric, size_display::NUMERIC) NULLS LAST;
$$;
`

console.log('SQL to apply manually in Supabase Dashboard > SQL Editor:')
console.log('---')
console.log(functionSql)
console.log('---')
console.log('\nOr copy the full migration file and run it in the SQL Editor.')
