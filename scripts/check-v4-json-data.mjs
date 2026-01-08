import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkJsonData() {
  // Check StockX JSON fields
  const { data: sxData } = await supabase
    .from('inventory_v4_stockx_market_data')
    .select('stockx_variant_id, standard_market_data, flex_market_data, direct_market_data')
    .not('standard_market_data', 'is', null)
    .limit(1);
    
  if (sxData?.[0]) {
    console.log('=== StockX JSON Data Sample ===');
    console.log('standard_market_data keys:', Object.keys(sxData[0].standard_market_data || {}));
    console.log('Sample:', JSON.stringify(sxData[0].standard_market_data, null, 2).slice(0, 500));
  }
  
  // Check Alias additional fields
  const { data: alData } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('alias_variant_id, sales_last_72h, sales_last_30d, total_sales_volume, ask_count, bid_count')
    .not('sales_last_72h', 'is', null)
    .limit(5);
  
  console.log('\n=== Alias Sales Metrics Sample ===');
  console.log(alData);
  
  // Check raw snapshots for chart data
  const { data: rawData } = await supabase
    .from('stockx_raw_snapshots')
    .select('product_id, endpoint, raw_payload')
    .limit(1);
    
  if (rawData?.[0]?.raw_payload) {
    console.log('\n=== StockX Raw Snapshot Sample ===');
    console.log('Endpoint:', rawData[0].endpoint);
    const payload = rawData[0].raw_payload;
    console.log('Top-level keys:', Object.keys(payload));
    
    // Check for chart/history data
    if (payload.chartData) console.log('chartData found:', Object.keys(payload.chartData));
    if (payload.salesHistory) console.log('salesHistory found:', payload.salesHistory?.length);
    if (payload.priceHistory) console.log('priceHistory found:', Object.keys(payload.priceHistory));
  }
}

checkJsonData().catch(console.error);
