#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check if we have gender data for M2002RDB
  const { data } = await supabase
    .from('product_catalog')
    .select('sku, gender, brand, category')
    .eq('sku', 'M2002RDB')
    .single();

  console.log('M2002RDB Product Data:');
  console.log(JSON.stringify(data, null, 2));

  // Check a few more products to see gender distribution
  const { data: sample } = await supabase
    .from('product_catalog')
    .select('sku, gender, brand, category')
    .not('gender', 'is', null)
    .limit(10);

  console.log('\nSample of products with gender data:');
  sample?.forEach(p => {
    console.log(`  ${p.sku.padEnd(15)} | ${p.brand.padEnd(15)} | Gender: ${p.gender || 'NULL'}`);
  });

  // Check gender distribution
  const { data: all } = await supabase
    .from('product_catalog')
    .select('gender')
    .not('gender', 'is', null);

  const genderCounts = all?.reduce((acc, p) => {
    acc[p.gender] = (acc[p.gender] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nGender Distribution:');
  Object.entries(genderCounts || {}).forEach(([gender, count]) => {
    console.log(`  ${gender}: ${count}`);
  });
}

check();
