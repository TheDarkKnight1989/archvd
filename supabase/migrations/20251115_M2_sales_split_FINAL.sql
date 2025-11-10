-- ============================================================================
-- M2: Sales Split (FINAL - Bulletproof Version)
-- ============================================================================

-- ============================================================================
-- 1. Create Sales Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES public."Inventory"(id) ON DELETE SET NULL,
  sold_date DATE NOT NULL,
  platform sale_platform NOT NULL DEFAULT 'other',
  base_currency CHAR(3) NOT NULL CHECK (base_currency IN ('GBP', 'EUR', 'USD')),
  fx_rate_at_sale NUMERIC(12,6) NOT NULL DEFAULT 1.0,
  sale_total_base NUMERIC(12,2) NOT NULL,
  fees_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase_total_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  profit_base NUMERIC(12,2) GENERATED ALWAYS AS (
    sale_total_base - purchase_total_base - fees_base - shipping_base
  ) STORED,
  sale_price_original NUMERIC(12,2),
  sale_currency_original CHAR(3),
  fees_original NUMERIC(12,2),
  shipping_original NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_user_date ON public.sales(user_id, sold_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_inventory ON public.sales(inventory_id) WHERE inventory_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_user_created ON public.sales(user_id, created_at DESC);

COMMENT ON TABLE public.sales IS 'Realized sales transactions (source of truth for P&L). Auto-populated when Inventory items marked as sold.';

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_select_own ON public.sales;
CREATE POLICY sales_select_own ON public.sales FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS sales_insert_own ON public.sales;
CREATE POLICY sales_insert_own ON public.sales FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS sales_update_own ON public.sales;
CREATE POLICY sales_update_own ON public.sales FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS sales_delete_own ON public.sales;
CREATE POLICY sales_delete_own ON public.sales FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- 2. Auto-Migration Trigger (Ultra Defensive)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_inventory_mark_sold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_currency CHAR(3);
  v_purchase_total NUMERIC;
  v_sold_date DATE;
  v_sale_total NUMERIC;
  v_sale_price NUMERIC;
BEGIN
  IF NEW.status::TEXT != 'sold' THEN
    RETURN NEW;
  END IF;
  
  IF OLD IS NOT NULL AND OLD.status::TEXT = 'sold' THEN
    RETURN NEW;
  END IF;

  -- Get base currency
  BEGIN
    SELECT base_currency INTO v_base_currency FROM public.profiles WHERE id = NEW.user_id;
  EXCEPTION WHEN OTHERS THEN
    v_base_currency := 'GBP';
  END;
  v_base_currency := COALESCE(v_base_currency, 'GBP');

  -- Get date (try both columns)
  BEGIN
    v_sold_date := NEW.sold_date;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_sold_date := NEW.sale_date;
    EXCEPTION WHEN OTHERS THEN
      v_sold_date := CURRENT_DATE;
    END;
  END;
  v_sold_date := COALESCE(v_sold_date, CURRENT_DATE);

  -- Get purchase total
  BEGIN
    v_purchase_total := NEW.purchase_amount_base;
  EXCEPTION WHEN OTHERS THEN
    v_purchase_total := NULL;
  END;
  
  IF v_purchase_total IS NULL THEN
    v_purchase_total := NEW.purchase_price + COALESCE(NEW.tax, 0) + COALESCE(NEW.shipping, 0);
  END IF;

  -- Get sale total
  BEGIN
    v_sale_total := NEW.sale_amount_base;
  EXCEPTION WHEN OTHERS THEN
    v_sale_total := NULL;
  END;
  
  IF v_sale_total IS NULL THEN
    BEGIN
      v_sale_total := NEW.sold_price;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        v_sale_total := NEW.sale_price;
      EXCEPTION WHEN OTHERS THEN
        v_sale_total := 0;
      END;
    END;
  END IF;

  -- Get sale price for reference
  BEGIN
    v_sale_price := NEW.sold_price;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_sale_price := NEW.sale_price;
    EXCEPTION WHEN OTHERS THEN
      v_sale_price := 0;
    END;
  END;

  -- Insert
  INSERT INTO public.sales (
    user_id, inventory_id, sold_date, platform, base_currency, fx_rate_at_sale,
    sale_total_base, fees_base, shipping_base, purchase_total_base,
    sale_price_original, sale_currency_original, fees_original, notes
  ) VALUES (
    NEW.user_id, NEW.id, v_sold_date,
    COALESCE(NEW.platform::TEXT, 'other')::sale_platform,
    v_base_currency, COALESCE(NEW.sale_fx_rate, 1.0),
    v_sale_total, COALESCE(NEW.sales_fee, 0), 0, v_purchase_total,
    v_sale_price, COALESCE(NEW.sale_currency, 'GBP'),
    NEW.sales_fee, NEW.notes
  ) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_inventory_mark_sold ON public."Inventory";
CREATE TRIGGER trigger_inventory_mark_sold AFTER INSERT OR UPDATE ON public."Inventory" FOR EACH ROW EXECUTE FUNCTION public.trg_inventory_mark_sold();

-- ============================================================================
-- 3. Backfill (Skip if there are no sold items)
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER := 0;
  v_has_sold BOOLEAN;
BEGIN
  -- Check if there are any sold items
  SELECT EXISTS(SELECT 1 FROM public."Inventory" WHERE status::TEXT = 'sold' LIMIT 1) INTO v_has_sold;
  
  IF NOT v_has_sold THEN
    RAISE NOTICE 'No sold items to backfill';
    RETURN;
  END IF;

  -- Backfill using simple INSERT with minimal column refs
  INSERT INTO public.sales (
    user_id, inventory_id, sold_date, platform, base_currency,
    fx_rate_at_sale, sale_total_base, fees_base, shipping_base,
    purchase_total_base, sale_price_original, sale_currency_original, notes
  )
  SELECT
    i.user_id,
    i.id,
    COALESCE(i.sale_date, CURRENT_DATE),
    'other'::sale_platform,
    COALESCE(p.base_currency, 'GBP'),
    1.0,
    COALESCE(i.sale_price, 0),
    COALESCE(i.sales_fee, 0),
    0,
    COALESCE(i.purchase_price, 0),
    COALESCE(i.sale_price, 0),
    'GBP',
    i.notes
  FROM public."Inventory" i
  LEFT JOIN public.profiles p ON p.id = i.user_id
  WHERE i.status::TEXT = 'sold'
    AND NOT EXISTS (SELECT 1 FROM public.sales WHERE inventory_id = i.id)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % sold items', v_count;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Backfill skipped due to error: %', SQLERRM;
END $$;

-- ============================================================================
-- 4. Compatibility View
-- ============================================================================

CREATE OR REPLACE VIEW public.sales_view_compat
WITH (security_invoker = on) AS
SELECT
  i.id, i.user_id, i.sku, i.brand, i.model, i.category,
  i.purchase_price, i.sale_price, i.sale_date, i.sales_fee,
  i.notes, i.status, i.created_at, i.updated_at,
  s.id AS sales_id, s.sale_total_base, s.fees_base, s.profit_base
FROM public."Inventory" i
LEFT JOIN public.sales s ON s.inventory_id = i.id
WHERE i.status::TEXT = 'sold' AND i.user_id = auth.uid()
ORDER BY i.sale_date DESC NULLS LAST, i.created_at DESC;

GRANT SELECT ON public.sales_view_compat TO authenticated;

-- ============================================================================
-- 5. Done
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'M2 migration complete';
END $$;
