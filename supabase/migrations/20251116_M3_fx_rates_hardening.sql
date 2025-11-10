-- ============================================================================
-- M3: FX Rates Hardening with Generated Columns & Compat Upsert
-- Created: 2025-01-16
-- Purpose: Production-grade FX rates table with backwards compatibility
-- ============================================================================

-- ============================================================================
-- 1. Recreate fx_rates Table with Generated Columns
-- ============================================================================

-- Drop existing table if it exists (will cascade to dependent views)
DROP TABLE IF EXISTS public.fx_rates CASCADE;

CREATE TABLE public.fx_rates (
  as_of DATE PRIMARY KEY,

  -- GBP pivot rates (manually provided)
  gbp_per_usd NUMERIC(12,6) NOT NULL CHECK (gbp_per_usd > 0),
  gbp_per_eur NUMERIC(12,6) NOT NULL CHECK (gbp_per_eur > 0),

  -- Inverse rates (auto-calculated)
  usd_per_gbp NUMERIC(12,6) GENERATED ALWAYS AS (1.0 / NULLIF(gbp_per_usd, 0)) STORED,
  eur_per_gbp NUMERIC(12,6) GENERATED ALWAYS AS (1.0 / NULLIF(gbp_per_eur, 0)) STORED,

  -- Metadata
  source TEXT NOT NULL DEFAULT 'manual',
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_fx_rates_date_desc
ON public.fx_rates(as_of DESC);

-- Comments
COMMENT ON TABLE public.fx_rates IS
'Historical foreign exchange rates with GBP as pivot currency. Generated columns automatically calculate inverse rates.';

COMMENT ON COLUMN public.fx_rates.gbp_per_usd IS
'GBP per 1 USD (e.g., 0.787 means £0.787 = $1)';

COMMENT ON COLUMN public.fx_rates.gbp_per_eur IS
'GBP per 1 EUR (e.g., 0.855 means £0.855 = €1)';

COMMENT ON COLUMN public.fx_rates.usd_per_gbp IS
'USD per 1 GBP - generated from 1/gbp_per_usd';

COMMENT ON COLUMN public.fx_rates.eur_per_gbp IS
'EUR per 1 GBP - generated from 1/gbp_per_eur';

-- ============================================================================
-- 2. RLS Policies for fx_rates
-- ============================================================================

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

-- Everyone (authenticated) can read FX rates
CREATE POLICY fx_rates_select_all
ON public.fx_rates
FOR SELECT
TO authenticated
USING (true);

-- Only service role can insert/update/delete
-- (Note: Regular users don't get INSERT/UPDATE/DELETE policies)

-- ============================================================================
-- 3. Compatibility Upsert Function
-- ============================================================================
-- Allows existing seed scripts to work without modification
-- Ignores writes to generated columns and provides smart defaults

CREATE OR REPLACE FUNCTION public.fn_fx_upsert(
  p_as_of DATE,
  p_gbp_per_usd NUMERIC DEFAULT NULL,
  p_gbp_per_eur NUMERIC DEFAULT NULL,
  p_source TEXT DEFAULT 'manual',
  p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gbp_per_usd NUMERIC;
  v_gbp_per_eur NUMERIC;
  v_prev_rate RECORD;
BEGIN
  -- If rates not provided, try to use previous day's rates
  IF p_gbp_per_usd IS NULL OR p_gbp_per_eur IS NULL THEN
    SELECT gbp_per_usd, gbp_per_eur INTO v_prev_rate
    FROM public.fx_rates
    WHERE as_of < p_as_of
    ORDER BY as_of DESC
    LIMIT 1;

    v_gbp_per_usd := COALESCE(p_gbp_per_usd, v_prev_rate.gbp_per_usd, 0.787);
    v_gbp_per_eur := COALESCE(p_gbp_per_eur, v_prev_rate.gbp_per_eur, 0.855);
  ELSE
    v_gbp_per_usd := p_gbp_per_usd;
    v_gbp_per_eur := p_gbp_per_eur;
  END IF;

  -- Upsert the rate
  INSERT INTO public.fx_rates (as_of, gbp_per_usd, gbp_per_eur, source, meta)
  VALUES (p_as_of, v_gbp_per_usd, v_gbp_per_eur, p_source, p_meta)
  ON CONFLICT (as_of) DO UPDATE
  SET
    gbp_per_usd = EXCLUDED.gbp_per_usd,
    gbp_per_eur = EXCLUDED.gbp_per_eur,
    source = EXCLUDED.source,
    meta = EXCLUDED.meta,
    updated_at = NOW();

  RETURN gen_random_uuid(); -- Return a UUID for compatibility
END;
$$;

COMMENT ON FUNCTION public.fn_fx_upsert IS
'Compatibility function for upserting FX rates. Handles missing values by using previous day rates. Ignores generated columns.';

-- ============================================================================
-- 4. Enhanced fx_rate_for Function
-- ============================================================================
-- Keep existing function but ensure it works with new table structure

CREATE OR REPLACE FUNCTION public.fx_rate_for(
  date_in DATE,
  from_ccy TEXT,
  to_ccy TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  rate_record RECORD;
  from_to_gbp NUMERIC;
  to_to_gbp NUMERIC;
BEGIN
  -- Same currency = 1.0
  IF from_ccy = to_ccy THEN
    RETURN 1.0;
  END IF;

  -- Get rate record for date (or most recent prior)
  SELECT * INTO rate_record
  FROM public.fx_rates
  WHERE as_of <= date_in
  ORDER BY as_of DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- No rate found, return 1.0 as fallback
    RETURN 1.0;
  END IF;

  -- Determine from_ccy to GBP rate
  from_to_gbp := CASE from_ccy
    WHEN 'GBP' THEN 1.0
    WHEN 'USD' THEN rate_record.gbp_per_usd
    WHEN 'EUR' THEN rate_record.gbp_per_eur
    ELSE 1.0
  END;

  -- Determine to_ccy to GBP rate
  to_to_gbp := CASE to_ccy
    WHEN 'GBP' THEN 1.0
    WHEN 'USD' THEN rate_record.gbp_per_usd
    WHEN 'EUR' THEN rate_record.gbp_per_eur
    ELSE 1.0
  END;

  -- Cross rate: (from -> GBP) / (to -> GBP)
  RETURN from_to_gbp / NULLIF(to_to_gbp, 0);
END;
$$;

COMMENT ON FUNCTION public.fx_rate_for IS
'Returns FX rate to convert from_ccy to to_ccy on a specific date. Uses most recent rate if exact date not available.';

-- ============================================================================
-- 5. Create Updated_at Trigger for fx_rates
-- ============================================================================

-- Create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.trg_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_update_updated_at IS
'Automatically updates updated_at timestamp on row update';

-- Apply trigger to fx_rates table
DROP TRIGGER IF EXISTS trigger_fx_rates_updated_at ON public.fx_rates;
CREATE TRIGGER trigger_fx_rates_updated_at
  BEFORE UPDATE ON public.fx_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_update_updated_at();

-- ============================================================================
-- 6. Repopulate fx_rates from Previous Data (if available)
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- This block is a placeholder - actual repopulation should be done
  -- by running the populate-fx-rates script

  RAISE NOTICE 'fx_rates table ready. Run npm run seed:fx to populate historical data.';
END $$;

-- ============================================================================
-- 7. Catalog & Market RLS Policies
-- ============================================================================

-- Ensure market tables are readable by authenticated users

DO $$
BEGIN
  -- product_market_prices (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_market_prices') THEN
    ALTER TABLE public.product_market_prices ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS product_market_prices_select_all ON public.product_market_prices;
    CREATE POLICY product_market_prices_select_all
    ON public.product_market_prices
    FOR SELECT
    TO authenticated
    USING (true);

    RAISE NOTICE 'RLS enabled for product_market_prices';
  END IF;

  -- releases (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'releases') THEN
    ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS releases_select_all ON public.releases;
    CREATE POLICY releases_select_all
    ON public.releases
    FOR SELECT
    TO authenticated
    USING (true);

    RAISE NOTICE 'RLS enabled for releases';
  END IF;
END $$;

-- ============================================================================
-- 8. Add Missing Indexes for Market Tables
-- ============================================================================

-- Product market prices indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_market_prices') THEN
    CREATE INDEX IF NOT EXISTS idx_product_market_prices_sku_size_date
    ON public.product_market_prices(sku, size, as_of DESC);

    CREATE INDEX IF NOT EXISTS idx_product_market_prices_date
    ON public.product_market_prices(as_of DESC);
  END IF;
END $$;

-- ============================================================================
-- 9. Verification
-- ============================================================================

DO $$
DECLARE
  v_fx_count INTEGER;
  v_latest_date DATE;
BEGIN
  SELECT COUNT(*), MAX(as_of)
  INTO v_fx_count, v_latest_date
  FROM public.fx_rates;

  RAISE NOTICE 'FX rates table: % records', v_fx_count;

  IF v_latest_date IS NOT NULL THEN
    RAISE NOTICE 'Latest rate date: %', v_latest_date;
  ELSE
    RAISE NOTICE 'No FX rates yet - run npm run seed:fx';
  END IF;

  -- Test fx_rate_for function
  DECLARE
    v_test_rate NUMERIC;
  BEGIN
    v_test_rate := public.fx_rate_for(CURRENT_DATE, 'USD', 'GBP');
    RAISE NOTICE 'Test fx_rate_for(today, USD, GBP): %', v_test_rate;
  END;
END $$;

-- ============================================================================
-- END OF M3 MIGRATION
-- ============================================================================
