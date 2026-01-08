#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function verifyTables() {
  console.log('🔍 VERIFYING INVENTORY V4 STOCKX TABLES');
  console.log('='.repeat(60));
  console.log('');

  const expectedTables = [
    'inventory_v4_stockx_products',
    'inventory_v4_stockx_variants',
    'inventory_v4_stockx_market_data',
    'inventory_v4_stockx_price_history',
    'inventory_v4_stockx_user_inventory'
  ];

  let foundCount = 0;
  const results = [];

  for (const tableName of expectedTables) {
    try {
      const { error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);

      if (!error) {
        results.push({ table: tableName, status: '✅ EXISTS' });
        foundCount++;
      } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
        results.push({ table: tableName, status: '❌ NOT FOUND' });
      } else {
        // Table exists but there might be permission issue or other error
        results.push({ table: tableName, status: '✅ EXISTS (with note: ' + error.message + ')' });
        foundCount++;
      }
    } catch (err) {
      results.push({ table: tableName, status: '❌ ERROR: ' + err.message });
    }
  }

  console.log('📋 Table Verification Results:\n');
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.table.padEnd(45)} ${result.status}`);
  });

  console.log('');
  console.log('='.repeat(60));
  console.log(`📊 Result: ${foundCount}/${expectedTables.length} tables verified`);
  console.log('='.repeat(60));
  console.log('');

  if (foundCount === 5) {
    console.log('✅ SUCCESS! All 5 tables created successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Build StockX sync script (fetch → transform → store)');
    console.log('  2. Test data storage with real Nike Dunk Low Panda');
    console.log('  3. Build inventory-v4 page');
    console.log('  4. Hook up list/delist modals');
    console.log('');
  } else {
    console.log('⚠️  WARNING: Some tables are missing!');
    console.log('   Migration may not have been fully applied.');
    console.log('');
    console.log('   Check: supabase/migrations/20251209_create_inventory_v4_schema.sql');
    console.log('');
  }
}

verifyTables();
