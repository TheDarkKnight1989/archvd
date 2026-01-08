-- Fix fx_rates generated column issue
-- The generated column can't have an explicit NOT NULL constraint
-- when using Supabase client library or certain SQL contexts

-- Drop and recreate the eur_per_gbp column without explicit NOT NULL
ALTER TABLE public.fx_rates
  DROP COLUMN IF EXISTS eur_per_gbp;

ALTER TABLE public.fx_rates
  ADD COLUMN eur_per_gbp NUMERIC(10, 6)
  GENERATED ALWAYS AS (1.0 / NULLIF(gbp_per_eur, 0)) STORED;

-- Update existing row if it exists to recalculate
-- (Dropping and re-adding should auto-populate)

-- Verify it worked
SELECT
  as_of,
  gbp_per_eur,
  eur_per_gbp,
  (1.0 / NULLIF(gbp_per_eur, 0)) as expected_value
FROM public.fx_rates
ORDER BY as_of DESC
LIMIT 5;
