-- Fix RLS policy for inventory_market_links to allow users to create their own mappings
-- Issue: Users could SELECT but not INSERT into inventory_market_links

-- Add INSERT policy for authenticated users
CREATE POLICY "Users can create their own market links" ON public.inventory_market_links
  FOR INSERT TO authenticated
  WITH CHECK (
    inventory_id IN (
      SELECT id FROM public."Inventory" WHERE user_id = auth.uid()
    )
  );

-- Add UPDATE policy for authenticated users (for future updates)
CREATE POLICY "Users can update their own market links" ON public.inventory_market_links
  FOR UPDATE TO authenticated
  USING (
    inventory_id IN (
      SELECT id FROM public."Inventory" WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    inventory_id IN (
      SELECT id FROM public."Inventory" WHERE user_id = auth.uid()
    )
  );

-- Add DELETE policy for authenticated users (for future deletions)
CREATE POLICY "Users can delete their own market links" ON public.inventory_market_links
  FOR DELETE TO authenticated
  USING (
    inventory_id IN (
      SELECT id FROM public."Inventory" WHERE user_id = auth.uid()
    )
  );
