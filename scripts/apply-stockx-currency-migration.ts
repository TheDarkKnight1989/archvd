import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Test if the new parameter is accepted
async function testMigration() {
  // Try calling with the new p_stockx_currency parameter
  const { data, error } = await supabase.rpc('get_unified_market_data', {
    p_style_id: 'DD1391-100',
    p_alias_region: '1',
    p_consigned: false,
    p_stockx_currency: 'GBP'
  });

  if (error) {
    if (error.message.includes('p_stockx_currency')) {
      console.log('❌ Migration NOT applied yet. Error:', error.message);
      console.log('\n📋 Apply migration via Supabase dashboard SQL editor:');
      console.log('   supabase/migrations/20251213_add_stockx_currency_to_rpc.sql\n');
    } else {
      console.log('⚠️ Other error:', error.message);
    }
    return false;
  }

  console.log('✅ Migration applied! Function accepts p_stockx_currency parameter');
  console.log('   Sample result:', data?.[0] ? 'Found data' : 'No data for test SKU');
  return true;
}

testMigration();
