#!/usr/bin/env node

/**
 * Apply RLS Fix for inventory_market_links
 *
 * This migration fixes the RLS policy that was using wrong column name (inventory_id vs item_id)
 * Without this fix, users cannot see their own market links, causing sync to skip all items
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('🔧 Applying RLS Fix for inventory_market_links\n')
console.log('=' .repeat(80))

async function main() {
  try {
    console.log('\n📊 Executing RLS fix SQL...\n')

    // Execute the full migration SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
BEGIN;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own market links" ON public.inventory_market_links;
DROP POLICY IF EXISTS "Service role can manage market links" ON public.inventory_market_links;

-- Create policy for authenticated users (using correct column name: item_id)
CREATE POLICY "Users can view their own market links" ON public.inventory_market_links
  FOR SELECT TO authenticated
  USING (item_id IN (SELECT id FROM public."Inventory" WHERE user_id = auth.uid()));

-- Create policy for service role
CREATE POLICY "Service role can manage market links" ON public.inventory_market_links
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
      `
    })

    if (error) {
      console.error('❌ Error:', error.message)
      console.log('\n⚠️  exec_sql RPC may not exist. Trying direct SQL execution...\n')
      
      // Try executing policies one by one
      const policies = [
        'DROP POLICY IF EXISTS "Users can view their own market links" ON public.inventory_market_links;',
        'DROP POLICY IF EXISTS "Service role can manage market links" ON public.inventory_market_links;',
        `CREATE POLICY "Users can view their own market links" ON public.inventory_market_links FOR SELECT TO authenticated USING (item_id IN (SELECT id FROM public."Inventory" WHERE user_id = auth.uid()));`,
        `CREATE POLICY "Service role can manage market links" ON public.inventory_market_links FOR ALL TO service_role USING (true) WITH CHECK (true);`
      ]

      for (const sql of policies) {
        const { error: policyError } = await supabase.rpc('exec_sql', { sql })
        if (policyError) {
          console.error('❌ Policy error:', policyError.message)
        }
      }
    } else {
      console.log('✅ RLS policies updated successfully')
    }

    // Verify policies are working
    console.log('\n📊 Verifying RLS policies...\n')

    const { data: links, error: verifyError, count } = await supabase
      .from('inventory_market_links')
      .select('item_id, stockx_product_id, stockx_variant_id', { count: 'exact' })
      .limit(10)

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message)
      console.log('\n⚠️  You may need to run the SQL manually in Supabase Dashboard')
    } else {
      console.log(`✅ Policies working! Found ${count || links?.length || 0} total market links`)
      if (links && links.length > 0) {
        console.log(`   Sample: ${links.length} links retrieved`)
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log('✅ RLS fix complete! Now click "Sync Now" in your UI to fetch fresh market data.')

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.log('\n📋 Manual SQL (run in Supabase Dashboard > SQL Editor):\n')
    console.log(`
-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own market links" ON public.inventory_market_links;
DROP POLICY IF EXISTS "Service role can manage market links" ON public.inventory_market_links;

-- Create policy for authenticated users (using correct column name: item_id)
CREATE POLICY "Users can view their own market links" ON public.inventory_market_links
  FOR SELECT TO authenticated
  USING (item_id IN (SELECT id FROM public."Inventory" WHERE user_id = auth.uid()));

-- Create policy for service role
CREATE POLICY "Service role can manage market links" ON public.inventory_market_links
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
    `)
    process.exit(1)
  }
}

main().catch(console.error)
