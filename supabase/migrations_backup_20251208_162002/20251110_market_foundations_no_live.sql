-- ============================================================================
-- Market Foundations Migration (Mock-only, No Live Data)
-- Created: 2025-01-10
-- Purpose: Product catalog, market prices, watchlists, and views for portfolio
-- ============================================================================

-- ============================================================================
-- 1. Product Catalog Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_catalog (
  sku TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  colorway TEXT,
  image_url TEXT,
  retail_price NUMERIC(10, 2),
  retail_currency TEXT DEFAULT 'GBP',
  release_date DATE,
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_catalog_brand ON public.product_catalog(brand);
CREATE INDEX IF NOT EXISTS idx_product_catalog_release_date ON public.product_catalog(release_date);
CREATE INDEX IF NOT EXISTS idx_product_catalog_slug ON public.product_catalog(slug);

-- RLS: Read for authenticated users, write for service role only
ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read catalog" ON public.product_catalog;
CREATE POLICY "Authenticated users can read catalog"
  ON public.product_catalog FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role can insert catalog" ON public.product_catalog;
CREATE POLICY "Service role can insert catalog"
  ON public.product_catalog FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update catalog" ON public.product_catalog;
CREATE POLICY "Service role can update catalog"
  ON public.product_catalog FOR UPDATE
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can delete catalog" ON public.product_catalog;
CREATE POLICY "Service role can delete catalog"
  ON public.product_catalog FOR DELETE
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.product_catalog IS 'Master product catalog for sneakers (mock data)';
COMMENT ON COLUMN public.product_catalog.sku IS 'Unique SKU identifier (primary key)';
COMMENT ON COLUMN public.product_catalog.retail_currency IS 'Currency code (GBP, USD, EUR)';

-- ============================================================================
-- 2. Product Market Prices Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL REFERENCES public.product_catalog(sku) ON DELETE CASCADE,
  size TEXT NOT NULL,
  source TEXT NOT NULL, -- 'mock-stockx', 'stockx', 'laced', 'goat', etc.
  currency TEXT NOT NULL DEFAULT 'GBP',
  price NUMERIC(10, 2) NOT NULL,
  as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_price_snapshot UNIQUE (sku, size, source, as_of)
);

CREATE INDEX IF NOT EXISTS idx_product_market_prices_sku ON public.product_market_prices(sku);
CREATE INDEX IF NOT EXISTS idx_product_market_prices_sku_size ON public.product_market_prices(sku, size);
CREATE INDEX IF NOT EXISTS idx_product_market_prices_as_of ON public.product_market_prices(as_of DESC);
CREATE INDEX IF NOT EXISTS idx_product_market_prices_source ON public.product_market_prices(source);

-- RLS: Read for authenticated users, write for service role only
ALTER TABLE public.product_market_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read prices" ON public.product_market_prices;
CREATE POLICY "Authenticated users can read prices"
  ON public.product_market_prices FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role can insert prices" ON public.product_market_prices;
CREATE POLICY "Service role can insert prices"
  ON public.product_market_prices FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update prices" ON public.product_market_prices;
CREATE POLICY "Service role can update prices"
  ON public.product_market_prices FOR UPDATE
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can delete prices" ON public.product_market_prices;
CREATE POLICY "Service role can delete prices"
  ON public.product_market_prices FOR DELETE
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.product_market_prices IS 'Historical market prices per SKU/size from various sources (mock data)';
COMMENT ON COLUMN public.product_market_prices.as_of IS 'Timestamp when this price was valid';
COMMENT ON COLUMN public.product_market_prices.meta IS 'Additional price metadata (ask, bid, sales volume, etc)';

-- ============================================================================
-- 3. FX Rates Table
-- ============================================================================
-- Drop old generic fx_rates table (from 20250107 migration) and recreate with new structure
DROP TABLE IF EXISTS public.fx_rates CASCADE;

