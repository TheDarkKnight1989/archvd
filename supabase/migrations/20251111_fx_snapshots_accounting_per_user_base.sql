-- ============================================================================
-- FX Snapshots Accounting Per-User Base Currency Migration
-- Created: 2025-01-11
-- Purpose: Per-user base currency with FX snapshots at transaction time
-- ============================================================================

-- ============================================================================
-- 1. Extend Profiles Table with Base Currency
-- ============================================================================
-- Add base_currency column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'base_currency'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN base_currency TEXT DEFAULT 'GBP'
    CHECK (base_currency IN ('GBP', 'EUR', 'USD'));

    COMMENT ON COLUMN public.profiles.base_currency IS 'User''s accounting base currency (GBP, EUR, or USD)';
  END IF;
END $$;

-- Set default for existing users
UPDATE public.profiles
SET base_currency = 'GBP'
WHERE base_currency IS NULL;

-- ============================================================================
-- 2. Harden FX Rates Table (GBP as Pivot)
-- ============================================================================
-- Drop the old fx_rates table structure and recreate with new schema
DROP TABLE IF EXISTS public.fx_rates CASCADE;

CREATE TABLE public.fx_rates (
  as_of DATE PRIMARY KEY,
  gbp_per_usd NUMERIC(12, 6) NOT NULL,
  gbp_per_eur NUMERIC(12, 6) NOT NULL,
  usd_per_gbp NUMERIC(12, 6) GENERATED ALWAYS AS (1.0 / NULLIF(gbp_per_usd, 0)) STORED,
  eur_per_gbp NUMERIC(12, 6) GENERATED ALWAYS AS (1.0 / NULLIF(gbp_per_eur, 0)) STORED,
  source TEXT NOT NULL DEFAULT 'manual',
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_gbp_per_usd CHECK (gbp_per_usd > 0),
  CONSTRAINT valid_gbp_per_eur CHECK (gbp_per_eur > 0)
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

COMMENT ON TABLE public.fx_rates IS 'Daily FX rates with GBP as pivot currency';
COMMENT ON COLUMN public.fx_rates.gbp_per_usd IS 'How many GBP per 1 USD';
COMMENT ON COLUMN public.fx_rates.gbp_per_eur IS 'How many GBP per 1 EUR';
COMMENT ON COLUMN public.fx_rates.source IS 'Rate source (manual, ecb, api, etc.)';

-- Insert sample rates for development
INSERT INTO public.fx_rates (as_of, gbp_per_usd, gbp_per_eur, source, meta)
VALUES
  (CURRENT_DATE, 0.79, 0.85, 'manual', '{"note": "Sample development rates"}'::jsonb),
  (CURRENT_DATE - INTERVAL '1 day', 0.78, 0.84, 'manual', '{"note": "Sample development rates"}'::jsonb),
  (CURRENT_DATE - INTERVAL '7 days', 0.77, 0.83, 'manual', '{"note": "Sample development rates"}'::jsonb),
  (CURRENT_DATE - INTERVAL '30 days', 0.76, 0.82, 'manual', '{"note": "Sample development rates"}'::jsonb)
ON CONFLICT (as_of) DO UPDATE SET
  gbp_per_usd = EXCLUDED.gbp_per_usd,
  gbp_per_eur = EXCLUDED.gbp_per_eur,
  source = EXCLUDED.source,
  meta = EXCLUDED.meta;

-- ============================================================================
-- 3. Helper Functions
-- ============================================================================

-- Function: fx_rate_for(date_in, from_ccy, to_ccy)
-- Returns the FX rate to convert from_ccy to to_ccy on the given date
-- Uses GBP as pivot currency
-- Falls back to prior date if exact date not found
CREATE OR REPLACE FUNCTION public.fx_rate_for(
  date_in DATE,
  from_ccy TEXT,
  to_ccy TEXT
)
RETURNS NUMERIC AS $$
DECLARE
  rate_record RECORD;
  from_to_gbp NUMERIC;
  to_to_gbp NUMERIC;
BEGIN
  -- If same currency, return 1.0
  IF from_ccy = to_ccy THEN
    RETURN 1.0;
  END IF;

  -- Normalize currency codes
  from_ccy := UPPER(TRIM(from_ccy));
  to_ccy := UPPER(TRIM(to_ccy));

  -- Get the rate record for the date (or most recent prior date)
  SELECT * INTO rate_record
  FROM public.fx_rates
  WHERE as_of <= date_in
  ORDER BY as_of DESC
  LIMIT 1;

  IF rate_record IS NULL THEN
    RAISE EXCEPTION 'No FX rate available for date % or before', date_in;
  END IF;

  -- Convert from_ccy to GBP
  CASE from_ccy
    WHEN 'GBP' THEN from_to_gbp := 1.0;
    WHEN 'USD' THEN from_to_gbp := rate_record.gbp_per_usd;
    WHEN 'EUR' THEN from_to_gbp := rate_record.gbp_per_eur;
    ELSE RAISE EXCEPTION 'Unsupported from_ccy: %', from_ccy;
  END CASE;

  -- Convert GBP to to_ccy
  CASE to_ccy
    WHEN 'GBP' THEN to_to_gbp := 1.0;
    WHEN 'USD' THEN to_to_gbp := rate_record.gbp_per_usd;
    WHEN 'EUR' THEN to_to_gbp := rate_record.gbp_per_eur;
    ELSE RAISE EXCEPTION 'Unsupported to_ccy: %', to_ccy;
  END CASE;

  -- Cross rate: (from -> GBP) / (to -> GBP)
  RETURN from_to_gbp / NULLIF(to_to_gbp, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.fx_rate_for(DATE, TEXT, TEXT) IS 'Get FX rate to convert from_ccy to to_ccy on given date (or most recent prior)';

-- Function: user_base_ccy(user_id)
-- Returns the user's base currency from profiles
CREATE OR REPLACE FUNCTION public.user_base_ccy(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_ccy TEXT;
BEGIN
  SELECT base_currency INTO base_ccy
  FROM public.profiles
  WHERE id = user_id;

  RETURN COALESCE(base_ccy, 'GBP');
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.user_base_ccy(UUID) IS 'Get user''s base currency from profiles (defaults to GBP)';

-- ============================================================================
-- 4. Extend Inventory Table with Purchase FX Snapshot Columns
-- ============================================================================
DO $$
BEGIN
  -- purchase_currency: currency in which purchase was made
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Inventory' AND column_name = 'purchase_currency'
  ) THEN
    ALTER TABLE public."Inventory" ADD COLUMN purchase_currency TEXT DEFAULT 'GBP';
    COMMENT ON COLUMN public."Inventory".purchase_currency IS 'Currency of purchase_price (GBP, EUR, USD)';
  END IF;

  -- purchase_date: date of purchase (for FX rate lookup)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Inventory' AND column_name = 'purchase_date'
  ) THEN
    ALTER TABLE public."Inventory" ADD COLUMN purchase_date DATE DEFAULT CURRENT_DATE;
    COMMENT ON COLUMN public."Inventory".purchase_date IS 'Date of purchase (for FX rate lookup)';
  END IF;

  -- purchase_base_ccy: user's base currency at time of purchase
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Inventory' AND column_name = 'purchase_base_ccy'
  ) THEN
    ALTER TABLE public."Inventory" ADD COLUMN purchase_base_ccy TEXT;
    COMMENT ON COLUMN public."Inventory".purchase_base_ccy IS 'User''s base currency at time of purchase';
  END IF;

  -- purchase_fx_rate: FX rate used to convert to base currency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Inventory' AND column_name = 'purchase_fx_rate'
  ) THEN
    ALTER TABLE public."Inventory" ADD COLUMN purchase_fx_rate NUMERIC(12, 6);
    COMMENT ON COLUMN public."Inventory".purchase_fx_rate IS 'FX rate applied (purchase_currency -> purchase_base_ccy)';
  END IF;

  -- purchase_amount_base: purchase_price converted to base currency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Inventory' AND column_name = 'purchase_amount_base'
  ) THEN
    ALTER TABLE public."Inventory" ADD COLUMN purchase_amount_base NUMERIC(10, 2);
    COMMENT ON COLUMN public."Inventory".purchase_amount_base IS 'Purchase amount in user''s base currency';
  END IF;

  -- purchase_fx_source: source of FX rate (fx_rates table, manual override, etc.)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Inventory' AND column_name = 'purchase_fx_source'
  ) THEN
    ALTER TABLE public."Inventory" ADD COLUMN purchase_fx_source TEXT DEFAULT 'auto';
    COMMENT ON COLUMN public."Inventory".purchase_fx_source IS 'Source of FX rate (auto, manual)';
  END IF;
