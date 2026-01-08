import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const sku = 'II1493-600';

  // Check style catalog
  const { data: style, error: styleErr } = await supabase
    .from('inventory_v4_style_catalog')
    .select('*')
    .eq('style_id', sku)
    .maybeSingle();

  console.log('=== Style Catalog Entry ===');
  if (styleErr) console.log('Error:', styleErr.message);
  else if (!style) console.log('NOT FOUND in V4 catalog!');
  else console.log(JSON.stringify(style, null, 2));

  if (!style) {
    console.log('\n⚠️  This SKU is not in the V4 catalog.');
    console.log('   Market Inspector may be reading from old V3 tables.');
    return;
  }

  // Check StockX market data
  if (style.stockx_product_id) {
    const { data: sxData } = await supabase
      .from('inventory_v4_stockx_market_data')
      .select('updated_at, region_id')
      .eq('stockx_product_id', style.stockx_product_id)
      .order('updated_at', { ascending: false })
      .limit(3);

    console.log('\n=== StockX Market Data (latest 3) ===');
    console.log(sxData || 'None');
  } else {
    console.log('\n⚠️  No stockx_product_id in catalog');
  }

  // Check Alias market data
  if (style.alias_catalog_id) {
    const { data: alData } = await supabase
      .from('inventory_v4_alias_market_data')
      .select('updated_at, region_id')
      .eq('alias_catalog_id', style.alias_catalog_id)
      .order('updated_at', { ascending: false })
      .limit(3);

    console.log('\n=== Alias Market Data (latest 3) ===');
    console.log(alData || 'None');
  } else {
    console.log('\n⚠️  No alias_catalog_id in catalog');
  }
}

check();
