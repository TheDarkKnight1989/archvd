-- ============================================================================
-- StockX Foundations + Provider-Agnostic Market Links
-- Migration: 20251116_stockx_foundations.sql
-- ============================================================================

-- ============================================================================
-- 1. StockX Product Catalog
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stockx_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT,
  name TEXT NOT NULL,
  colorway TEXT,
  image_url TEXT,
  retail_price NUMERIC(10, 2),
  release_date DATE,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stockx_products_sku ON public.stockx_products(sku);
CREATE INDEX IF NOT EXISTS idx_stockx_products_brand ON public.stockx_products(brand);
CREATE INDEX IF NOT EXISTS idx_stockx_products_slug ON public.stockx_products(slug);

COMMENT ON TABLE public.stockx_products IS 'StockX product catalog (sneakers)';
COMMENT ON COLUMN public.stockx_products.sku IS 'Product SKU (style code)';
COMMENT ON COLUMN public.stockx_products.slug IS 'URL-friendly slug';
COMMENT ON COLUMN public.stockx_products.meta IS 'Additional StockX metadata';

-- ============================================================================
-- 2. StockX Market Prices (Time-Series)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stockx_market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,
  size TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  lowest_ask NUMERIC(10, 2),
  highest_bid NUMERIC(10, 2),
  last_sale NUMERIC(10, 2),
  average_price NUMERIC(10, 2),
  volatility NUMERIC(5, 4),
  sales_last_72h INTEGER DEFAULT 0,
  as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'stockx',
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stockx_market_prices_sku ON public.stockx_market_prices(sku);
CREATE INDEX IF NOT EXISTS idx_stockx_market_prices_sku_size ON public.stockx_market_prices(sku, size);
CREATE INDEX IF NOT EXISTS idx_stockx_market_prices_as_of ON public.stockx_market_prices(as_of DESC);
CREATE INDEX IF NOT EXISTS idx_stockx_market_prices_currency ON public.stockx_market_prices(currency);

COMMENT ON TABLE public.stockx_market_prices IS 'StockX market pricing snapshots (time-series)';
COMMENT ON COLUMN public.stockx_market_prices.as_of IS 'Snapshot timestamp';
COMMENT ON COLUMN public.stockx_market_prices.source IS 'Data source (stockx, alias, etc.)';

-- ============================================================================
-- 3. StockX Sales History
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stockx_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,
  size TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  sale_price NUMERIC(10, 2) NOT NULL,
  sold_at TIMESTAMPTZ NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stockx_sales_sku ON public.stockx_sales(sku);
CREATE INDEX IF NOT EXISTS idx_stockx_sales_sku_size ON public.stockx_sales(sku, size);
CREATE INDEX IF NOT EXISTS idx_stockx_sales_sold_at ON public.stockx_sales(sold_at DESC);

COMMENT ON TABLE public.stockx_sales IS 'StockX historical sales transactions';

