#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('🔍 VERIFYING V4 SYNC RESULTS\n');
  console.log('='.repeat(80));

  // Check product
  const { data: products } = await supabase
    .from('inventory_v4_stockx_products')
    .select('*')
    .eq('style_id', 'DD1391-100');

  console.log('\n✅ Products:', products?.length || 0);
  if (products?.[0]) {
    console.log('  -', products[0].title);
    console.log('  - Product ID:', products[0].stockx_product_id);
  }

  // Check variants
  if (products?.[0]) {
    const { data: variants } = await supabase
      .from('inventory_v4_stockx_variants')
      .select('*')
      .eq('stockx_product_id', products[0].stockx_product_id);

    console.log('\n✅ Variants:', variants?.length || 0);
    if (variants?.length) {
      console.log('  - Sizes:', variants.slice(0, 5).map(v => v.variant_value).join(', '), '...');
    }

    // Check market data
    const { data: marketData } = await supabase
      .from('inventory_v4_stockx_market_data')
      .select('stockx_variant_id, currency_code, lowest_ask, highest_bid, updated_at')
      .in('stockx_variant_id', variants?.map(v => v.stockx_variant_id) || []);

    console.log('\n✅ Market Data:', marketData?.length || 0);
    if (marketData?.length) {
      const sample = marketData[0];
      console.log('  - Sample:', {
        currency: sample.currency_code,
        lowestAsk: sample.lowest_ask,
        highestBid: sample.highest_bid,
        updated: sample.updated_at?.substring(0, 19)
      });
    }

    // Check price history
    const { data: history } = await supabase
      .from('inventory_v4_stockx_price_history')
      .select('*')
      .in('stockx_variant_id', variants?.map(v => v.stockx_variant_id) || []);

    console.log('\n✅ Price History:', history?.length || 0);
    if (history?.length) {
      console.log('  - Snapshots inserted successfully');
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Verification complete!\n');
}

verify();
