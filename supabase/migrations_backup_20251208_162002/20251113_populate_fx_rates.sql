-- ============================================================================
-- Populate FX Rates Table with Historical Data
-- Created: 2025-01-13
-- Purpose: Add sample FX rates for GBP/USD and GBP/EUR conversions
-- ============================================================================
--
-- Exchange rates (approximate recent values):
-- 1 GBP = 1.27 USD → 1 USD = 0.787 GBP (gbp_per_usd)
-- 1 GBP = 1.17 EUR → 1 EUR = 0.855 GBP (gbp_per_eur)
--
-- This migration is idempotent - safe to run multiple times
-- ============================================================================

-- Clear existing data (if re-running)
-- TRUNCATE TABLE public.fx_rates;

-- Insert FX rates for the past 2 years (730 days) with slight daily variations
-- Real production systems should use actual historical data from ECB, Bank of England, etc.

INSERT INTO public.fx_rates (as_of, gbp_per_usd, gbp_per_eur, source, meta)
SELECT
  date_series AS as_of,
  -- GBP per USD: oscillate around 0.787 ± 0.05
  0.787 + (random() * 0.1 - 0.05) AS gbp_per_usd,
  -- GBP per EUR: oscillate around 0.855 ± 0.04
  0.855 + (random() * 0.08 - 0.04) AS gbp_per_eur,
  'migration_seed' AS source,
  jsonb_build_object(
    'note', 'Sample historical data for development',
    'generated_at', NOW()
  ) AS meta
FROM generate_series(
  CURRENT_DATE - INTERVAL '730 days',
  CURRENT_DATE,
  INTERVAL '1 day'
) AS date_series
ON CONFLICT (as_of) DO NOTHING; -- Skip if date already exists

-- Verify insertion
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM public.fx_rates;
  RAISE NOTICE 'FX rates table now contains % rows', row_count;

  -- Show sample of most recent rates
  RAISE NOTICE 'Sample of recent rates:';
  FOR i IN (
    SELECT
      as_of,
      gbp_per_usd,
      gbp_per_eur,
      ROUND((1.0 / gbp_per_usd)::numeric, 4) AS usd_per_gbp,
      ROUND((1.0 / gbp_per_eur)::numeric, 4) AS eur_per_gbp
    FROM public.fx_rates
    ORDER BY as_of DESC
    LIMIT 5
  ) LOOP
    RAISE NOTICE '  % | USD: £% ($%) | EUR: £% (€%)',
      i.as_of,
      i.gbp_per_usd,
      i.usd_per_gbp,
      i.gbp_per_eur,
      i.eur_per_gbp;
  END LOOP;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.fx_rates IS 'Historical foreign exchange rates with GBP as pivot currency. Updated daily for accurate transaction conversions.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
