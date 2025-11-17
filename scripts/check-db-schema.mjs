/**
 * Check actual database schema to understand column mismatches
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('='.repeat(60));
  console.log('Database Schema Check');
  console.log('='.repeat(60));

  // Check inventory_market_links table structure
  console.log('\n📋 inventory_market_links table structure:');
  const { data, error } = await supabase
    .from('inventory_market_links')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error.message);
  } else if (data && data.length > 0) {
    console.log('✅ Columns:', Object.keys(data[0]).join(', '));
    console.log('   Sample row:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('⚠️  Table is empty, checking via pg_catalog...');

    // Query PostgreSQL system catalogs to get column names
    const { data: columns, error: colError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'inventory_market_links'
          ORDER BY ordinal_position
        `
      });

    if (colError) {
      console.error('❌ Could not query schema:', colError.message);
    } else {
      console.log('✅ Schema:', columns);
    }
  }

  // Check market_price_daily_medians view structure
  console.log('\n📋 market_price_daily_medians view structure:');
  const { data: sparkData, error: sparkError } = await supabase
    .from('market_price_daily_medians')
    .select('*')
    .limit(1);

  if (sparkError) {
    console.error('❌ Error:', sparkError.message);
  } else if (sparkData && sparkData.length > 0) {
    console.log('✅ Columns:', Object.keys(sparkData[0]).join(', '));
  } else {
    console.log('⚠️  View is empty');
  }
}

checkSchema().catch(console.error);
