import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function proveDuplicatesFull() {
  console.log('=== 4) COMPREHENSIVE DUPLICATE ANALYSIS ===\n');

  // Total row count
  const { count: totalRows } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('*', { count: 'exact', head: true });

  console.log('Total rows: ' + totalRows);

  // Sample larger batches from different dates
  const dates = [
    { start: '2025-12-15T00:00:00Z', end: '2025-12-15T12:00:00Z', label: 'Dec 15 AM' },
    { start: '2025-12-15T12:00:00Z', end: '2025-12-16T00:00:00Z', label: 'Dec 15 PM' },
    { start: '2025-12-16T00:00:00Z', end: '2025-12-16T12:00:00Z', label: 'Dec 16 AM' },
    { start: '2025-12-16T12:00:00Z', end: '2025-12-17T00:00:00Z', label: 'Dec 16 PM' },
  ];

  let totalSampled = 0;
  let totalDupGroups = 0;
  let totalExtraRows = 0;

  for (const period of dates) {
    const { data: sample, count } = await supabase
      .from('inventory_v4_alias_sales_history')
      .select('alias_catalog_id, size_value, price, purchased_at', { count: 'exact' })
      .gte('recorded_at', period.start)
      .lt('recorded_at', period.end)
      .limit(5000);

    if (!sample) continue;

    const keyMap = new Map<string, number>();
    for (const row of sample) {
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

    const rate = sample.length > 0 ? ((extraRows / sample.length) * 100).toFixed(1) : '0';
    console.log(period.label + ': ' + sample.length + ' sampled (of ' + count + '), ' + dupGroups + ' dup groups, ' + extraRows + ' extra (' + rate + '%)');

    totalSampled += sample.length;
    totalDupGroups += dupGroups;
    totalExtraRows += extraRows;
  }

  console.log('\n--- AGGREGATE ---');
  console.log('Total sampled: ' + totalSampled);
  console.log('Duplicate groups found: ' + totalDupGroups);
  console.log('Extra rows in sample: ' + totalExtraRows);

  if (totalRows && totalSampled > 0) {
    const overallDupRate = totalExtraRows / totalSampled;
    const estimatedExtraRows = Math.round(totalRows * overallDupRate);
    const estimatedUniqueRows = totalRows - estimatedExtraRows;

    console.log('\n--- ESTIMATE FOR FULL TABLE ---');
    console.log('Duplicate rate: ' + (overallDupRate * 100).toFixed(1) + '%');
    console.log('Estimated extra rows: ~' + estimatedExtraRows.toLocaleString());
    console.log('Estimated unique rows: ~' + estimatedUniqueRows.toLocaleString());
    console.log('Space reclaim potential: ~' + (estimatedExtraRows / totalRows * 100).toFixed(1) + '%');
  }
}

proveDuplicatesFull().catch(console.error);
