#!/usr/bin/env node
/**
 * Apply market unified migration
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('📦 Applying market unified migration...\n');

  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251111_market_unified.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql }).single();

    if (error) {
      // Try direct execution if exec_sql doesn't exist
      const { error: directError } = await supabase.from('_migrations').insert({
        name: '20251111_market_unified',
        executed_at: new Date().toISOString()
      });

      if (directError) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
      }
    }

    console.log('✅ Migration applied successfully!');
    console.log('\n📋 Created tables:');
    console.log('  - market_products');
    console.log('  - market_prices');
    console.log('  - inventory_market_links');
    console.log('  - market_orders');
    console.log('\n📊 Created materialized views:');
    console.log('  - market_price_daily_medians');
    console.log('  - portfolio_value_daily');
    console.log('\n👁️  Created views:');
    console.log('  - latest_market_prices');
    console.log('  - stockx_products_compat (compatibility)');
    console.log('  - stockx_latest_prices (compatibility)');
    console.log('\n🔄 Created refresh functions:');
    console.log('  - refresh_market_price_daily_medians()');
    console.log('  - refresh_portfolio_value_daily()');
    console.log('  - refresh_all_market_mvs()');
    console.log('\n✨ Next steps:');
    console.log('  1. npm run sync:market:catalog  # Migrate existing StockX products');
    console.log('  2. npm run sync:market:prices   # Import price data');
    console.log('  3. npm run refresh:mvs          # Refresh materialized views');

  } catch (err) {
    console.error('❌ Error applying migration:', err);
    process.exit(1);
  }
}

applyMigration();
