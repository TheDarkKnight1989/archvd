-- Fix RLS policy for inventory_market_links
-- WHY: Policy was using wrong column name (inventory_id vs item_id)

BEGIN;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own market links" ON public.inventory_market_links;
DROP POLICY IF EXISTS "Service role can manage market links" ON public.inventory_market_links;

-- Recreate with correct column name (item_id, not inventory_id)
CREATE POLICY "Users can view their own market links" ON public.inventory_market_links
  FOR SELECT TO authenticated
  USING (item_id IN (SELECT id FROM public."Inventory" WHERE user_id = auth.uid()));

-- Service role can do everything (for workers)
CREATE POLICY "Service role can manage market links" ON public.inventory_market_links
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
