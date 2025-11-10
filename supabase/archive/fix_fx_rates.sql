-- =================================================================
-- FIX: fx_rates generated column not working
-- =================================================================
-- The eur_per_gbp column is not properly defined as a generated column.
-- This script will drop it and recreate it correctly.

-- Step 1: Drop the existing eur_per_gbp column
ALTER TABLE public.fx_rates DROP COLUMN IF EXISTS eur_per_gbp;

-- Step 2: Add it back as a proper generated column
ALTER TABLE public.fx_rates
  ADD COLUMN eur_per_gbp NUMERIC(10, 6)
  GENERATED ALWAYS AS (1.0 / NULLIF(gbp_per_eur, 0)) STORED;

-- Step 3: Verify the fix worked by checking existing data
SELECT
  as_of,
  gbp_per_eur,
  eur_per_gbp,
  ROUND((1.0 / NULLIF(gbp_per_eur, 0))::numeric, 6) as expected_value,
  CASE
    WHEN eur_per_gbp = ROUND((1.0 / NULLIF(gbp_per_eur, 0))::numeric, 6) THEN '✓ Correct'
    ELSE '✗ Mismatch'
  END as status
FROM public.fx_rates
ORDER BY as_of DESC;

-- Step 4: Test insert
INSERT INTO public.fx_rates (as_of, gbp_per_eur, meta)
VALUES (CURRENT_DATE, 0.85, '{"source": "seed"}'::jsonb)
ON CONFLICT (as_of) DO UPDATE SET
  gbp_per_eur = EXCLUDED.gbp_per_eur,
  meta = EXCLUDED.meta;

-- Step 5: Verify the insert worked
SELECT * FROM public.fx_rates ORDER BY as_of DESC LIMIT 5;
