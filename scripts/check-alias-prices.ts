#!/usr/bin/env node
import { createClient as createServiceClient } from '@/lib/supabase/service';

async function check() {
  const supabase = createServiceClient();

  // Count variants with prices
  const { data: withPrices } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('alias_variant_id, lowest_ask, highest_bid')
    .not('lowest_ask', 'is', null)
    .limit(10);

  console.log(`\n💰 Variants with prices: ${withPrices?.length || 0}`);
  if (withPrices && withPrices.length > 0) {
    for (const m of withPrices) {
      // Get variant details
      const { data: variant } = await supabase
        .from('inventory_v4_alias_variants')
        .select('size_display, region_id, consigned')
        .eq('id', m.alias_variant_id)
        .single();

      if (variant) {
        const regionName = variant.region_id === '3' ? 'UK' : variant.region_id === '2' ? 'EU' : 'US';
        console.log(`  ${regionName} | Size ${variant.size_display} | consigned=${variant.consigned} → ask=$${m.lowest_ask}, bid=$${m.highest_bid}`);
      }
    }
  }

  // Count NULL prices
  const { count: nullCount } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('*', { count: 'exact', head: true })
    .is('lowest_ask', null);

  console.log(`\n❌ Variants with NULL prices: ${nullCount || 0}/246`);

  // Check region distribution
  const { data: regionStats } = await supabase
    .from('inventory_v4_alias_variants')
    .select('region_id')
    .eq('alias_catalog_id', 'dunk-low-black-white-dd1391-100');

  const grouped = (regionStats || []).reduce((acc, v) => {
    acc[v.region_id] = (acc[v.region_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`\n📊 Variant distribution:`);
  Object.entries(grouped).forEach(([region, count]) => {
    const regionName = region === '3' ? 'UK' : region === '2' ? 'EU' : 'US';
    console.log(`  ${regionName} (${region}): ${count}`);
  });
}

check().catch(console.error);
