-- ============================================================================
-- M2: Sales Split (Clean slate version)
-- ============================================================================

-- Create enum if not exists
DO $$ BEGIN
  CREATE TYPE sale_platform AS ENUM ('ebay', 'stockx', 'goat', 'private', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop existing to start fresh
DROP TABLE IF EXISTS public.sales CASCADE;
DROP VIEW IF EXISTS public.sales_view_compat CASCADE;
DROP TRIGGER IF EXISTS trigger_inventory_mark_sold ON public."Inventory";
DROP FUNCTION IF EXISTS public.trg_inventory_mark_sold();

-- Create sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES public."Inventory"(id) ON DELETE SET NULL,
  sold_date DATE NOT NULL,
  platform sale_platform NOT NULL DEFAULT 'other',
  base_currency CHAR(3) NOT NULL DEFAULT 'GBP',
  sale_total_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  fees_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase_total_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  profit_base NUMERIC(12,2) GENERATED ALWAYS AS (
    sale_total_base - purchase_total_base - fees_base
  ) STORED,
  sale_price_original NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_user_date ON public.sales(user_id, sold_date DESC);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_own ON public.sales FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Trigger
CREATE FUNCTION public.trg_inventory_mark_sold()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status::TEXT = 'sold' AND (OLD IS NULL OR OLD.status::TEXT != 'sold') THEN
    INSERT INTO public.sales (user_id, inventory_id, sold_date, sale_total_base, fees_base, purchase_total_base, sale_price_original, notes)
    VALUES (NEW.user_id, NEW.id, COALESCE(NEW.sale_date, CURRENT_DATE), COALESCE(NEW.sale_price, 0), COALESCE(NEW.sales_fee, 0), COALESCE(NEW.purchase_price, 0), COALESCE(NEW.sale_price, 0), NEW.notes);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trigger_inventory_mark_sold AFTER INSERT OR UPDATE ON public."Inventory" FOR EACH ROW EXECUTE FUNCTION public.trg_inventory_mark_sold();

-- Backfill
DO $$
DECLARE v_count INTEGER := 0;
BEGIN
  INSERT INTO public.sales (user_id, inventory_id, sold_date, sale_total_base, fees_base, purchase_total_base, sale_price_original)
  SELECT i.user_id, i.id, COALESCE(i.sale_date, CURRENT_DATE), COALESCE(i.sale_price, 0), COALESCE(i.sales_fee, 0), COALESCE(i.purchase_price, 0), COALESCE(i.sale_price, 0)
  FROM public."Inventory" i WHERE i.status::TEXT = 'sold';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled %', v_count;
END $$;

-- View
CREATE VIEW public.sales_view_compat WITH (security_invoker = on) AS
SELECT i.id, i.user_id, i.sku, i.brand, i.model, i.purchase_price, i.sale_price, i.sale_date, i.status, s.id AS sales_id, s.sale_total_base, s.profit_base
FROM public."Inventory" i LEFT JOIN public.sales s ON s.inventory_id = i.id
WHERE i.status::TEXT = 'sold' AND i.user_id = auth.uid() ORDER BY i.sale_date DESC NULLS LAST;

GRANT SELECT ON public.sales_view_compat TO authenticated;
