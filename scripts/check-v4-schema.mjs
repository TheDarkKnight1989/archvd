import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  // Check stockx market data sample
  const { data: sxSample } = await supabase
    .from('inventory_v4_stockx_market_data')
    .select('*')
    .limit(1);
  console.log('StockX market data columns:', sxSample?.[0] ? Object.keys(sxSample[0]) : 'No data');

  // Check alias market data sample
  const { data: alSample } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('*')
    .limit(1);
  console.log('Alias market data columns:', alSample?.[0] ? Object.keys(alSample[0]) : 'No data');

  // Check for price_history tables
  const { data: histTables, error } = await supabase
    .from('price_history_daily')
    .select('*')
    .limit(1);
  console.log('price_history_daily:', histTables?.[0] ? Object.keys(histTables[0]) : (error?.message || 'Empty'));

  // Check for raw snapshots
  const { data: rawSx, error: rawSxErr } = await supabase
    .from('stockx_raw_snapshots')
    .select('*')
    .limit(1);
  console.log('stockx_raw_snapshots:', rawSx?.[0] ? Object.keys(rawSx[0]) : (rawSxErr?.message || 'Empty'));

  const { data: rawAl, error: rawAlErr } = await supabase
    .from('alias_raw_snapshots')
    .select('*')
    .limit(1);
  console.log('alias_raw_snapshots:', rawAl?.[0] ? Object.keys(rawAl[0]) : (rawAlErr?.message || 'Empty'));

  // Check daily_market_summary
  const { data: dailySummary, error: dailyErr } = await supabase
    .from('daily_market_summary')
    .select('*')
    .limit(1);
  console.log('daily_market_summary:', dailySummary?.[0] ? Object.keys(dailySummary[0]) : (dailyErr?.message || 'Empty'));

  // Check alias_recent_sales
  const { data: aliasSales, error: salesErr } = await supabase
    .from('alias_recent_sales')
    .select('*')
    .limit(1);
  console.log('alias_recent_sales:', aliasSales?.[0] ? Object.keys(aliasSales[0]) : (salesErr?.message || 'Empty'));

  // Check for sales history in alias market data
  const { data: aliasWithSales } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('last_sale_price, global_indicator_price, updated_at')
    .not('last_sale_price', 'is', null)
    .limit(3);
  console.log('\nAlias sales data sample:', aliasWithSales);
}

checkSchema().catch(console.error);
