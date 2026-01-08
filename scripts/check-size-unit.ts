#!/usr/bin/env node
import { createClient } from '@/lib/supabase/service';

async function check() {
  const supabase = createClient();

  // Check product size_unit
  const { data: product } = await supabase
    .from('inventory_v4_alias_products')
    .select('size_unit, allowed_sizes')
    .eq('alias_catalog_id', 'dunk-low-black-white-dd1391-100')
    .single();

  console.log('\nProduct size_unit:', product?.size_unit);
  console.log('Sample allowed sizes:', product?.allowed_sizes?.slice(0, 10));

  // Check variant size_unit
  const { data: variant } = await supabase
    .from('inventory_v4_alias_variants')
    .select('size_unit, size_display, size_value, region_id')
    .eq('alias_catalog_id', 'dunk-low-black-white-dd1391-100')
    .limit(5);

  console.log('\nSample variant records:');
  (variant || []).forEach(v => {
    const regionName = v.region_id === '3' ? 'UK region' : v.region_id === '2' ? 'EU region' : 'US region';
    console.log(`  ${regionName} | Size: ${v.size_display} | Unit: ${v.size_unit}`);
  });
}

check().catch(console.error);
