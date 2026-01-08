#!/usr/bin/env node
import { createClient as createServiceClient } from '@/lib/supabase/service';

async function check() {
  const supabase = createServiceClient();

  // Count all market data
  const { count: totalMarket, error: e1 } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal market data rows: ${totalMarket || 0}`);
  if (e1) console.error('Error:', e1.message);

  // Count all variants
  const { count: totalVariants, error: e2 } = await supabase
    .from('inventory_v4_alias_variants')
    .select('*', { count: 'exact', head: true })
    .eq('alias_catalog_id', 'dunk-low-black-white-dd1391-100');

  console.log(`Total variants for DD1391-100: ${totalVariants || 0}`);
  if (e2) console.error('Error:', e2.message);

  // Get sample variant IDs
  const { data: sampleVariants } = await supabase
    .from('inventory_v4_alias_variants')
    .select('id, size_display, region_id, consigned')
    .eq('alias_catalog_id', 'dunk-low-black-white-dd1391-100')
    .limit(3);

  console.log(`\nSample variant IDs:`);
  (sampleVariants || []).forEach(v => {
    console.log(`  Size ${v.size_display} (region ${v.region_id}, consigned=${v.consigned}) → id=${v.id}`);
  });

  // Check if those variants have market data
  if (sampleVariants && sampleVariants.length > 0) {
    const variantIds = sampleVariants.map(v => v.id);
    const { data: marketForSample } = await supabase
      .from('inventory_v4_alias_market_data')
      .select('alias_variant_id, lowest_ask, highest_bid')
      .in('alias_variant_id', variantIds);

    console.log(`\nMarket data for sample variants: ${marketForSample?.length || 0}`);
    (marketForSample || []).forEach(m => {
      console.log(`  Variant ${m.alias_variant_id} → ask=$${m.lowest_ask}, bid=$${m.highest_bid}`);
    });
  }
}

check().catch(console.error);
