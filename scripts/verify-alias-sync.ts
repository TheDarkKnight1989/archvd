#!/usr/bin/env node
/**
 * Quick verification script for Alias V4 sync
 */

import { createClient as createServiceClient } from '@/lib/supabase/service';

const catalogId = process.argv[2] || 'dunk-low-black-white-dd1391-100';

async function verify() {
  const supabase = createServiceClient();

  console.log(`\n🔍 Verifying sync for: ${catalogId}\n`);

  // Check variants by region and consigned
  const { data: variantStats } = await supabase
    .from('inventory_v4_alias_variants')
    .select('region_id, consigned')
    .eq('alias_catalog_id', catalogId);

  const grouped = (variantStats || []).reduce((acc, v) => {
    const key = `${v.region_id}_${v.consigned}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📊 Variants by region + consigned:');
  Object.entries(grouped).forEach(([key, count]) => {
    const [region, consigned] = key.split('_');
    const regionName = region === '3' ? 'UK' : region === '2' ? 'EU' : 'US';
    console.log(`   ${regionName} (${region}) | consigned=${consigned}: ${count}`);
  });
  console.log(`   TOTAL: ${variantStats?.length || 0}\n`);

  // Check market data by region
  const { data: marketStats } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('alias_variant_id, lowest_ask')
    .in(
      'alias_variant_id',
      (variantStats || []).map((v: any) => v.id).filter(Boolean)
    );

  // Join with variants to get region
  const { data: variantsWithMarket } = await supabase
    .from('inventory_v4_alias_variants')
    .select('id, region_id')
    .eq('alias_catalog_id', catalogId);

  const variantRegionMap = new Map(
    (variantsWithMarket || []).map(v => [v.id, v.region_id])
  );

  const marketByRegion = (marketStats || []).reduce((acc, m) => {
    const region = variantRegionMap.get(m.alias_variant_id) || 'unknown';
    acc[region] = (acc[region] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('💰 Market data by region:');
  Object.entries(marketByRegion).forEach(([region, count]) => {
    const regionName = region === '3' ? 'UK' : region === '2' ? 'EU' : region === '1' ? 'US' : region;
    console.log(`   ${regionName} (${region}): ${count} with prices`);
  });
  console.log(`   TOTAL: ${marketStats?.length || 0}\n`);

  // Sample a few variants to see structure
  const { data: sampleVariants } = await supabase
    .from('inventory_v4_alias_variants')
    .select('id, size_value, size_display, consigned, region_id')
    .eq('alias_catalog_id', catalogId)
    .limit(5);

  console.log('🔬 Sample variants:');
  (sampleVariants || []).forEach(v => {
    const regionName = v.region_id === '3' ? 'UK' : v.region_id === '2' ? 'EU' : 'US';
    console.log(`   ${regionName} | Size ${v.size_display} | consigned=${v.consigned} | id=${v.id.substring(0, 8)}...`);
  });
  console.log('');
}

verify().catch(console.error);
