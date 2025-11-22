#!/usr/bin/env node
/**
 * Apply RLS fix for inventory_market_links table
 * WHY: Policy uses wrong column name (inventory_id vs item_id)
 */
console.log('\n🔧 Portfolio Price Display - RLS Fix\n')
console.log('The root cause of the "—" values in Market/Instant Sell columns is an RLS policy bug.')
console.log('The policy on inventory_market_links uses inventory_id but the actual column is item_id.\n')

console.log('📋 To fix this, please apply the following SQL in your Supabase SQL Editor:\n')
console.log('━'.repeat(80))
console.log(`
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
`)
console.log('━'.repeat(80))
console.log('\n📍 Steps to Apply:')
console.log('   1. Go to your Supabase project dashboard')
console.log('   2. Navigate to SQL Editor')
console.log('   3. Paste the SQL above')
console.log('   4. Click "Run"')
console.log('   5. Refresh your Portfolio page')

console.log('\n✅ Expected Result After Fix:')
console.log('   • Browser console should show: stockxMappingsCount: 4 (not 0)')
console.log('   • Market/Instant Sell columns will display actual prices')
console.log('   • At least one item should show non-"—" value\n')

console.log('💡 The migration file is saved at:')
console.log('   supabase/migrations/20251119_fix_inventory_market_links_rls.sql\n')
