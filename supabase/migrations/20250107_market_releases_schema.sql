-- Migration: Market Data & Releases Schema
-- Created: 2025-01-07
-- Purpose: Product catalog, market prices, releases, and FX rates

-- ============================================================================
-- 1. Product Catalog Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  colorway TEXT,
  release_date DATE,
  retail_price DECIMAL(10, 2),
  currency TEXT DEFAULT 'GBP',
  image_url TEXT,
  slug TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_catalog_sku ON public.product_catalog(sku);
CREATE INDEX IF NOT EXISTS idx_product_catalog_brand ON public.product_catalog(brand);
CREATE INDEX IF NOT EXISTS idx_product_catalog_release_date ON public.product_catalog(release_date);

-- No RLS - server-side cache
ALTER TABLE public.product_catalog DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.product_catalog IS 'Master product catalog for sneakers and streetwear';
COMMENT ON COLUMN public.product_catalog.sku IS 'Unique SKU identifier (uppercased)';
COMMENT ON COLUMN public.product_catalog.meta IS 'Additional metadata (sources, confidence, etc)';

-- ============================================================================
-- 2. Product Market Prices Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,
  size TEXT NOT NULL,
  source TEXT NOT NULL, -- stockx, laced, goat, etc
  currency TEXT NOT NULL DEFAULT 'GBP',
  price DECIMAL(10, 2) NOT NULL,
  as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_product_catalog FOREIGN KEY (sku)
    REFERENCES public.product_catalog(sku)
    ON DELETE CASCADE,
  CONSTRAINT unique_price_snapshot UNIQUE (sku, size, source, as_of)
);

CREATE INDEX IF NOT EXISTS idx_product_market_prices_sku ON public.product_market_prices(sku);
CREATE INDEX IF NOT EXISTS idx_product_market_prices_sku_size ON public.product_market_prices(sku, size);
CREATE INDEX IF NOT EXISTS idx_product_market_prices_as_of ON public.product_market_prices(as_of DESC);
CREATE INDEX IF NOT EXISTS idx_product_market_prices_source ON public.product_market_prices(source);

-- No RLS - server-side cache
ALTER TABLE public.product_market_prices DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.product_market_prices IS 'Historical market prices per SKU/size from various sources';
COMMENT ON COLUMN public.product_market_prices.as_of IS 'Timestamp when this price was valid';
COMMENT ON COLUMN public.product_market_prices.meta IS 'Additional price metadata (ask, bid, sales, etc)';

-- ============================================================================
-- 3. Releases Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  colorway TEXT,
  release_date DATE NOT NULL,
  source TEXT NOT NULL, -- nike, size, footpatrol, etc
  source_url TEXT,
  image_url TEXT,
  slug TEXT,
  status TEXT DEFAULT 'upcoming', -- upcoming, live, past
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_release UNIQUE (brand, model, colorway, release_date, source)
);

CREATE INDEX IF NOT EXISTS idx_releases_by_date ON public.releases(release_date);
CREATE INDEX IF NOT EXISTS idx_releases_brand ON public.releases(brand);
CREATE INDEX IF NOT EXISTS idx_releases_status ON public.releases(status);
CREATE INDEX IF NOT EXISTS idx_releases_source ON public.releases(source);

-- No RLS - public data
ALTER TABLE public.releases DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.releases IS 'Upcoming and past sneaker releases from official sources';
COMMENT ON COLUMN public.releases.status IS 'Release status: upcoming, live, past';
COMMENT ON COLUMN public.releases.meta IS 'Additional release metadata (price, sizes, etc)';

