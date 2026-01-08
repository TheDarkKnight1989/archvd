#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 VERIFYING ALL 45 SKUS - ONE SIZE FROM EACH\n');
console.log('='.repeat(100));

// Get all products synced from the bulk run
const { data: products } = await supabase
  .from('inventory_v4_stockx_products')
  .select('*')
  .order('style_id');

console.log(`\nTotal Products: ${products?.length || 0}\n`);

for (const product of products || []) {
  // Get one variant (prefer size 9 or 10, otherwise first one)
  const { data: variants } = await supabase
    .from('inventory_v4_stockx_variants')
    .select('*')
    .eq('stockx_product_id', product.stockx_product_id)
    .order('variant_value');

  if (!variants?.length) {
    console.log(`❌ ${product.style_id} - NO VARIANTS`);
    continue;
  }

  // Pick a size (prefer 9 or 10 if available, otherwise first)
  const preferredSizes = ['9', '10', '9.5', '10.5', '8.5', '11'];
  let variant = variants.find(v => preferredSizes.includes(v.variant_value)) || variants[0];

  // Get market data for this variant
  const { data: marketData } = await supabase
    .from('inventory_v4_stockx_market_data')
    .select('*')
    .eq('stockx_variant_id', variant.stockx_variant_id)
    .single();

  // Format output
  console.log(`\n${'─'.repeat(100)}`);
  console.log(`📦 ${product.style_id} | ${product.brand} | ${product.title}`);
  console.log(`   Size: ${variant.variant_value} | Variant ID: ${variant.stockx_variant_id.substring(0, 8)}...`);

  if (marketData) {
    console.log(`   💰 PRICING (${marketData.currency_code}):`);
    console.log(`      Lowest Ask:     £${marketData.lowest_ask || 'N/A'}`);
    console.log(`      Highest Bid:    £${marketData.highest_bid || 'N/A'}`);
    console.log(`      Flex Ask:       £${marketData.flex_lowest_ask || 'N/A'}`);
    console.log(`      Earn More:      £${marketData.earn_more || 'N/A'}`);
    console.log(`      Sell Faster:    £${marketData.sell_faster || 'N/A'}`);
    console.log(`      Updated:        ${marketData.updated_at?.substring(0, 19) || 'N/A'}`);
    console.log(`      Expires:        ${marketData.expires_at?.substring(0, 19) || 'N/A'}`);
  } else {
    console.log(`   ❌ NO MARKET DATA`);
  }

  // Get price history count for this variant
  const { count: historyCount } = await supabase
    .from('inventory_v4_stockx_price_history')
    .select('*', { count: 'exact', head: true })
    .eq('stockx_variant_id', variant.stockx_variant_id);

  console.log(`   📈 Price History: ${historyCount || 0} snapshot(s)`);
}

console.log(`\n${'='.repeat(100)}\n`);
console.log('✅ Verification complete!\n');
