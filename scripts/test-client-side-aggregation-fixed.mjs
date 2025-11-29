#!/usr/bin/env node
import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

const catalogId = 'air-jordan-1-retro-high-og-dz5485-612';
const TEST_SIZES = [8, 8.5, 9, 9.5, 10, 10.5, 11]; // Test fewer sizes for speed

async function getSalesForSize(catalogId, size, regionId = 2) {
  try {
    const params = new URLSearchParams({
      catalog_id: catalogId,
      size: size.toString(),
      product_condition: '1',
      packaging_condition: '1',
      region_id: regionId.toString(),
      limit: '200',
    });

    const url = `${baseUrl}/pricing_insights/recent_sales?${params}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${ALIAS_PAT}` },
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.recent_sales || [];
  } catch (error) {
    return [];
  }
}

console.log('Testing client-side aggregation...\n');
console.log(`Product: Air Jordan 1 Chicago`);
console.log(`Testing ${TEST_SIZES.length} sizes\n`);

const allSales = [];
const perSizeStats = [];

for (const size of TEST_SIZES) {
  process.stdout.write(`Size ${size}... `);
  const sales = await getSalesForSize(catalogId, size);
  allSales.push(...sales);

  const now = Date.now();
  const monthlySales = sales.filter(
    sale => now - new Date(sale.purchased_at).getTime() <= 30 * 24 * 60 * 60 * 1000
  );

  perSizeStats.push({ size, totalSales: sales.length, monthlySales: monthlySales.length });
  console.log(`${sales.length} total, ${monthlySales.length} monthly`);
}

const now = Date.now();
const day = allSales.filter(s => now - new Date(s.purchased_at).getTime() <= 24 * 60 * 60 * 1000).length;
const week = allSales.filter(s => now - new Date(s.purchased_at).getTime() <= 7 * 24 * 60 * 60 * 1000).length;
const month = allSales.filter(s => now - new Date(s.purchased_at).getTime() <= 30 * 24 * 60 * 60 * 1000).length;

console.log('\n\nAGGREGATE STATS (Like top-left corner):');
console.log(`  Day:   ${day}`);
console.log(`  Week:  ${week}`);
console.log(`  Month: ${month}`);
console.log(`  Total: ${allSales.length}\n`);

console.log('PER-SIZE BREAKDOWN:');
perSizeStats.forEach(s => {
  console.log(`  Size ${s.size}: ${s.monthlySales} monthly sales`);
});

console.log('\n✅ This is how the tool gets both:');
console.log('   - Top-left stats (aggregate across all sizes)');
console.log('   - Monthly sales column (per-size breakdown)');
