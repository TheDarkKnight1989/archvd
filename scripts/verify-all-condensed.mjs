#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get all products
const { data: products } = await supabase
  .from('inventory_v4_stockx_products')
  .select('*')
  .order('style_id');

const results = [];

for (const product of products || []) {
  // Get variants
  const { data: variants } = await supabase
    .from('inventory_v4_stockx_variants')
    .select('*')
    .eq('stockx_product_id', product.stockx_product_id)
    .order('variant_value');

  if (!variants?.length) continue;

  // Pick a size (prefer 9, 10, 9.5, 10.5, otherwise first)
  const preferredSizes = ['9', '10', '9.5', '10.5', '8.5', '11'];
  let variant = variants.find(v => preferredSizes.includes(v.variant_value)) || variants[0];

  // Get market data
  const { data: marketData } = await supabase
    .from('inventory_v4_stockx_market_data')
    .select('*')
    .eq('stockx_variant_id', variant.stockx_variant_id)
    .single();

  const ask = marketData?.lowest_ask ? `£${marketData.lowest_ask}` : 'N/A';
  const bid = marketData?.highest_bid ? `£${marketData.highest_bid}` : 'N/A';

  const bidText = bid !== 'N/A' ? `, ${bid} Bid` : '';

  results.push(`${product.title} (${product.style_id}) Size ${variant.variant_value}: ${ask} Ask${bidText}`);
}

// Print all results
results.forEach(r => console.log(r));
