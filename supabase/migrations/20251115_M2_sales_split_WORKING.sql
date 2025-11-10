-- ============================================================================
-- M2: Sales Split (WORKING VERSION - Only uses confirmed columns)
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
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_user_date ON public.sales(user_id, sold_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_inventory ON public.sales(inventory_id) WHERE inventory_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_user_created ON public.sales(user_id, created_at DESC);

COMMENT ON TABLE public.sales IS 'Realized sales transactions';

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_select_own ON public.sales;
CREATE POLICY sales_select_own ON public.sales FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS sales_insert_own ON public.sales;
CREATE POLICY sales_insert_own ON public.sales FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS sales_update_own ON public.sales;
CREATE POLICY sales_update_own ON public.sales FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS sales_delete_own ON public.sales;
CREATE POLICY sales_delete_own ON public.sales FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Trigger function - only uses sale_date, sale_price, sales_fee (confirmed to exist)
CREATE OR REPLACE FUNCTION public.trg_inventory_mark_sold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_currency CHAR(3) := 'GBP';
BEGIN
  IF NEW.status::TEXT != 'sold' THEN RETURN NEW; END IF;
  IF OLD IS NOT NULL AND OLD.status::TEXT = 'sold' THEN RETURN NEW; END IF;

  SELECT COALESCE(base_currency, 'GBP') INTO v_base_currency FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.sales (
    user_id, inventory_id, sold_date, platform, base_currency,
    fx_rate_at_sale, sale_total_base, fees_base, purchase_total_base,
    sale_price_original, sale_currency_original, fees_original, notes
  ) VALUES (
    NEW.user_id, NEW.id,
    COALESCE(NEW.sale_date, CURRENT_DATE),
    COALESCE(NEW.platform::TEXT, 'other')::sale_platform,
    v_base_currency, 1.0,
    COALESCE(NEW.sale_amount_base, NEW.sale_price, 0),
    COALESCE(NEW.sales_fee, 0),
    COALESCE(NEW.purchase_amount_base, NEW.purchase_price, 0),
    COALESCE(NEW.sale_price, 0),
    COALESCE(NEW.sale_currency, 'GBP'),
    NEW.sales_fee, NEW.notes
  ) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_inventory_mark_sold ON public."Inventory";
CREATE TRIGGER trigger_inventory_mark_sold AFTER INSERT OR UPDATE ON public."Inventory"
FOR EACH ROW EXECUTE FUNCTION public.trg_inventory_mark_sold();

-- Backfill - only uses sale_date, sale_price
DO $$
DECLARE v_count INTEGER := 0;
BEGIN
  INSERT INTO public.sales (
    user_id, inventory_id, sold_date, platform, base_currency,
    fx_rate_at_sale, sale_total_base, fees_base, purchase_total_base,
    sale_price_original, sale_currency_original, notes
  )
  SELECT
    i.user_id, i.id,
    COALESCE(i.sale_date, CURRENT_DATE),
    'other'::sale_platform,
    COALESCE(p.base_currency, 'GBP'),
    1.0,
    COALESCE(i.sale_amount_base, i.sale_price, 0),
    COALESCE(i.sales_fee, 0),
    COALESCE(i.purchase_amount_base, i.purchase_price, 0),
    COALESCE(i.sale_price, 0),
    'GBP', i.notes
  FROM public."Inventory" i
  LEFT JOIN public.profiles p ON p.id = i.user_id
  WHERE i.status::TEXT = 'sold'
    AND NOT EXISTS (SELECT 1 FROM public.sales WHERE inventory_id = i.id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % items', v_count;
END $$;

-- View - only uses sale_date, sale_price
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

DO $$ BEGIN RAISE NOTICE 'M2 complete'; END $$;
