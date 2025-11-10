-- =============================================================================
-- Sprint: Alpha Hardening - Sneaker Parity (Mock) + Portfolio True Value
-- Migration: Sneaker market pricing schema + Portfolio value daily MV
-- Date: 2025-11-11
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- A) SNEAKER MARKET PRICING SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────

-- A1. Sneaker Market Prices Table (mock data only, no scrapers)
-- Similar to trading_card_market_snapshots but with size field
CREATE TABLE IF NOT EXISTS public.sneaker_market_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL REFERENCES product_catalog(sku) ON DELETE CASCADE,
  size text NOT NULL, -- e.g. 'UK9', 'UK10', 'US10', etc.
  source text NOT NULL DEFAULT 'mock-stockx', -- 'mock-stockx', 'mock-goat', etc.
  snapshot_date timestamptz NOT NULL DEFAULT NOW(),
  min_price numeric(10, 2),
  median_price numeric(10, 2),
  p75_price numeric(10, 2), -- 75th percentile
  max_price numeric(10, 2),
  listing_count integer DEFAULT 0,
  currency text DEFAULT 'GBP',
  metadata jsonb DEFAULT '{}'::jsonb, -- stores mock generation params, etc.
  created_at timestamptz DEFAULT NOW(),
  UNIQUE(sku, size, source, snapshot_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sneaker_market_prices_sku
  ON public.sneaker_market_prices(sku);

CREATE INDEX IF NOT EXISTS idx_sneaker_market_prices_sku_size
  ON public.sneaker_market_prices(sku, size);

CREATE INDEX IF NOT EXISTS idx_sneaker_market_prices_date
  ON public.sneaker_market_prices(snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_sneaker_market_prices_sku_size_source
  ON public.sneaker_market_prices(sku, size, source);

-- A2. Sneaker Latest Prices View
-- Returns most recent price snapshot per SKU+size+source
CREATE OR REPLACE VIEW public.sneaker_latest_prices
WITH (security_invoker = on) AS
SELECT DISTINCT ON (p.sku, p.size, p.source)
  p.sku,
  p.size,
  p.source,
  p.snapshot_date AS as_of,
  p.min_price,
  p.median_price,
  p.p75_price,
  p.max_price,
  p.listing_count,
  p.currency,
  c.brand,
  c.model,
  c.colorway,
  c.image_url
FROM sneaker_market_prices p
JOIN product_catalog c ON p.sku = c.sku
ORDER BY p.sku, p.size, p.source, p.snapshot_date DESC;

-- A3. Sneaker Price Daily Medians (Materialized View)
-- Aggregates daily median prices per SKU+size for last 30 days
CREATE MATERIALIZED VIEW IF NOT EXISTS public.sneaker_price_daily_medians AS
SELECT
  sku,
  size,
  DATE(snapshot_date) as day,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY median_price::numeric) as median_price,
  currency,
  COUNT(*) as data_points,
  MAX(snapshot_date) as latest_snapshot
FROM sneaker_market_prices
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY sku, size, DATE(snapshot_date), currency
ORDER BY sku, size, day DESC;

-- Indexes for daily medians MV
CREATE UNIQUE INDEX IF NOT EXISTS idx_sneaker_daily_medians_sku_size_day
  ON public.sneaker_price_daily_medians(sku, size, day DESC);

CREATE INDEX IF NOT EXISTS idx_sneaker_daily_medians_day
  ON public.sneaker_price_daily_medians(day DESC);

-- A4. Refresh function for sneaker daily medians
CREATE OR REPLACE FUNCTION public.refresh_sneaker_daily_medians()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY sneaker_price_daily_medians;
END;
$$;

-- A5. RLS Policies for sneaker tables
ALTER TABLE public.sneaker_market_prices ENABLE ROW LEVEL SECURITY;

-- Authenticated users can SELECT
CREATE POLICY "Authenticated users can view sneaker market prices"
  ON public.sneaker_market_prices
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role can INSERT/UPDATE/DELETE
CREATE POLICY "Service role can manage sneaker market prices"
  ON public.sneaker_market_prices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.sneaker_market_prices TO authenticated;
GRANT SELECT ON public.sneaker_latest_prices TO authenticated;
GRANT SELECT ON public.sneaker_price_daily_medians TO authenticated;
GRANT ALL ON public.sneaker_market_prices TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- B) PORTFOLIO VALUE DAILY (Materialized View)
-- ─────────────────────────────────────────────────────────────────────────────