-- ============================================================================
-- 4. Release Products Table (Junction)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.release_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL,
  sku TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_release FOREIGN KEY (release_id)
    REFERENCES public.releases(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_product FOREIGN KEY (sku)
    REFERENCES public.product_catalog(sku)
    ON DELETE CASCADE,
  CONSTRAINT unique_release_product UNIQUE (release_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_release_products_release_id ON public.release_products(release_id);
CREATE INDEX IF NOT EXISTS idx_release_products_sku ON public.release_products(sku);

-- No RLS - public data
ALTER TABLE public.release_products DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.release_products IS 'Links releases to product catalog SKUs';

-- ============================================================================
-- 5. FX Rates Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate DECIMAL(10, 6) NOT NULL,
  as_of DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'ecb', -- ecb, xe, etc
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_fx_rate UNIQUE (from_currency, to_currency, as_of)
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_currencies ON public.fx_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_fx_rates_as_of ON public.fx_rates(as_of DESC);

-- No RLS - public data
ALTER TABLE public.fx_rates DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.fx_rates IS 'Daily foreign exchange rates for currency conversion';
COMMENT ON COLUMN public.fx_rates.rate IS 'Conversion rate from_currency -> to_currency';

-- ============================================================================
-- 6. Release Sources Whitelist Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.release_sources_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL UNIQUE,
  source_url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial whitelist
INSERT INTO public.release_sources_whitelist (source_name, source_url, enabled) VALUES
  ('nike', 'https://www.nike.com/gb/launch', TRUE),
  ('size', 'https://www.size.co.uk/page/sizepreviews-launches/', TRUE),
  ('footpatrol', 'https://www.footpatrol.com/pages/launch-page', TRUE)
ON CONFLICT (source_name) DO NOTHING;

-- No RLS - configuration table
ALTER TABLE public.release_sources_whitelist DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.release_sources_whitelist IS 'Whitelisted sources for release scraping';

-- ============================================================================
-- 7. Catalog Cache Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.catalog_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  colorway TEXT,
  image_url TEXT,
  source TEXT NOT NULL,
  confidence DECIMAL(3, 2) DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_cache_sku ON public.catalog_cache(sku);
CREATE INDEX IF NOT EXISTS idx_catalog_cache_source ON public.catalog_cache(source);

-- No RLS - server-side cache
ALTER TABLE public.catalog_cache DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.catalog_cache IS 'Temporary cache for unconfirmed product data';
COMMENT ON COLUMN public.catalog_cache.confidence IS 'Confidence score 0.0-1.0 for auto-matched products';

-- ============================================================================
-- 8. Worker Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.worker_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL, -- success, partial_success, failed
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_logs_worker_name ON public.worker_logs(worker_name);
CREATE INDEX IF NOT EXISTS idx_worker_logs_started_at ON public.worker_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_logs_status ON public.worker_logs(status);

-- No RLS - internal logging
ALTER TABLE public.worker_logs DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.worker_logs IS 'Execution logs for background workers';
COMMENT ON COLUMN public.worker_logs.metrics IS 'JSON metrics: sources_processed, items_updated, errors, etc';

-- ============================================================================
-- 9. Update Triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
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
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_releases_updated_at ON public.releases;
CREATE TRIGGER trigger_releases_updated_at
  BEFORE UPDATE ON public.releases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_catalog_cache_updated_at ON public.catalog_cache;
CREATE TRIGGER trigger_catalog_cache_updated_at
  BEFORE UPDATE ON public.catalog_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- 10. Helper Views
-- ============================================================================

-- Latest market price per SKU/size
CREATE OR REPLACE VIEW public.latest_market_prices AS
SELECT DISTINCT ON (sku, size)
  sku,
  size,
  source,
  price,
  currency,
  as_of,
  meta
FROM public.product_market_prices
ORDER BY sku, size, as_of DESC;

COMMENT ON VIEW public.latest_market_prices IS 'Most recent market price for each SKU/size combination';

-- Upcoming releases with linked SKUs
CREATE OR REPLACE VIEW public.upcoming_releases_with_skus AS
SELECT
  r.*,
  ARRAY_AGG(rp.sku) FILTER (WHERE rp.sku IS NOT NULL) AS skus
FROM public.releases r
LEFT JOIN public.release_products rp ON r.id = rp.release_id
WHERE r.release_date >= CURRENT_DATE
  AND r.status = 'upcoming'
GROUP BY r.id
ORDER BY r.release_date ASC;

COMMENT ON VIEW public.upcoming_releases_with_skus IS 'Upcoming releases with associated SKUs';
