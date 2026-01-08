import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function proveDuplicates() {
  console.log('=== 4) PROVE DUPLICATES EXIST ===\n');

  // Total row count
  const { count: totalRows, error: countError } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.log('Error getting total count:', countError.message);
    return;
  }
  console.log('Total rows in table: ' + totalRows);

  // Sample duplicates - get a few rows that we know have duplicates
  // We'll check by querying for rows with same natural key
  console.log('\nSampling for duplicate groups...\n');

  // Get a sample of rows to analyze
  const { data: sample, error: sampleError } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('alias_catalog_id, size_value, price, purchased_at')
    .limit(1000);

  if (sampleError || !sample) {
    console.log('Error sampling:', sampleError?.message);
    return;
  }

  // Count duplicates in sample
  const keyMap = new Map<string, number>();
  for (const row of sample) {
    const key = [row.alias_catalog_id, row.size_value, row.price, row.purchased_at].join('|');
    keyMap.set(key, (keyMap.get(key) || 0) + 1);
  }

  let dupGroups = 0;
  let extraRows = 0;
  for (const count of keyMap.values()) {
    if (count > 1) {
      dupGroups++;
      extraRows += count - 1;
    }
  }

  console.log('Sample analysis (first 1000 rows):');
  console.log('  Unique natural keys: ' + keyMap.size);
  console.log('  Duplicate groups: ' + dupGroups);
  console.log('  Extra rows in sample: ' + extraRows);

  // Estimate for full table
  if (totalRows && keyMap.size > 0) {
    const dupRate = extraRows / sample.length;
    const estimatedExtraRows = Math.round(totalRows * dupRate);
    const estimatedUniqueRows = totalRows - estimatedExtraRows;

    console.log('\nEstimate for full table (' + totalRows + ' rows):');
    console.log('  Duplicate rate: ' + (dupRate * 100).toFixed(1) + '%');
    console.log('  Estimated extra rows: ~' + estimatedExtraRows.toLocaleString());
    console.log('  Estimated unique rows: ~' + estimatedUniqueRows.toLocaleString());
  }

  // Show specific duplicate example
  console.log('\n=== SPECIFIC DUPLICATE EXAMPLE ===\n');

  // Find a key with duplicates
  let exampleKey: string | null = null;
  for (const [key, count] of keyMap.entries()) {
    if (count > 1) {
      exampleKey = key;
      break;
    }
  }

  if (exampleKey) {
    const [catalogId, sizeValue, price, purchasedAt] = exampleKey.split('|');
    console.log('Natural key: ' + exampleKey);

    const { data: dupes, error: dupeError } = await supabase
      .from('inventory_v4_alias_sales_history')
      .select('id, alias_catalog_id, size_value, price, purchased_at, region_id, recorded_at')
      .eq('alias_catalog_id', catalogId)
      .eq('size_value', parseFloat(sizeValue))
      .eq('price', parseFloat(price))
      .eq('purchased_at', purchasedAt);

    if (dupeError) {
      console.log('Error fetching duplicates:', dupeError.message);
    } else if (dupes) {
      console.log('Found ' + dupes.length + ' copies of this sale:\n');
      for (const d of dupes) {
        console.log('  id=' + d.id + ', region=' + d.region_id + ', recorded=' + d.recorded_at);
      }
    }
  }
}

proveDuplicates().catch(console.error);
