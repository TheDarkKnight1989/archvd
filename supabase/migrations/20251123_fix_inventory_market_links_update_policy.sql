-- Fix RLS policies for inventory_market_links
-- WHY: Users can SELECT but cannot UPDATE/INSERT/DELETE their own market links
-- IMPACT: Listings created by users fail to update inventory_market_links.stockx_listing_id

BEGIN;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view their own market links" ON public.inventory_market_links;
DROP POLICY IF EXISTS "Service role can manage market links" ON public.inventory_market_links;

-- Allow users to SELECT their own market links
CREATE POLICY "Users can view their own market links" ON public.inventory_market_links
  FOR SELECT TO authenticated
  USING (item_id IN (SELECT id FROM public."Inventory" WHERE user_id = auth.uid()));

-- Allow users to UPDATE their own market links
CREATE POLICY "Users can update their own market links" ON public.inventory_market_links
  FOR UPDATE TO authenticated
  USING (item_id IN (SELECT id FROM public."Inventory" WHERE user_id = auth.uid()))
  WITH CHECK (item_id IN (SELECT id FROM public."Inventory" WHERE user_id = auth.uid()));

-- Allow users to INSERT their own market links
CREATE POLICY "Users can insert their own market links" ON public.inventory_market_links
  FOR INSERT TO authenticated
  WITH CHECK (item_id IN (SELECT id FROM public."Inventory" WHERE user_id = auth.uid()));

-- Allow users to DELETE their own market links
CREATE POLICY "Users can delete their own market links" ON public.inventory_market_links
  FOR DELETE TO authenticated
  USING (item_id IN (SELECT id FROM public."Inventory" WHERE user_id = auth.uid()));

-- Service role can do everything (for workers)
CREATE POLICY "Service role can manage market links" ON public.inventory_market_links
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