-- B1. Portfolio Value Daily Materialized View
-- Computes daily portfolio value per user for last 30 days
-- Combines Pokémon (tcg_price_daily_medians) + Sneakers (sneaker_price_daily_medians)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.portfolio_value_daily AS
WITH date_series AS (
  -- Generate last 30 days
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '29 days',
    CURRENT_DATE,
    INTERVAL '1 day'
  )::date AS day
),
user_items AS (
  -- Get all active portfolio items (not sold)
  SELECT
    user_id,
    id AS item_id,
    sku,
    size_uk,
    category,
    purchase_price,
    purchase_date::date AS purchase_date,
    status
  FROM "Inventory"
  WHERE status IN ('active', 'listed', 'worn')
),
item_daily_prices AS (
  -- For each item, get price for each day (fallback to last available)
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
      -- Sneakers: use sneaker_price_daily_medians
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
      -- Fallback to purchase price for other categories or missing data
      ELSE ui.purchase_price
    END AS price_gbp
  FROM user_items ui
  CROSS JOIN date_series ds
  WHERE ds.day >= ui.purchase_date -- Only include items purchased before or on this day
)
SELECT
  user_id,
  day,
  SUM(COALESCE(price_gbp, 0)) AS value_base_gbp,
  COUNT(item_id) AS item_count,
  NOW() AS computed_at
FROM item_daily_prices
GROUP BY user_id, day
ORDER BY user_id, day DESC;

-- Indexes for portfolio value daily MV
CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_value_daily_user_day
  ON public.portfolio_value_daily(user_id, day DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_value_daily_day
  ON public.portfolio_value_daily(day DESC);

-- B2. Refresh function for portfolio value daily
CREATE OR REPLACE FUNCTION public.refresh_portfolio_value_daily(p_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Note: For now, we refresh the entire MV since we can't partially refresh
  -- In production, consider pg_cron or external scheduler
  REFRESH MATERIALIZED VIEW CONCURRENTLY portfolio_value_daily;
END;
$$;

-- B3. RLS and permissions for portfolio value daily
-- RLS is not applicable to materialized views, but we control access via grants
GRANT SELECT ON public.portfolio_value_daily TO authenticated;

-- Note: Users can only see their own data via WHERE user_id = auth.uid() in queries

-- ─────────────────────────────────────────────────────────────────────────────
-- C) HELPER FUNCTIONS & COMMENTS
-- ─────────────────────────────────────────────────────────────────────────────

-- Comment the tables and views
COMMENT ON TABLE public.sneaker_market_prices IS
  'Mock sneaker market price snapshots. Similar to trading_card_market_snapshots but with size field. Service role only for writes.';

COMMENT ON VIEW public.sneaker_latest_prices IS
  'Latest sneaker price snapshot per SKU+size+source. Used for Quick-Add overlay and portfolio enrichment.';

COMMENT ON MATERIALIZED VIEW public.sneaker_price_daily_medians IS
  'Daily median sneaker prices per SKU+size for last 30 days. Refresh via refresh_sneaker_daily_medians() function.';

COMMENT ON MATERIALIZED VIEW public.portfolio_value_daily IS
  'Daily portfolio value per user for last 30 days. Combines Pokémon + Sneaker prices. Refresh via refresh_portfolio_value_daily() function.';

COMMENT ON FUNCTION public.refresh_sneaker_daily_medians IS
  'Refreshes sneaker_price_daily_medians materialized view. Call after bulk price updates.';

COMMENT ON FUNCTION public.refresh_portfolio_value_daily IS
  'Refreshes portfolio_value_daily materialized view. Call after inventory changes or price updates.';

-- ─────────────────────────────────────────────────────────────────────────────
-- D) INITIAL DATA REFRESH
-- ─────────────────────────────────────────────────────────────────────────────

-- Refresh the materialized views (will be empty until seed script runs)
REFRESH MATERIALIZED VIEW sneaker_price_daily_medians;
REFRESH MATERIALIZED VIEW portfolio_value_daily;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20251111_sneaker_mock_and_portfolio_value_daily completed successfully';
  RAISE NOTICE '📦 Next steps:';
  RAISE NOTICE '   1. Run: npm run seed:sneakers (to seed mock sneaker data)';
  RAISE NOTICE '   2. Run: npm run seed:portfolio (to seed portfolio items)';
  RAISE NOTICE '   3. Refresh MVs: SELECT refresh_sneaker_daily_medians(); SELECT refresh_portfolio_value_daily();';
END $$;
