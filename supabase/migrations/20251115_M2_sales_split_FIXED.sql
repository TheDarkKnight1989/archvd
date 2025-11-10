-- ============================================================================
-- M2: Sales Split (Compatible with Existing Schema)
-- Purpose: Create sales table that works with your existing FX columns
-- ============================================================================

-- ============================================================================
-- 1. Create Sales Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES public."Inventory"(id) ON DELETE SET NULL,

  -- Sale identification
  sold_date DATE NOT NULL,
  platform sale_platform NOT NULL DEFAULT 'other',

  -- Base currency accounting
  base_currency CHAR(3) NOT NULL CHECK (base_currency IN ('GBP', 'EUR', 'USD')),
  fx_rate_at_sale NUMERIC(12,6) NOT NULL DEFAULT 1.0,

  -- Amounts in base currency
  sale_total_base NUMERIC(12,2) NOT NULL,
  fees_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase_total_base NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Profit (generated column)
  profit_base NUMERIC(12,2) GENERATED ALWAYS AS (
    sale_total_base - purchase_total_base - fees_base - shipping_base
  ) STORED,

  -- Original amounts for reference
  sale_price_original NUMERIC(12,2),
  sale_currency_original CHAR(3),
  fees_original NUMERIC(12,2),
  shipping_original NUMERIC(12,2),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_user_date
ON public.sales(user_id, sold_date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_inventory
ON public.sales(inventory_id) WHERE inventory_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_user_created
ON public.sales(user_id, created_at DESC);

COMMENT ON TABLE public.sales IS
'Realized sales transactions (source of truth for P&L). Auto-populated when Inventory items marked as sold.';

-- RLS Policies
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_select_own ON public.sales;
CREATE POLICY sales_select_own
ON public.sales
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS sales_insert_own ON public.sales;
CREATE POLICY sales_insert_own
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS sales_update_own ON public.sales;
CREATE POLICY sales_update_own
ON public.sales
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS sales_delete_own ON public.sales;
CREATE POLICY sales_delete_own
ON public.sales
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- 2. Auto-Migration Trigger
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
BEGIN
  -- Only process when marking as sold
  IF NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold') THEN

    -- Get user's base currency
    SELECT base_currency INTO v_base_currency
    FROM public.profiles
    WHERE id = NEW.user_id;

    v_base_currency := COALESCE(v_base_currency, 'GBP');

    -- Calculate purchase total from existing columns
    v_purchase_total := COALESCE(
      NEW.purchase_amount_base,
      NEW.purchase_price + COALESCE(NEW.tax, 0) + COALESCE(NEW.shipping, 0)
    );

    -- Insert into sales table
    INSERT INTO public.sales (
      user_id,
      inventory_id,
      sold_date,
      platform,
      base_currency,
      fx_rate_at_sale,
      sale_total_base,
      fees_base,
      shipping_base,
      purchase_total_base,
      sale_price_original,
      sale_currency_original,
      fees_original,
      notes
    ) VALUES (
      NEW.user_id,
      NEW.id,
      COALESCE(NEW.sold_date, NEW.sale_date, CURRENT_DATE),
      (CASE
        WHEN NEW.platform IS NOT NULL THEN NEW.platform::sale_platform
        ELSE 'other'::sale_platform
      END),
      v_base_currency,
      COALESCE(NEW.sale_fx_rate, 1.0),
      COALESCE(NEW.sale_amount_base, NEW.sold_price, NEW.sale_price),
      COALESCE(NEW.sales_fee, 0),
      0, -- shipping on sale (not tracked separately in old schema)
      v_purchase_total,
      COALESCE(NEW.sold_price, NEW.sale_price),
      COALESCE(NEW.sale_currency, 'GBP'),
      NEW.sales_fee,
      NEW.notes
    )
    ON CONFLICT DO NOTHING; -- Skip if already exists

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_inventory_mark_sold ON public."Inventory";
CREATE TRIGGER trigger_inventory_mark_sold
  AFTER INSERT OR UPDATE ON public."Inventory"
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_inventory_mark_sold();

-- ============================================================================
-- 3. Backfill Existing Sold Items
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER := 0;
  v_item RECORD;
  v_base_currency CHAR(3);
  v_purchase_total NUMERIC;
BEGIN
  FOR v_item IN
    SELECT i.* FROM public."Inventory" i
    WHERE i.status = 'sold'
      AND NOT EXISTS (
        SELECT 1 FROM public.sales WHERE inventory_id = i.id
      )
  LOOP
    -- Get base currency
    SELECT base_currency INTO v_base_currency
    FROM public.profiles
    WHERE id = v_item.user_id;

    v_base_currency := COALESCE(v_base_currency, 'GBP');

    -- Calculate purchase total
    v_purchase_total := COALESCE(
      v_item.purchase_amount_base,
      v_item.purchase_price + COALESCE(v_item.tax, 0) + COALESCE(v_item.shipping, 0)
    );

    -- Insert
    INSERT INTO public.sales (
      user_id,
      inventory_id,
      sold_date,
      platform,
      base_currency,
      fx_rate_at_sale,
      sale_total_base,
      fees_base,
      shipping_base,
      purchase_total_base,
      sale_price_original,
      sale_currency_original,
      fees_original,
      notes
    ) VALUES (
      v_item.user_id,
      v_item.id,
      COALESCE(v_item.sold_date, v_item.sale_date, CURRENT_DATE),
      (CASE
        WHEN v_item.platform IS NOT NULL THEN v_item.platform::sale_platform
        ELSE 'other'::sale_platform
      END),
      v_base_currency,
      COALESCE(v_item.sale_fx_rate, 1.0),
      COALESCE(v_item.sale_amount_base, v_item.sold_price, v_item.sale_price),
      COALESCE(v_item.sales_fee, 0),
      0,
      v_purchase_total,
      COALESCE(v_item.sold_price, v_item.sale_price),
      COALESCE(v_item.sale_currency, 'GBP'),
      v_item.sales_fee,
      v_item.notes
    )
    ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfilled % sold items to sales table', v_count;
END $$;

-- ============================================================================
-- 4. Compatibility View
-- ============================================================================

CREATE OR REPLACE VIEW public.sales_view_compat
WITH (security_invoker = on) AS
SELECT
  i.id,
  i.user_id,
  i.sku,
  i.brand,
  i.model,
  i.size_uk,
  i.size,
  i.category,
  i.condition,
  i.purchase_price,
  i.sold_price,
  i.sold_date,
  i.platform,
  i.sales_fee,
  i.notes,
  i.status,
  i.created_at,
  i.updated_at,
  s.id AS sales_id,
  s.sale_total_base,
  s.fees_base,
  s.profit_base
FROM public."Inventory" i
LEFT JOIN public.sales s ON s.inventory_id = i.id
WHERE i.status = 'sold'
  AND i.user_id = auth.uid()
ORDER BY i.sold_date DESC NULLS LAST, i.created_at DESC;

GRANT SELECT ON public.sales_view_compat TO authenticated;

COMMENT ON VIEW public.sales_view_compat IS
'@deprecated Compatibility view for legacy code. Use sales table directly.';

-- ============================================================================
-- 5. Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'M2 migration complete - sales table ready';
END $$;
