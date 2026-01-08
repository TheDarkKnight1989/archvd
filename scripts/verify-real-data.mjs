#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 VERIFYING REAL DATA IN DATABASE\n');
console.log('='.repeat(80));

// Check the newly synced Jordan 3 A Ma Maniére
const { data: product } = await supabase
  .from('inventory_v4_stockx_products')
  .select('*')
  .eq('style_id', 'FZ4811-001')
  .single();

console.log('\n📦 Product:', product?.title || 'NOT FOUND');
console.log('  - Brand:', product?.brand);
console.log('  - Style ID:', product?.style_id);
console.log('  - Product ID:', product?.stockx_product_id);

if (product) {
  // Check variants
  const { data: variants } = await supabase
    .from('inventory_v4_stockx_variants')
    .select('*')
    .eq('stockx_product_id', product.stockx_product_id);

  console.log('\n🔢 Variants:', variants?.length || 0);
  if (variants?.length) {
    console.log('  - Sizes:', variants.slice(0, 5).map(v => v.variant_value).join(', '), '...');
  }

  // Check market data (with actual prices)
  const { data: marketData } = await supabase
    .from('inventory_v4_stockx_market_data')
    .select('*')
    .in('stockx_variant_id', variants?.map(v => v.stockx_variant_id) || [])
    .limit(3);

  console.log('\n💰 Market Data:', marketData?.length || 0, 'records');
  if (marketData?.length) {
    marketData.forEach(md => {
      console.log(`  - Size: (lookup), Ask: £${md.lowest_ask}, Bid: £${md.highest_bid}, Updated: ${md.updated_at?.substring(0, 19)}`);
    });
  }

  // Check price history
  const { data: history } = await supabase
    .from('inventory_v4_stockx_price_history')
    .select('*')
    .in('stockx_variant_id', variants?.map(v => v.stockx_variant_id) || [])
    .limit(5);

  console.log('\n📈 Price History:', history?.length || 0, 'snapshots');
  if (history?.length) {
    console.log('  - Earliest:', history[0]?.recorded_at?.substring(0, 19));
  }
}

// Count total synced products
const { count: totalProducts } = await supabase
  .from('inventory_v4_stockx_products')
  .select('*', { count: 'exact', head: true });

const { count: totalVariants } = await supabase
  .from('inventory_v4_stockx_variants')
  .select('*', { count: 'exact', head: true });

const { count: totalMarketData } = await supabase
  .from('inventory_v4_stockx_market_data')
  .select('*', { count: 'exact', head: true });

const { count: totalHistory } = await supabase
  .from('inventory_v4_stockx_price_history')
  .select('*', { count: 'exact', head: true });

console.log('\n' + '='.repeat(80));
console.log('📊 TOTAL DATABASE COUNTS:');
console.log('  - Products:', totalProducts);
console.log('  - Variants:', totalVariants);
console.log('  - Market Data:', totalMarketData);
console.log('  - Price History:', totalHistory);
console.log('='.repeat(80));
console.log('');
