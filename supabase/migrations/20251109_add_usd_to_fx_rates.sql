-- Add USD support to fx_rates table
-- This migration adds USD exchange rate columns and updates the profiles constraint

-- Add USD per GBP column to fx_rates table
ALTER TABLE public.fx_rates
  ADD COLUMN IF NOT EXISTS usd_per_gbp NUMERIC(10, 6);

-- Add calculated GBP per USD column (inverse of usd_per_gbp)
ALTER TABLE public.fx_rates
  ADD COLUMN IF NOT EXISTS gbp_per_usd NUMERIC(10, 6)
  GENERATED ALWAYS AS (1.0 / NULLIF(usd_per_gbp, 0)) STORED;

-- Update the profiles table constraint to allow USD
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS valid_currency;

ALTER TABLE public.profiles
  ADD CONSTRAINT valid_currency CHECK (currency_pref IN ('GBP', 'EUR', 'USD'));

-- Update default FX rates to include USD (optional: set sensible defaults)
-- GBP to USD rate approximately 1.27 (as of migration creation)
UPDATE public.fx_rates
SET usd_per_gbp = 1.27
WHERE usd_per_gbp IS NULL;

-- Verify the changes
SELECT
  as_of,
  gbp_per_eur,
  eur_per_gbp,
  usd_per_gbp,
  gbp_per_usd,
  (1.0 / NULLIF(usd_per_gbp, 0)) as expected_gbp_per_usd
FROM public.fx_rates
ORDER BY as_of DESC
LIMIT 5;