-- ============================================================================
-- 4. Provider-Agnostic Market Links (Migrate from inventory_alias_links)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_market_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES public."Inventory"(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('alias', 'stockx', 'goat', 'manual')),
  provider_product_id TEXT,
  provider_product_sku TEXT,
  provider_listing_id TEXT,
  match_confidence NUMERIC(3, 2) DEFAULT 1.0 CHECK (match_confidence >= 0 AND match_confidence <= 1),
  inventory_purchase_price NUMERIC(10, 2),
  provider_ask_price NUMERIC(10, 2),
  spread NUMERIC(10, 2) GENERATED ALWAYS AS (provider_ask_price - inventory_purchase_price) STORED,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_inventory_market_link UNIQUE (inventory_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_inventory_market_links_inventory ON public.inventory_market_links(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_market_links_provider ON public.inventory_market_links(provider);
CREATE INDEX IF NOT EXISTS idx_inventory_market_links_product_id ON public.inventory_market_links(provider_product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_market_links_product_sku ON public.inventory_market_links(provider_product_sku);

COMMENT ON TABLE public.inventory_market_links IS 'Links inventory items to market data providers (StockX, Alias, etc.)';
COMMENT ON COLUMN public.inventory_market_links.provider IS 'Market data provider: alias, stockx, goat, manual';
COMMENT ON COLUMN public.inventory_market_links.match_confidence IS 'Confidence score of SKU match (0-1)';

-- Migrate existing inventory_alias_links if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inventory_alias_links'
  ) THEN
    -- Copy existing Alias links
    INSERT INTO public.inventory_market_links (
      inventory_id,
      provider,
      provider_product_id,
      provider_product_sku,
      provider_listing_id,
      inventory_purchase_price,
      provider_ask_price,
      last_sync_at,
      created_at,
      updated_at
    )
    SELECT
      inventory_id,
      'alias' AS provider,
      alias_product_id,
      alias_product_sku,
      alias_listing_id,
      inventory_purchase_price,
      alias_ask_price,
      last_sync_at,
      created_at,
      updated_at
    FROM public.inventory_alias_links
    ON CONFLICT (inventory_id, provider) DO NOTHING;

    RAISE NOTICE 'Migrated existing inventory_alias_links to inventory_market_links';
  END IF;
END $$;

-- ============================================================================
-- 5. Views: Latest Market Prices
-- ============================================================================

CREATE OR REPLACE VIEW public.stockx_latest_prices AS
SELECT DISTINCT ON (sku, size, currency)
  sku,
  size,
  currency,
  lowest_ask,
  highest_bid,
  last_sale,
  average_price,
  volatility,
  sales_last_72h,
  as_of
FROM public.stockx_market_prices
ORDER BY sku, size, currency, as_of DESC;

COMMENT ON VIEW public.stockx_latest_prices IS 'Latest market price for each SKU + size combination';

-- ============================================================================
-- 6. Views: 30-Day Price Medians
-- ============================================================================

CREATE OR REPLACE VIEW public.stockx_price_daily_medians AS
WITH daily_prices AS (
  SELECT
    sku,
    size,
    currency,
    DATE(as_of) AS price_date,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY last_sale) AS median_price,
    COUNT(*) AS snapshot_count
  FROM public.stockx_market_prices
  WHERE last_sale IS NOT NULL
    AND as_of >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY sku, size, currency, DATE(as_of)
)
SELECT
  sku,
  size,
  currency,
  price_date,
  median_price,
  snapshot_count
FROM daily_prices
ORDER BY sku, size, currency, price_date DESC;

COMMENT ON VIEW public.stockx_price_daily_medians IS '30-day daily median prices by SKU + size';

-- ============================================================================
-- 7. Function: Refresh Materialized Views (Future Use)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_stockx_mvs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Placeholder for future materialized views
  -- Currently using regular views for simplicity
  RAISE NOTICE 'StockX views refreshed';
END;
$$;

COMMENT ON FUNCTION public.refresh_stockx_mvs IS 'Refresh StockX materialized views (placeholder)';

-- ============================================================================
-- 8. Updated Inventory with Alias Status View
-- ============================================================================

DROP VIEW IF EXISTS public.inventory_with_alias_status;

CREATE OR REPLACE VIEW public.inventory_with_market_status AS
SELECT
  i.*,

  -- Alias provider
  alias_link.id AS alias_link_id,
  alias_link.provider_product_id AS alias_product_id,
  alias_link.provider_product_sku AS alias_product_sku,
  alias_link.provider_listing_id AS alias_listing_id,
  alias_link.provider_ask_price AS alias_ask_price,
  alias_link.last_sync_at AS alias_last_sync_at,

  -- StockX provider
  stockx_link.id AS stockx_link_id,
  stockx_link.provider_product_id AS stockx_product_id,
  stockx_link.provider_product_sku AS stockx_product_sku,
  stockx_link.last_sync_at AS stockx_last_sync_at,

  -- StockX latest price
  stockx_price.lowest_ask AS stockx_lowest_ask,
  stockx_price.last_sale AS stockx_last_sale,
  stockx_price.as_of AS stockx_price_as_of,

  -- Overall mapping status
  CASE
    WHEN alias_link.id IS NOT NULL OR stockx_link.id IS NOT NULL THEN 'mapped'
    WHEN aul.id IS NOT NULL THEN 'unmatched'
    ELSE 'unmapped'
  END AS market_mapping_status

FROM public."Inventory" i

LEFT JOIN public.inventory_market_links alias_link
  ON i.id = alias_link.inventory_id AND alias_link.provider = 'alias'

LEFT JOIN public.inventory_market_links stockx_link
  ON i.id = stockx_link.inventory_id AND stockx_link.provider = 'stockx'

LEFT JOIN public.stockx_latest_prices stockx_price
  ON stockx_link.provider_product_sku = stockx_price.sku
  AND i.size = stockx_price.size

LEFT JOIN public.alias_unmatched_log aul
  ON i.id = aul.inventory_id AND aul.resolved_at IS NULL;

COMMENT ON VIEW public.inventory_with_market_status IS 'Inventory items with market provider mapping status (Alias + StockX)';

-- ============================================================================
-- 9. RLS Policies
-- ============================================================================

-- StockX Products (public read)
ALTER TABLE public.stockx_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view StockX products" ON public.stockx_products
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Service role can manage StockX products" ON public.stockx_products
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- StockX Market Prices (public read)
ALTER TABLE public.stockx_market_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view StockX prices" ON public.stockx_market_prices
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Service role can manage StockX prices" ON public.stockx_market_prices
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- StockX Sales (public read)
ALTER TABLE public.stockx_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view StockX sales" ON public.stockx_sales
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Service role can manage StockX sales" ON public.stockx_sales
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Inventory Market Links (user-scoped)
ALTER TABLE public.inventory_market_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own market links" ON public.inventory_market_links
  FOR SELECT TO authenticated
  USING (
    inventory_id IN (
      SELECT id FROM public."Inventory" WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage market links" ON public.inventory_market_links
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 10. Grants
-- ============================================================================

GRANT SELECT ON public.stockx_products TO authenticated, anon;
GRANT SELECT ON public.stockx_market_prices TO authenticated, anon;
GRANT SELECT ON public.stockx_sales TO authenticated, anon;
GRANT SELECT ON public.stockx_latest_prices TO authenticated, anon;
GRANT SELECT ON public.stockx_price_daily_medians TO authenticated, anon;
GRANT SELECT ON public.inventory_with_market_status TO authenticated;

-- ============================================================================
-- 11. Triggers for updated_at
-- ============================================================================

CREATE TRIGGER update_stockx_products_updated_at
  BEFORE UPDATE ON public.stockx_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_market_links_updated_at
  BEFORE UPDATE ON public.inventory_market_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Done!
-- ============================================================================