END $$;

-- ============================================================================
-- 5. Extend Inventory Table with Sale FX Snapshot Columns
-- ============================================================================
DO $$
BEGIN
  -- sale_price: already exists, but ensure it's there
  -- sale_date: date of sale
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Inventory' AND column_name = 'sale_date'
  ) THEN
    ALTER TABLE public."Inventory" ADD COLUMN sale_date DATE;
    COMMENT ON COLUMN public."Inventory".sale_date IS 'Date of sale';
  END IF;

  -- sale_currency: currency in which sale was made
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Inventory' AND column_name = 'sale_currency'
  ) THEN
    ALTER TABLE public."Inventory" ADD COLUMN sale_currency TEXT DEFAULT 'GBP';
    COMMENT ON COLUMN public."Inventory".sale_currency IS 'Currency of sale_price (GBP, EUR, USD)';
  END IF;

  -- sale_base_ccy: user's base currency at time of sale
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Inventory' AND column_name = 'sale_base_ccy'
  ) THEN
    ALTER TABLE public."Inventory" ADD COLUMN sale_base_ccy TEXT;
    COMMENT ON COLUMN public."Inventory".sale_base_ccy IS 'User''s base currency at time of sale';
  END IF;

  -- sale_fx_rate: FX rate used to convert to base currency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Inventory' AND column_name = 'sale_fx_rate'
  ) THEN
    ALTER TABLE public."Inventory" ADD COLUMN sale_fx_rate NUMERIC(12, 6);
    COMMENT ON COLUMN public."Inventory".sale_fx_rate IS 'FX rate applied (sale_currency -> sale_base_ccy)';
  END IF;

  -- sale_amount_base: sale_price converted to base currency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Inventory' AND column_name = 'sale_amount_base'
  ) THEN
    ALTER TABLE public."Inventory" ADD COLUMN sale_amount_base NUMERIC(10, 2);
    COMMENT ON COLUMN public."Inventory".sale_amount_base IS 'Sale amount in user''s base currency';
  END IF;

  -- sale_fx_source: source of FX rate
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Inventory' AND column_name = 'sale_fx_source'
  ) THEN
    ALTER TABLE public."Inventory" ADD COLUMN sale_fx_source TEXT DEFAULT 'auto';
    COMMENT ON COLUMN public."Inventory".sale_fx_source IS 'Source of FX rate (auto, manual)';
  END IF;
