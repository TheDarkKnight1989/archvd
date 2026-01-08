import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const stockxProductId = '2d9c05af-5a83-479d-8221-eceee97bc0df';

  // 1. Check inventory_v4_stockx_products table
  console.log('=== inventory_v4_stockx_products ===');
  const { data: product } = await supabase
    .from('inventory_v4_stockx_products')
    .select('stockx_product_id, style_id, title')
    .eq('stockx_product_id', stockxProductId)
    .single();
  console.log(product ? `Found: ${product.title}` : 'NOT FOUND');

  // 2. Check inventory_v4_stockx_variants
  console.log('\n=== inventory_v4_stockx_variants ===');
  const { data: variants, error: varErr } = await supabase
    .from('inventory_v4_stockx_variants')
    .select('stockx_variant_id, variant_value')
    .eq('stockx_product_id', stockxProductId);
  console.log('Variants:', variants?.length || 0);
  if (variants?.length) {
    console.log('First 3:', variants.slice(0, 3).map(v => `${v.variant_value} (${v.stockx_variant_id})`));
  }
  if (varErr) console.log('Error:', varErr.message);

  // 3. Check market data (by variant_id, not product_id!)
  console.log('\n=== inventory_v4_stockx_market_data (via variant) ===');
  if (variants?.length) {
    const variantIds = variants.map(v => v.stockx_variant_id);
    const { data: market, error: mErr, count } = await supabase
      .from('inventory_v4_stockx_market_data')
      .select('stockx_variant_id, currency_code, lowest_ask, updated_at', { count: 'exact' })
      .in('stockx_variant_id', variantIds);
    console.log('Market data rows:', count);
    if (market?.length) {
      console.log('Sample:', market.slice(0, 3));
    } else {
      console.log('NO MARKET DATA FOUND');
    }
    if (mErr) console.log('Error:', mErr.message);
  }

  // 4. Check what columns market_data table actually has
  console.log('\n=== Market Data Table Sample (any product) ===');
  const { data: sample, error: sErr } = await supabase
    .from('inventory_v4_stockx_market_data')
    .select('*')
    .limit(1);
  if (sample?.length) {
    console.log('Columns:', Object.keys(sample[0]));
    console.log('Sample row:', sample[0]);
  } else {
    console.log('Table is EMPTY!');
    if (sErr) console.log('Error:', sErr.message);
  }

  // 5. Now look at the unified market data service query
  console.log('\n=== What UnifiedMarketSection queries expect ===');
  // The UI uses get_unified_market_data() RPC or getUnifiedMarketDataDirect
  // Let's see what a working query looks like
  const { data: styleCatalog } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, stockx_product_id, alias_catalog_id')
    .eq('style_id', 'II1493-600')
    .single();
  console.log('Style catalog:', styleCatalog);
}

check();
