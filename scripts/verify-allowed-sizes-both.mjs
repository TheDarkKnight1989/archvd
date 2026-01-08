import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('VERIFYING: Platform-provided size lists');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ALIAS: Check allowed_sizes field
  console.log('ALIAS - allowed_sizes field:');
  console.log('─────────────────────────────────────────────────────────────────');

  const { data: aliasProducts } = await supabase
    .from('inventory_v4_alias_products')
    .select('alias_catalog_id, name, gender, allowed_sizes')
    .limit(5);

  aliasProducts.forEach(p => {
    const sizes = p.allowed_sizes?.map(s => s.value) || [];
    console.log('\n  ' + p.name + ' (' + p.gender + ')');
    console.log('    allowed_sizes: ' + sizes.length + ' sizes');
    console.log('    range: ' + (sizes.length ? Math.min(...sizes) + ' - ' + Math.max(...sizes) : 'N/A'));
  });

  // STOCKX: Check what determines valid sizes
  console.log('\n\nSTOCKX - Size source:');
  console.log('─────────────────────────────────────────────────────────────────');

  // StockX doesn't have allowed_sizes - the API just returns the variants that exist
  const { data: stockxProducts } = await supabase
    .from('inventory_v4_stockx_products')
    .select('stockx_product_id, title, gender')
    .limit(3);

  for (const p of stockxProducts) {
    const { data: variants } = await supabase
      .from('inventory_v4_stockx_variants')
      .select('variant_value')
      .eq('stockx_product_id', p.stockx_product_id);

    const sizes = variants.map(v => parseFloat(v.variant_value)).filter(s => !isNaN(s)).sort((a,b) => a-b);
    console.log('\n  ' + p.title + ' (' + p.gender + ')');
    console.log('    variants returned: ' + sizes.length + ' sizes');
    console.log('    range: ' + sizes[0] + ' - ' + sizes[sizes.length-1]);
  }

  // THE KEY QUESTION: Is Alias syncing MORE than allowed_sizes?
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('KEY QUESTION: Is Alias syncing sizes OUTSIDE allowed_sizes?');
  console.log('═══════════════════════════════════════════════════════════════');

  const { data: testProduct } = await supabase
    .from('inventory_v4_alias_products')
    .select('alias_catalog_id, name, allowed_sizes')
    .eq('alias_catalog_id', 'dunk-low-black-white-dd1391-100')
    .single();

  if (testProduct) {
    const allowedSizes = new Set(testProduct.allowed_sizes?.map(s => s.value) || []);
    
    const { data: variants } = await supabase
      .from('inventory_v4_alias_variants')
      .select('size_value, region_id, consigned')
      .eq('alias_catalog_id', testProduct.alias_catalog_id);

    // Count variants by whether they're in allowed_sizes
    let inAllowed = 0;
    let outsideAllowed = 0;
    const outsideSizes = new Set();

    variants.forEach(v => {
      const size = parseFloat(v.size_value);
      if (allowedSizes.has(size)) {
        inAllowed++;
      } else {
        outsideAllowed++;
        outsideSizes.add(size);
      }
    });

    console.log('\n  Product: ' + testProduct.name);
    console.log('  allowed_sizes count: ' + allowedSizes.size);
    console.log('  allowed_sizes range: ' + Math.min(...allowedSizes) + ' - ' + Math.max(...allowedSizes));
    console.log('\n  Synced variants IN allowed_sizes: ' + inAllowed);
    console.log('  Synced variants OUTSIDE allowed_sizes: ' + outsideAllowed);
    
    if (outsideAllowed > 0) {
      const sorted = Array.from(outsideSizes).sort((a,b) => a-b);
      console.log('  Invalid sizes synced: ' + sorted.join(', '));
      console.log('\n  🔴 BUG CONFIRMED: We are syncing sizes the platform says are invalid!');
      
      // Calculate impact
      const totalVariants = variants.length;
      const validVariants = inAllowed;
      const reduction = ((outsideAllowed / totalVariants) * 100).toFixed(0);
      console.log('\n  IMPACT:');
      console.log('    Current: ' + totalVariants + ' variants');
      console.log('    If filtered to allowed_sizes: ' + validVariants + ' variants');
      console.log('    Reduction: ' + reduction + '%');
    }
  }

  // Extrapolate to full database
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('FULL DATABASE IMPACT (if we filter to allowed_sizes only)');
  console.log('═══════════════════════════════════════════════════════════════');

  // Sample multiple products
  const { data: sampleProducts } = await supabase
    .from('inventory_v4_alias_products')
    .select('alias_catalog_id, allowed_sizes')
    .limit(20);

  let totalValid = 0;
  let totalInvalid = 0;

  for (const p of sampleProducts) {
    const allowedSizes = new Set(p.allowed_sizes?.map(s => s.value) || []);
    if (allowedSizes.size === 0) continue;

    const { data: variants } = await supabase
      .from('inventory_v4_alias_variants')
      .select('size_value')
      .eq('alias_catalog_id', p.alias_catalog_id);

    variants.forEach(v => {
      const size = parseFloat(v.size_value);
      if (allowedSizes.has(size)) {
        totalValid++;
      } else {
        totalInvalid++;
      }
    });
  }

  const totalSampled = totalValid + totalInvalid;
  const invalidPct = ((totalInvalid / totalSampled) * 100).toFixed(0);

  console.log('\n  Sampled ' + sampleProducts.length + ' products:');
  console.log('    Valid variants (in allowed_sizes): ' + totalValid);
  console.log('    Invalid variants (outside allowed_sizes): ' + totalInvalid);
  console.log('    Invalid percentage: ' + invalidPct + '%');

  const { count: totalAliasVariants } = await supabase
    .from('inventory_v4_alias_variants')
    .select('*', { count: 'exact', head: true });

  const estimatedSavings = Math.round(totalAliasVariants * (totalInvalid / totalSampled));
  console.log('\n  ESTIMATED SAVINGS:');
  console.log('    Current total: ' + totalAliasVariants.toLocaleString() + ' variants');
  console.log('    Invalid (est): ' + estimatedSavings.toLocaleString() + ' variants');
  console.log('    After cleanup: ~' + (totalAliasVariants - estimatedSavings).toLocaleString() + ' variants');
}

verify().catch(console.error);