END $$;

-- ============================================================================
-- 6. Extend Expenses Table with FX Snapshot Columns
-- ============================================================================
DO $$
BEGIN
  -- expense_currency: currency of expense
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'expense_currency'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN expense_currency TEXT DEFAULT 'GBP';
    COMMENT ON COLUMN public.expenses.expense_currency IS 'Currency of amount (GBP, EUR, USD)';
  END IF;

  -- expense_date: date of expense (for FX lookup)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'expense_date'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN expense_date DATE DEFAULT CURRENT_DATE;
    COMMENT ON COLUMN public.expenses.expense_date IS 'Date of expense (for FX rate lookup)';
  END IF;

  -- expense_base_ccy: user's base currency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'expense_base_ccy'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN expense_base_ccy TEXT;
    COMMENT ON COLUMN public.expenses.expense_base_ccy IS 'User''s base currency at time of expense';
  END IF;

  -- expense_fx_rate: FX rate applied
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'expense_fx_rate'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN expense_fx_rate NUMERIC(12, 6);
    COMMENT ON COLUMN public.expenses.expense_fx_rate IS 'FX rate applied (expense_currency -> expense_base_ccy)';
  END IF;

  -- expense_amount_base: amount in base currency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'expense_amount_base'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN expense_amount_base NUMERIC(10, 2);
    COMMENT ON COLUMN public.expenses.expense_amount_base IS 'Expense amount in user''s base currency';
  END IF;

  -- expense_fx_source: source of FX rate
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'expense_fx_source'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN expense_fx_source TEXT DEFAULT 'auto';
    COMMENT ON COLUMN public.expenses.expense_fx_source IS 'Source of FX rate (auto, manual)';
  END IF;
END $$;

