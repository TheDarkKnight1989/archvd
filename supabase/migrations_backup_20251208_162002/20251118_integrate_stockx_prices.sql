-- ============================================================================
-- Integrate StockX Prices into Market Price Views
-- ============================================================================
-- This migration updates the latest_market_prices view to include StockX prices
-- alongside existing market data sources (Alias, etc.)

-- Drop existing view
DROP VIEW IF EXISTS public.portfolio_latest_prices CASCADE;
DROP VIEW IF EXISTS public.latest_market_prices CASCADE;

-- Recreate latest_market_prices to include StockX data
CREATE VIEW public.latest_market_prices
WITH (security_invoker = on) AS
WITH combined_prices AS (
  -- Existing market prices from product_market_prices
  SELECT
    sku,
    size,
    source,
    currency,
    price,
    as_of,
    meta,
    created_at
  FROM public.product_market_prices

  UNION ALL

  -- StockX prices from stockx_market_prices (use last_sale as the price)
  SELECT
    sku,
    size,
    'stockx' AS source,
    currency,
    last_sale AS price,
    as_of,
    jsonb_build_object(
      'lowest_ask', lowest_ask,
      'highest_bid', highest_bid,
      'last_sale', last_sale
    ) AS meta,
    created_at
  FROM public.stockx_market_prices
  WHERE last_sale IS NOT NULL -- Only include if we have a last sale price
)
SELECT DISTINCT ON (sku, size)
  gen_random_uuid() AS id, -- Generate ID for view
  sku,
  size,
  source,
  currency,
  price,
  as_of,
  meta,
  created_at
FROM combined_prices
ORDER BY sku, size, as_of DESC, created_at DESC;

COMMENT ON VIEW public.latest_market_prices IS 'Most recent market price for each SKU/size combination (includes StockX)';

-- Recreate portfolio_latest_prices view
CREATE VIEW public.portfolio_latest_prices
WITH (security_invoker = on) AS
SELECT
  i.id,
  i.user_id,
  i.sku,
  i.size AS size_uk,
  i.category,
  i.status,
  i.purchase_price,
  i.purchase_currency,
  i.purchase_date,
  i.condition,
  i.notes,
  i.created_at,
  i.updated_at,
  -- Latest market price data
  lmp.price AS latest_market_price,
  lmp.currency AS latest_market_currency,
  lmp.source AS latest_market_source,
  lmp.as_of AS price_as_of,
  lmp.meta AS price_meta,
  -- StockX-specific indicator
  CASE
    WHEN lmp.source = 'stockx' THEN lmp.as_of
    ELSE NULL
  END AS stockx_price_as_of,
  -- Catalog data
  pc.brand,
  pc.model,
  pc.colorway,
  pc.image_url,
  pc.release_date,
  pc.retail_price,
  pc.retail_currency
FROM public."Inventory" i
LEFT JOIN public.product_catalog pc ON i.sku = pc.sku
LEFT JOIN public.latest_market_prices lmp ON i.sku = lmp.sku AND i.size = lmp.size
WHERE i.user_id = auth.uid();

COMMENT ON VIEW public.portfolio_latest_prices IS 'User inventory with latest market prices (includes StockX) and catalog data';

-- Grant access
GRANT SELECT ON public.latest_market_prices TO authenticated;
GRANT SELECT ON public.portfolio_latest_prices TO authenticated;

-- ============================================================================
-- Update sneaker_price_daily_medians to include StockX data
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS public.sneaker_price_daily_medians CASCADE;

CREATE MATERIALIZED VIEW public.sneaker_price_daily_medians AS
WITH combined_sneaker_prices AS (
  -- Existing sneaker market prices
  SELECT
    sku,
    size,
    snapshot_date,
    median_price,
    currency
  FROM public.sneaker_market_prices
  WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'

  UNION ALL

  -- StockX prices (using last_sale as price)
  SELECT
    sku,
    size,
    as_of AS snapshot_date,
    last_sale AS median_price,
    currency
  FROM public.stockx_market_prices
  WHERE as_of >= CURRENT_DATE - INTERVAL '30 days'
    AND last_sale IS NOT NULL
)
SELECT
  sku,
  size,
  DATE(snapshot_date) AS day,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY median_price::numeric) AS median_price,
  currency,
  COUNT(*) AS data_points,
  MAX(snapshot_date) AS latest_snapshot
FROM combined_sneaker_prices
GROUP BY sku, size, DATE(snapshot_date), currency
ORDER BY sku, size, day DESC;

COMMENT ON MATERIALIZED VIEW public.sneaker_price_daily_medians IS 'Daily median prices for sneakers (includes StockX)';

-- Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_sneaker_daily_medians_sku_size_day
  ON public.sneaker_price_daily_medians(sku, size, day DESC);

CREATE INDEX IF NOT EXISTS idx_sneaker_daily_medians_day
  ON public.sneaker_price_daily_medians(day DESC);

-- ============================================================================
-- Recreate portfolio_value_daily materialized view
-- ============================================================================
-- This view depends on sneaker_price_daily_medians, so we need to recreate it

DROP MATERIALIZED VIEW IF EXISTS public.portfolio_value_daily CASCADE;

CREATE MATERIALIZED VIEW public.portfolio_value_daily AS
WITH date_series AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '29 days',
    CURRENT_DATE,
    INTERVAL '1 day'
  )::date AS day
),
user_items AS (
  SELECT
    user_id,
    id AS item_id,
    sku,
    size AS size_uk,
    category,
    purchase_price,
    purchase_date::date AS purchase_date,
    status
  FROM "Inventory"
  WHERE status IN ('active', 'listed', 'worn')
),
item_daily_prices AS (
  SELECT
    ui.user_id,
    ui.item_id,
    ui.sku,
    ui.category,
    ds.day,
    CASE
      -- Pokémon: use tcg_price_daily_medians
      WHEN ui.category = 'pokemon' THEN (
        SELECT median_price
        FROM tcg_price_daily_medians tcg
        WHERE tcg.sku = ui.sku
          AND tcg.day <= ds.day
          AND tcg.currency = 'GBP'
        ORDER BY tcg.day DESC
        LIMIT 1
      )
      -- Sneakers: use sneaker_price_daily_medians (now includes StockX)
      WHEN ui.category = 'sneaker' THEN (
        SELECT median_price
        FROM sneaker_price_daily_medians sp
        WHERE sp.sku = ui.sku
          AND sp.size = ui.size_uk
          AND sp.day <= ds.day
          AND sp.currency = 'GBP'
        ORDER BY sp.day DESC
        LIMIT 1
      )
      ELSE ui.purchase_price
    END AS price_on_day
  FROM user_items ui
  CROSS JOIN date_series ds
  WHERE ds.day >= ui.purchase_date
),
daily_totals AS (
  SELECT
    user_id,
    day,
    SUM(COALESCE(price_on_day, 0)) AS value_base_gbp,
    COUNT(*) AS item_count
  FROM item_daily_prices
  GROUP BY user_id, day
)
SELECT
  user_id,
  day,
  value_base_gbp,
  item_count
FROM daily_totals
ORDER BY user_id, day DESC;

COMMENT ON MATERIALIZED VIEW public.portfolio_value_daily IS 'Daily portfolio value history (last 30 days, includes StockX prices)';

-- Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_value_daily_user_day
  ON public.portfolio_value_daily(user_id, day DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_value_daily_day
  ON public.portfolio_value_daily(day DESC);

-- Grant access
GRANT SELECT ON public.sneaker_price_daily_medians TO authenticated;
GRANT SELECT ON public.portfolio_value_daily TO authenticated;
