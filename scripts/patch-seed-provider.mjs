#!/usr/bin/env node

/**
 * Apply seed provider patch using Supabase client
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyPatch() {
  console.log('🔧 Applying seed provider patch...\n')
  console.log('📝 This will add "seed" to provider constraints\n')

  try {
    // Execute the SQL directly
    const sql = `
      -- Add meta column to market_products (if not exists)
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'market_products' AND column_name = 'meta'
        ) THEN
          ALTER TABLE market_products ADD COLUMN meta jsonb DEFAULT '{}'::jsonb;
        END IF;
      END $$;

      -- Update provider constraints to include 'seed'
      ALTER TABLE market_products DROP CONSTRAINT IF EXISTS market_products_provider_check;
      ALTER TABLE market_products ADD CONSTRAINT market_products_provider_check
        CHECK (provider IN ('stockx', 'alias', 'ebay', 'seed'));

      ALTER TABLE market_prices DROP CONSTRAINT IF EXISTS market_prices_provider_check;
      ALTER TABLE market_prices ADD CONSTRAINT market_prices_provider_check
        CHECK (provider IN ('stockx', 'alias', 'ebay', 'seed'));

      ALTER TABLE inventory_market_links DROP CONSTRAINT IF EXISTS inventory_market_links_provider_check;
      ALTER TABLE inventory_market_links ADD CONSTRAINT inventory_market_links_provider_check
        CHECK (provider IN ('stockx', 'alias', 'ebay', 'seed'));

      ALTER TABLE market_orders DROP CONSTRAINT IF EXISTS market_orders_provider_check;
      ALTER TABLE market_orders ADD CONSTRAINT market_orders_provider_check
        CHECK (provider IN ('stockx', 'alias', 'ebay', 'seed'));
    `

    // Try using rpc to execute raw SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql })

    if (error) {
      console.error('❌ RPC method not available. Please apply manually via Supabase Dashboard.\n')
      console.log('📋 Copy the SQL from: supabase/migrations/20251111_seed_provider_clean.sql\n')
      console.log('🔗 Go to: https://supabase.com/dashboard → SQL Editor → New Query\n')
      process.exit(1)
    }

    console.log('✅ Patch applied successfully!')
    console.log('\n🚀 Now you can run: npm run seed:market:bridge\n')

  } catch (err) {
    console.error('❌ Failed:', err.message)
    console.log('\n📋 Please apply the SQL manually via Supabase Dashboard:')
    console.log('   File: supabase/migrations/20251111_seed_provider_clean.sql\n')
    console.log('🔗 https://supabase.com/dashboard → SQL Editor → New Query\n')
    process.exit(1)
  }
}

applyPatch()