-- ============================================================================
-- 7. Extend Subscriptions Table with FX Snapshot Columns
-- ============================================================================
DO $$
BEGIN
  -- subscription_currency: currency of subscription
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'subscription_currency'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN subscription_currency TEXT DEFAULT 'GBP';
    COMMENT ON COLUMN public.subscriptions.subscription_currency IS 'Currency of cost (GBP, EUR, USD)';
  END IF;

  -- subscription_base_ccy: user's base currency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'subscription_base_ccy'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN subscription_base_ccy TEXT;
    COMMENT ON COLUMN public.subscriptions.subscription_base_ccy IS 'User''s base currency';
  END IF;

  -- subscription_fx_rate: FX rate applied
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'subscription_fx_rate'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN subscription_fx_rate NUMERIC(12, 6);
    COMMENT ON COLUMN public.subscriptions.subscription_fx_rate IS 'FX rate applied';
  END IF;

  -- subscription_amount_base: cost in base currency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'subscription_amount_base'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN subscription_amount_base NUMERIC(10, 2);
    COMMENT ON COLUMN public.subscriptions.subscription_amount_base IS 'Subscription cost in user''s base currency';
  END IF;

  -- subscription_fx_source: source of FX rate
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'subscription_fx_source'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN subscription_fx_source TEXT DEFAULT 'auto';
    COMMENT ON COLUMN public.subscriptions.subscription_fx_source IS 'Source of FX rate (auto, manual)';
  END IF;
END $$;

-- ============================================================================
-- 8. Idempotent Backfill Logic
-- ============================================================================
-- Backfill existing inventory records with FX snapshots
-- Only update records where FX fields are NULL

-- Backfill purchase FX snapshots
UPDATE public."Inventory"
SET
  purchase_currency = COALESCE(purchase_currency, 'GBP'),
  purchase_date = COALESCE(purchase_date, CURRENT_DATE),
  purchase_base_ccy = COALESCE(purchase_base_ccy, public.user_base_ccy(user_id)),
  purchase_fx_rate = COALESCE(
    purchase_fx_rate,
    public.fx_rate_for(
      COALESCE(purchase_date, CURRENT_DATE),
      COALESCE(purchase_currency, 'GBP'),
      public.user_base_ccy(user_id)
    )
  ),
  purchase_amount_base = COALESCE(
    purchase_amount_base,
    purchase_price * public.fx_rate_for(
      COALESCE(purchase_date, CURRENT_DATE),
      COALESCE(purchase_currency, 'GBP'),
      public.user_base_ccy(user_id)
    )
  ),
  purchase_fx_source = COALESCE(purchase_fx_source, 'backfill')
WHERE purchase_amount_base IS NULL;

-- Backfill sale FX snapshots (only for sold items)
UPDATE public."Inventory"
SET
  sale_date = COALESCE(sale_date, CURRENT_DATE),
  sale_currency = COALESCE(sale_currency, 'GBP'),
  sale_base_ccy = COALESCE(sale_base_ccy, public.user_base_ccy(user_id)),
  sale_fx_rate = COALESCE(
    sale_fx_rate,
    public.fx_rate_for(
      COALESCE(sale_date, CURRENT_DATE),
      COALESCE(sale_currency, 'GBP'),
      public.user_base_ccy(user_id)
    )
  ),
  sale_amount_base = COALESCE(
    sale_amount_base,
    COALESCE(sale_price, 0) * public.fx_rate_for(
      COALESCE(sale_date, CURRENT_DATE),
      COALESCE(sale_currency, 'GBP'),
      public.user_base_ccy(user_id)
    )
  ),
  sale_fx_source = COALESCE(sale_fx_source, 'backfill')
WHERE status = 'sold' AND sale_amount_base IS NULL;

-- Backfill expenses FX snapshots
UPDATE public.expenses
SET
  expense_currency = COALESCE(expense_currency, 'GBP'),
  expense_date = COALESCE(expense_date, CURRENT_DATE),
  expense_base_ccy = COALESCE(expense_base_ccy, public.user_base_ccy(user_id)),
  expense_fx_rate = COALESCE(
    expense_fx_rate,
    public.fx_rate_for(
      COALESCE(expense_date, CURRENT_DATE),
      COALESCE(expense_currency, 'GBP'),
      public.user_base_ccy(user_id)
    )
  ),
  expense_amount_base = COALESCE(
    expense_amount_base,
    amount * public.fx_rate_for(
      COALESCE(expense_date, CURRENT_DATE),
      COALESCE(expense_currency, 'GBP'),
      public.user_base_ccy(user_id)
    )
  ),
  expense_fx_source = COALESCE(expense_fx_source, 'backfill')
