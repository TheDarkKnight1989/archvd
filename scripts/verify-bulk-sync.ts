#!/usr/bin/env node
import { createClient } from '@/lib/supabase/service';

async function verify() {
  const supabase = createClient();

  // Check total products
  const { count: productCount } = await supabase
    .from('inventory_v4_alias_products')
    .select('*', { count: 'exact', head: true });

  console.log('\n📦 Total Alias products:', productCount);

  // Get product details
  const { data: products } = await supabase
    .from('inventory_v4_alias_products')
    .select('alias_catalog_id, brand, name')
    .order('created_at', { ascending: false });

  console.log('\n📋 Products in database:');
  for (const p of products || []) {
    console.log(`  • ${p.brand} - ${p.name}`);
    console.log(`    catalog_id: ${p.alias_catalog_id}`);

    // Check variant count
    const { count: variantCount } = await supabase
      .from('inventory_v4_alias_variants')
      .select('*', { count: 'exact', head: true })
      .eq('alias_catalog_id', p.alias_catalog_id);

    console.log(`    variants: ${variantCount}`);

    // Check market data count
    const { data: variants } = await supabase
      .from('inventory_v4_alias_variants')
      .select('id')
      .eq('alias_catalog_id', p.alias_catalog_id)
      .limit(100);

    const variantIds = (variants || []).map(v => v.id);

    const { count: marketCount } = await supabase
      .from('inventory_v4_alias_market_data')
      .select('*', { count: 'exact', head: true })
      .in('alias_variant_id', variantIds);

    const { count: withPrices } = await supabase
      .from('inventory_v4_alias_market_data')
      .select('*', { count: 'exact', head: true })
      .in('alias_variant_id', variantIds)
      .not('lowest_ask', 'is', null);

    console.log(`    market data: ${marketCount} (${withPrices} with prices)\n`);
  }

  // Overall stats
  const { count: totalVariants } = await supabase
    .from('inventory_v4_alias_variants')
    .select('*', { count: 'exact', head: true });

  const { count: totalMarket } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('*', { count: 'exact', head: true });

  console.log('\n📊 Overall Statistics:');
  console.log(`  Total Products:    ${productCount}`);
  console.log(`  Total Variants:    ${totalVariants}`);
  console.log(`  Total Market Data: ${totalMarket}`);
}

verify().catch(console.error);
