import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHistograms() {
  // Check for histogram tables
  const tables = [
    'alias_offer_histograms',
    'inventory_v4_alias_histograms',
    'alias_bid_histograms',
    'alias_ask_histograms'
  ];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    console.log(`${table}:`, data?.[0] ? Object.keys(data[0]) : (error?.message || 'Empty'));
  }
  
  // Check alias variants for additional fields
  const { data: variant } = await supabase
    .from('inventory_v4_alias_variants')
    .select('*')
    .limit(1);
  console.log('\ninventory_v4_alias_variants columns:', variant?.[0] ? Object.keys(variant[0]) : 'No data');
  
  // Check recent sales detail
  const { data: salesDetail, error: salesErr } = await supabase
    .from('alias_sales_detail')
    .select('*')
    .limit(3);
  console.log('\nalias_sales_detail:', salesDetail ? salesDetail : (salesErr?.message || 'Empty'));
}

checkHistograms().catch(console.error);