WHERE expense_amount_base IS NULL;

-- Backfill subscriptions FX snapshots
UPDATE public.subscriptions
SET
  subscription_currency = COALESCE(subscription_currency, 'GBP'),
  subscription_base_ccy = COALESCE(subscription_base_ccy, public.user_base_ccy(user_id)),
  subscription_fx_rate = COALESCE(
    subscription_fx_rate,
    public.fx_rate_for(
      CURRENT_DATE,
      COALESCE(subscription_currency, 'GBP'),
      public.user_base_ccy(user_id)
    )
  ),
  subscription_amount_base = COALESCE(
    subscription_amount_base,
    amount * public.fx_rate_for(
      CURRENT_DATE,
      COALESCE(subscription_currency, 'GBP'),
      public.user_base_ccy(user_id)
    )
  ),
  subscription_fx_source = COALESCE(subscription_fx_source, 'backfill')
WHERE subscription_amount_base IS NULL;

-- ============================================================================
-- 9. Update Portfolio Latest Prices View to Use Base Amounts
-- ============================================================================
DROP VIEW IF EXISTS public.portfolio_latest_prices CASCADE;

CREATE VIEW public.portfolio_latest_prices
WITH (security_invoker = on) AS
SELECT
  i.id AS inventory_id,
  i.user_id,
  i.sku,
  i.size_uk,
  i.purchase_price,
  i.purchase_currency,
  i.purchase_amount_base,
  i.purchase_date,
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
  -- Calculate P/L using base amounts
  CASE
    WHEN i.status = 'sold' AND i.sale_amount_base IS NOT NULL THEN
      i.sale_amount_base - i.purchase_amount_base
    WHEN lmp.price IS NOT NULL THEN
      -- Convert market price to user's base currency
      (lmp.price * public.fx_rate_for(
        COALESCE(lmp.as_of::date, CURRENT_DATE),
        lmp.currency,
        public.user_base_ccy(i.user_id)
      )) - i.purchase_amount_base
    ELSE NULL
  END AS profit,
  CASE
    WHEN i.status = 'sold' AND i.sale_amount_base IS NOT NULL AND i.purchase_amount_base > 0 THEN
      ((i.sale_amount_base - i.purchase_amount_base) / i.purchase_amount_base) * 100
    WHEN lmp.price IS NOT NULL AND i.purchase_amount_base > 0 THEN
      (((lmp.price * public.fx_rate_for(
        COALESCE(lmp.as_of::date, CURRENT_DATE),
        lmp.currency,
        public.user_base_ccy(i.user_id)
      )) - i.purchase_amount_base) / i.purchase_amount_base) * 100
    ELSE NULL
  END AS profit_pct
FROM public."Inventory" i
LEFT JOIN public.product_catalog pc ON i.sku = pc.sku
LEFT JOIN public.latest_market_prices lmp ON i.sku = lmp.sku AND i.size_uk = lmp.size
WHERE i.user_id = auth.uid();

COMMENT ON VIEW public.portfolio_latest_prices IS 'User inventory with latest market prices and P/L using base currency amounts';

-- ============================================================================
-- 10. Audit Metadata - Trigger to Log FX Conversion Events
-- ============================================================================
-- Create audit log table for FX conversions
CREATE TABLE IF NOT EXISTS public.fx_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  field_prefix TEXT NOT NULL, -- 'purchase', 'sale', 'expense', 'subscription'
  original_currency TEXT NOT NULL,
  original_amount NUMERIC(10, 2) NOT NULL,
  base_currency TEXT NOT NULL,
  fx_rate NUMERIC(12, 6) NOT NULL,
  fx_date DATE NOT NULL,
  base_amount NUMERIC(10, 2) NOT NULL,
  fx_source TEXT NOT NULL, -- 'auto', 'manual', 'backfill'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fx_audit_log_user_id ON public.fx_audit_log(user_id);
CREATE INDEX idx_fx_audit_log_table_record ON public.fx_audit_log(table_name, record_id);
CREATE INDEX idx_fx_audit_log_created_at ON public.fx_audit_log(created_at DESC);

-- RLS: Users can only see their own audit logs
ALTER TABLE public.fx_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fx audit logs"
  ON public.fx_audit_log FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.fx_audit_log IS 'Audit trail for all FX conversion events';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
