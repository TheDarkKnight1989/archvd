import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function finalDuplicateProof() {
  console.log('=== FINAL DUPLICATE PROOF ===\n');

  const { count: totalRows } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('*', { count: 'exact', head: true });

  console.log('Total rows: ' + totalRows);

  // Check multiple 10-minute windows throughout Dec 15-16
  const windows = [
    { start: '2025-12-15T00:00:00Z', end: '2025-12-15T00:10:00Z' },
    { start: '2025-12-15T06:00:00Z', end: '2025-12-15T06:10:00Z' },
    { start: '2025-12-15T12:00:00Z', end: '2025-12-15T12:10:00Z' },
    { start: '2025-12-15T16:00:00Z', end: '2025-12-15T16:10:00Z' },
    { start: '2025-12-15T18:00:00Z', end: '2025-12-15T18:10:00Z' },
    { start: '2025-12-16T00:00:00Z', end: '2025-12-16T00:10:00Z' },
    { start: '2025-12-16T06:00:00Z', end: '2025-12-16T06:10:00Z' },
    { start: '2025-12-16T12:00:00Z', end: '2025-12-16T12:10:00Z' },
  ];

  let totalSampled = 0;
  let totalUniqueKeys = 0;
  let totalDupGroups = 0;
  let totalExtraRows = 0;

  console.log('\nWindow-by-window analysis:\n');

  for (const window of windows) {
    const { data: rows } = await supabase
      .from('inventory_v4_alias_sales_history')
      .select('alias_catalog_id, size_value, price, purchased_at')
      .gte('recorded_at', window.start)
      .lt('recorded_at', window.end)
      .limit(5000);

    if (!rows || rows.length === 0) {
      console.log(window.start.slice(5, 16) + ': 0 rows');
      continue;
    }

    const keyMap = new Map<string, number>();
    for (const row of rows) {
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

    const rate = rows.length > 0 ? (extraRows / rows.length * 100).toFixed(1) : '0';
    console.log(window.start.slice(5, 16) + ': ' + rows.length + ' rows, ' + keyMap.size + ' unique, ' + dupGroups + ' dups, ' + extraRows + ' extra (' + rate + '%)');

    totalSampled += rows.length;
    totalUniqueKeys += keyMap.size;
    totalDupGroups += dupGroups;
    totalExtraRows += extraRows;
  }

  console.log('\n=== AGGREGATE RESULTS ===');
  console.log('Total sampled: ' + totalSampled);
  console.log('Unique natural keys: ' + totalUniqueKeys);
  console.log('Duplicate groups: ' + totalDupGroups);
  console.log('Extra rows: ' + totalExtraRows);

  if (totalSampled > 0 && totalRows) {
    const dupRate = totalExtraRows / totalSampled;
    const estimatedExtra = Math.round(totalRows * dupRate);

    console.log('\n=== EXTRAPOLATION TO FULL TABLE ===');
    console.log('Duplicate rate in sample: ' + (dupRate * 100).toFixed(2) + '%');
    console.log('Estimated extra rows: ~' + estimatedExtra.toLocaleString());
    console.log('Estimated unique rows: ~' + (totalRows - estimatedExtra).toLocaleString());
  }

  // Show one concrete example
  console.log('\n=== CONCRETE DUPLICATE EXAMPLE ===');

  const { data: example } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('id, alias_catalog_id, size_value, price, purchased_at, region_id, currency_code, consigned, recorded_at')
    .eq('alias_catalog_id', 'supreme-x-dunk-low-sb-ink-hq8487-500')
    .eq('size_value', 4)
    .eq('price', 219);

  if (example && example.length > 0) {
    console.log('\nProduct: supreme-x-dunk-low-sb-ink-hq8487-500, size 4, $219');
    console.log('Found ' + example.length + ' row(s) with this natural key:\n');
    for (const row of example) {
      console.log('  id=' + row.id);
      console.log('    purchased_at: ' + row.purchased_at);
      console.log('    region=' + row.region_id + ', currency=' + row.currency_code + ', consigned=' + row.consigned);
      console.log('    recorded_at: ' + row.recorded_at);
      console.log('');
    }
  }
}

finalDuplicateProof().catch(console.error);