CREATE TABLE public.fx_rates (
  as_of DATE PRIMARY KEY,
  gbp_per_eur NUMERIC(10, 6) NOT NULL,
  eur_per_gbp NUMERIC(10, 6) GENERATED ALWAYS AS (1.0 / NULLIF(gbp_per_eur, 0)) STORED,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fx_rates_as_of ON public.fx_rates(as_of DESC);

-- RLS: Read for authenticated users, write for service role only
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fx rates"
  ON public.fx_rates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can insert fx rates"
  ON public.fx_rates FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update fx rates"
  ON public.fx_rates FOR UPDATE
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.fx_rates IS 'Daily FX rates for GBP/EUR conversions';
COMMENT ON COLUMN public.fx_rates.gbp_per_eur IS 'How many GBP per 1 EUR (manually set)';
COMMENT ON COLUMN public.fx_rates.eur_per_gbp IS 'How many EUR per 1 GBP (auto-calculated as 1/gbp_per_eur)';

-- ============================================================================
-- 4. Watchlists Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_watchlist_per_user UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON public.watchlists(user_id);

-- RLS: User-scoped (users can only see/modify their own watchlists)
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own watchlists" ON public.watchlists;
CREATE POLICY "Users can view their own watchlists"
  ON public.watchlists FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own watchlists" ON public.watchlists;
CREATE POLICY "Users can insert their own watchlists"
  ON public.watchlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own watchlists" ON public.watchlists;
CREATE POLICY "Users can update their own watchlists"
  ON public.watchlists FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own watchlists" ON public.watchlists;
CREATE POLICY "Users can delete their own watchlists"
  ON public.watchlists FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.watchlists IS 'User-created watchlists for tracking products';

-- ============================================================================
-- 5. Watchlist Items Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  size TEXT,
  target_price NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_watchlist_item UNIQUE (watchlist_id, sku, size)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_id ON public.watchlist_items(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_sku ON public.watchlist_items(sku);

-- RLS: User-scoped via watchlist ownership
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their watchlist items" ON public.watchlist_items;
CREATE POLICY "Users can view their watchlist items"
  ON public.watchlist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.watchlists
      WHERE watchlists.id = watchlist_items.watchlist_id
      AND watchlists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert into their watchlists" ON public.watchlist_items;
CREATE POLICY "Users can insert into their watchlists"
  ON public.watchlist_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.watchlists
      WHERE watchlists.id = watchlist_items.watchlist_id
      AND watchlists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their watchlist items" ON public.watchlist_items;
CREATE POLICY "Users can update their watchlist items"
  ON public.watchlist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.watchlists
      WHERE watchlists.id = watchlist_items.watchlist_id
      AND watchlists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their watchlist items" ON public.watchlist_items;
CREATE POLICY "Users can delete their watchlist items"
  ON public.watchlist_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.watchlists
      WHERE watchlists.id = watchlist_items.watchlist_id
      AND watchlists.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.watchlist_items IS 'Items within user watchlists';
COMMENT ON COLUMN public.watchlist_items.target_price IS 'Optional price alert threshold';

-- ============================================================================
-- 6. Views
-- ============================================================================

-- View: Latest Market Prices (most recent price per SKU/size)
DROP VIEW IF EXISTS public.latest_market_prices;
CREATE VIEW public.latest_market_prices
WITH (security_invoker = on) AS
SELECT DISTINCT ON (sku, size)
  id,
  sku,
  size,
  source,
  currency,
  price,
  as_of,
  meta,
  created_at
FROM public.product_market_prices
ORDER BY sku, size, as_of DESC, created_at DESC;

COMMENT ON VIEW public.latest_market_prices IS 'Most recent market price for each SKU/size combination';

-- View: Portfolio Latest Prices (user's inventory joined to latest market prices)
DROP VIEW IF EXISTS public.portfolio_latest_prices;
CREATE VIEW public.portfolio_latest_prices
WITH (security_invoker = on) AS
SELECT
  i.id AS inventory_id,
  i.user_id,
  i.sku,
  i.size_uk,
  i.purchase_price,
  i.status,
  pc.brand,
  pc.model,
  pc.colorway,
  pc.retail_price,
  pc.retail_currency,
  lmp.price AS market_price,
  lmp.currency AS market_currency,
  lmp.source AS market_source,
  lmp.as_of AS market_as_of,
  -- Calculate P/L (assumes both in same currency for now)
  CASE
    WHEN lmp.price IS NOT NULL THEN lmp.price - i.purchase_price
    ELSE NULL
  END AS profit,
  CASE
    WHEN lmp.price IS NOT NULL AND i.purchase_price > 0 THEN
      ((lmp.price - i.purchase_price) / i.purchase_price) * 100
    ELSE NULL
  END AS profit_pct
FROM public.inventory i
LEFT JOIN public.product_catalog pc ON i.sku = pc.sku
LEFT JOIN public.latest_market_prices lmp ON i.sku = lmp.sku AND i.size_uk = lmp.size
WHERE i.user_id = auth.uid();

COMMENT ON VIEW public.portfolio_latest_prices IS 'User inventory with latest market prices and P/L calculations';

-- ============================================================================
-- 7. Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_product_catalog_updated_at ON public.product_catalog;
CREATE TRIGGER trigger_product_catalog_updated_at
  BEFORE UPDATE ON public.product_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 8. Sample FX Rates (current)
-- ============================================================================
-- Note: eur_per_gbp is auto-calculated as 1.0 / gbp_per_eur
INSERT INTO public.fx_rates (as_of, gbp_per_eur, meta)
VALUES (
  CURRENT_DATE,
  0.85,  -- 1 EUR = 0.85 GBP (eur_per_gbp will be ~1.176 automatically)
  '{"source": "mock", "note": "Sample rate for development"}'::jsonb
)
ON CONFLICT (as_of) DO UPDATE SET
  gbp_per_eur = EXCLUDED.gbp_per_eur,
  meta = EXCLUDED.meta;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
