import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function proveDuplicates() {
  console.log('=== 4) PROVE DUPLICATES EXIST (V2 - Multi-period sampling) ===\n');

  // Total row count
  const { count: totalRows, error: countError } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.log('Error getting total count:', countError.message);
    return;
  }
  console.log('Total rows in table: ' + totalRows);

  // Sample from Dec 15 (when bulk import happened)
  console.log('\n--- Sampling from Dec 15-16 (bulk import period) ---\n');

  const { data: sample15, error: sample15Error } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('alias_catalog_id, size_value, price, purchased_at, recorded_at')
    .gte('recorded_at', '2025-12-15T00:00:00Z')
    .lt('recorded_at', '2025-12-16T00:00:00Z')
    .limit(2000);

  if (sample15Error || !sample15) {
    console.log('Error sampling Dec 15:', sample15Error?.message);
    return;
  }

  console.log('Rows sampled from Dec 15: ' + sample15.length);

  // Count duplicates
  const keyMap = new Map<string, number>();
  for (const row of sample15) {
    const key = [row.alias_catalog_id, row.size_value, row.price, row.purchased_at].join('|');
    keyMap.set(key, (keyMap.get(key) || 0) + 1);
  }

  let dupGroups = 0;
  let extraRows = 0;
  let maxCopies = 0;
  for (const count of keyMap.values()) {
    if (count > 1) {
      dupGroups++;
      extraRows += count - 1;
      if (count > maxCopies) maxCopies = count;
    }
  }

  console.log('Unique natural keys: ' + keyMap.size);
  console.log('Duplicate groups: ' + dupGroups);
  console.log('Extra rows in sample: ' + extraRows);
  console.log('Max copies of single sale: ' + maxCopies);

  // Show specific duplicate example
  if (dupGroups > 0) {
    console.log('\n=== SPECIFIC DUPLICATE EXAMPLE ===\n');

    let exampleKey: string | null = null;
    for (const [key, count] of keyMap.entries()) {
      if (count > 1) {
        exampleKey = key;
        break;
      }
    }

    if (exampleKey) {
      const [catalogId, sizeValue, price, purchasedAt] = exampleKey.split('|');
      console.log('Natural key: ' + catalogId + ' | size ' + sizeValue + ' | $' + price + ' | ' + purchasedAt);

      const { data: dupes, error: dupeError } = await supabase
        .from('inventory_v4_alias_sales_history')
        .select('id, region_id, currency_code, consigned, recorded_at')
        .eq('alias_catalog_id', catalogId)
        .eq('size_value', parseFloat(sizeValue))
        .eq('price', parseFloat(price))
        .eq('purchased_at', purchasedAt);

      if (dupeError) {
        console.log('Error fetching duplicates:', dupeError.message);
      } else if (dupes) {
        console.log('Found ' + dupes.length + ' copies:\n');
        for (const d of dupes) {
          console.log('  id=' + d.id + ', region=' + d.region_id + ', currency=' + d.currency_code + ', consigned=' + d.consigned + ', recorded=' + d.recorded_at);
        }
      }
    }
  }

  // Check if there were multiple recorded_at batches on Dec 15
  console.log('\n=== RECORDED_AT DISTRIBUTION (Dec 15) ===\n');

  const recordedAtMap = new Map<string, number>();
  for (const row of sample15) {
    // Truncate to hour
    const hour = row.recorded_at.slice(0, 13);
    recordedAtMap.set(hour, (recordedAtMap.get(hour) || 0) + 1);
  }

  const sortedHours = [...recordedAtMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [hour, count] of sortedHours) {
    console.log('  ' + hour + ': ' + count + ' rows');
  }
}

proveDuplicates().catch(console.error);
