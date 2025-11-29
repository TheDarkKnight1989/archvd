#!/usr/bin/env node
/**
 * Test theory: Tool calls API for each size and aggregates client-side
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

const catalogId = 'air-jordan-1-retro-high-og-dz5485-612';
const TEST_SIZES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12]; // Common sizes

console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║        CLIENT-SIDE AGGREGATION (Call each size, sum results)              ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝');

console.log(`\n📦 Product: Air Jordan 1 Chicago`);
console.log(`📏 Testing ${TEST_SIZES.length} sizes`);

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

function calculatePeriodStats(allSales) {
  const now = Date.now();
  const periods = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  };

  const stats = {
    day: 0,
    week: 0,
    month: 0,
    total: allSales.length,
  };

  allSales.forEach(sale => {
    const age = now - new Date(sale.purchased_at).getTime();
    if (age <= periods.day) stats.day++;
    if (age <= periods.week) stats.week++;
    if (age <= periods.month) stats.month++;
  });

  return stats;
}

console.log(`\n${'═'.repeat(80)`);
console.log('FETCHING SALES FOR EACH SIZE...');
console.log('═'.repeat(80)\n`);

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

  perSizeStats.push({
    size,
    totalSales: sales.length,
    monthlySales: monthlySales.length,
  });

  console.log(`${sales.length} total, ${monthlySales.length} monthly`);
}

// Calculate aggregate stats
const aggregateStats = calculatePeriodStats(allSales);

console.log(`\n\n${'═'.repeat(80)`);
console.log('📊 AGGREGATE STATS (TOP-LEFT CORNER)');
console.log('═'.repeat(80)`);

console.log(`\n┌────────────────────────────────────────┐`);
console.log(`│                                        │`);
console.log(`│  Day       ${aggregateStats.day.toString().padStart(6)}                     │`);
console.log(`│  Week      ${aggregateStats.week.toString().padStart(6)}                     │`);
console.log(`│  Month     ${aggregateStats.month.toString().padStart(6)}                     │`);
console.log(`│  Total     ${aggregateStats.total.toString().padStart(6)}                     │`);
console.log(`│                                        │`);
console.log(`└────────────────────────────────────────┘`);

console.log(`\n⚠️  Note: Total is aggregate of ${TEST_SIZES.length} sizes × 200 limit`);
console.log(`   Real total could be higher if any size has >200 sales`);

// Show per-size breakdown
console.log(`\n\n${'═'.repeat(80)`);
console.log('PER-SIZE BREAKDOWN (MONTHLY SALES COLUMN)');
console.log('═'.repeat(80)\n`);

console.log('-'.repeat(50));
console.log('Size'.padEnd(15) + 'Total Sales'.padEnd(20) + 'Monthly Sales');
console.log('-'.repeat(50));

perSizeStats.forEach(stat => {
  console.log(
    stat.size.toString().padEnd(15) +
    stat.totalSales.toString().padEnd(20) +
    stat.monthlySales.toString()
  );
});

console.log('-'.repeat(50));

console.log(`\n\n${'═'.repeat(80)`);
console.log('CONCLUSION');
console.log('═'.repeat(80)\n`);

console.log('✅ The tool likely does this:');
console.log('');
console.log('1. Make parallel API calls for each size:');
console.log('   GET /recent_sales?catalog_id=xxx&size=6&...');
console.log('   GET /recent_sales?catalog_id=xxx&size=6.5&...');
console.log('   GET /recent_sales?catalog_id=xxx&size=7&...');
console.log('   ... etc for all sizes');
console.log('');
console.log('2. For each size response:');
console.log('   - Filter last 30 days → "Monthly sales" column');
console.log('');
console.log('3. Combine ALL sales from ALL sizes:');
console.log('   - Filter last 24h → "Day" stat');
console.log('   - Filter last 7d → "Week" stat');
console.log('   - Filter last 30d → "Month" stat');
console.log('   - Count all → "Total" stat');
console.log('');
console.log('💡 This explains both the per-size column AND the aggregate stats!');

console.log(`\n${'═'.repeat(80)\n`);
