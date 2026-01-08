import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findExactDuplicates() {
  console.log('=== EXACT DUPLICATE COUNT ===\n');

  // Get total rows
  const { count: totalRows } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('*', { count: 'exact', head: true });

  console.log('Total rows: ' + totalRows);

  // Get all rows for a specific product that we know has data
  // and check for duplicates within that product
  console.log('\n--- Testing with specific products ---\n');

  // Get list of products with their row counts
  const { data: productCounts } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('alias_catalog_id')
    .limit(100);

  if (!productCounts) {
    console.log('No products found');
    return;
  }

  // Get unique catalog IDs from sample
  const catalogIds = [...new Set(productCounts.map(p => p.alias_catalog_id))].slice(0, 5);

  for (const catalogId of catalogIds) {
    // Get all sales for this product
    const { data: sales, count } = await supabase
      .from('inventory_v4_alias_sales_history')
      .select('size_value, price, purchased_at, recorded_at', { count: 'exact' })
      .eq('alias_catalog_id', catalogId)
      .limit(5000);

    if (!sales) continue;

    // Check for duplicates
    const keyMap = new Map<string, string[]>();
    for (const row of sales) {
      const key = [row.size_value, row.price, row.purchased_at].join('|');
      if (!keyMap.has(key)) {
        keyMap.set(key, []);
      }
      keyMap.get(key)!.push(row.recorded_at);
    }

    let dupCount = 0;
    let extraCount = 0;
    for (const [key, recorded_ats] of keyMap.entries()) {
      if (recorded_ats.length > 1) {
        dupCount++;
        extraCount += recorded_ats.length - 1;
        if (dupCount <= 2) {
          console.log('  Duplicate in ' + catalogId.slice(0, 30) + '...');
          console.log('    Key: ' + key);
          console.log('    Recorded at: ' + recorded_ats.join(', '));
        }
      }
    }

    console.log(catalogId.slice(0, 40) + ': ' + count + ' rows, ' + keyMap.size + ' unique, ' + dupCount + ' dup groups, ' + extraCount + ' extra');
  }

  // Now try to find ANY duplicate across the table by checking recorded_at patterns
  console.log('\n--- Checking for multiple recorded_at within same minute ---\n');

  // Get rows that were recorded close together (potential duplicate batches)
  const { data: closeRows } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('alias_catalog_id, size_value, price, purchased_at, recorded_at')
    .gte('recorded_at', '2025-12-15T00:00:00Z')
    .lt('recorded_at', '2025-12-15T00:10:00Z')
    .limit(2000);

  if (closeRows) {
    const keyMap = new Map<string, number>();
    for (const row of closeRows) {
      const key = [row.alias_catalog_id, row.size_value, row.price, row.purchased_at].join('|');
      keyMap.set(key, (keyMap.get(key) || 0) + 1);
    }

    let dupGroups = 0;
    let extraRows = 0;
    for (const cnt of keyMap.values()) {
      if (cnt > 1) {
        dupGroups++;
        extraRows += cnt - 1;
      }
    }

    console.log('First 10 min of Dec 15: ' + closeRows.length + ' rows');
    console.log('Unique keys: ' + keyMap.size);
    console.log('Duplicate groups: ' + dupGroups);
    console.log('Extra rows: ' + extraRows);
  }
}

findExactDuplicates().catch(console.error);
