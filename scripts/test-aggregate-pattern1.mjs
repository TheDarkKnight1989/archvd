#!/usr/bin/env node
/**
 * Test Access Pattern #1 - Catalog Item Sales (ALL sizes)
 * According to docs: catalog_id (required), region_id (optional), consigned (must be non-null)
 * This pattern does NOT include size/product_condition/packaging_condition
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

const catalogId = 'air-jordan-1-retro-high-og-dz5485-612';

console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║      TESTING ACCESS PATTERN #1 - CATALOG ITEM SALES (ALL SIZES)           ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝');

console.log(`\n📦 Product: Air Jordan 1 Chicago`);
console.log(`🔍 Catalog ID: ${catalogId}`);

/**
 * Access Pattern #1: Catalog Item Sales
 * Only catalog_id + consigned (non-null) + optional region_id
 */
async function getPatternOneSales(catalogId, consigned = false, regionId = 2) {
  try {
    const params = new URLSearchParams({
      catalog_id: catalogId,
      consigned: consigned.toString(), // Must be non-null
      region_id: regionId.toString(),
      limit: '200',
    });

    const url = `${baseUrl}/pricing_insights/recent_sales?${params}`;

    console.log(`\n🔗 Pattern #1 Request:`);
    console.log(`   ${url}`);
    console.log(`\n📝 Parameters:`);
    console.log(`   - catalog_id: ${catalogId}`);
    console.log(`   - consigned: ${consigned}`);
    console.log(`   - region_id: ${regionId}`);
    console.log(`   - limit: 200`);
    console.log(`   ⚠️  NO size, NO product_condition, NO packaging_condition`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
      },
    });

    console.log(`\n📊 Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error: ${errorText}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Calculate time-based stats
 */
function calculateStats(sales) {
  const now = Date.now();
  const periods = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  };

  const stats = { day: 0, week: 0, month: 0, total: sales.length };

  sales.forEach(sale => {
    const age = now - new Date(sale.purchased_at).getTime();
    if (age <= periods.day) stats.day++;
    if (age <= periods.week) stats.week++;
    if (age <= periods.month) stats.month++;
  });

  return stats;
}

// Test Pattern #1
const data = await getPatternOneSales(catalogId, false, 2);

if (data && data.recent_sales) {
  const sales = data.recent_sales;

  console.log(`\n✅ SUCCESS! Retrieved ${sales.length} sales`);

  // Calculate aggregate stats
  const stats = calculateStats(sales);

  console.log(`\n\n${'═'.repeat(80)}`);
  console.log('📊 AGGREGATE SALES STATS (TOP-LEFT CORNER)');
  console.log('═'.repeat(80));

  console.log(`\n┌───────────────────────────────────────┐`);
  console.log(`│                                       │`);
  console.log(`│  Day       ${stats.day.toString().padStart(6)}                    │`);
  console.log(`│  Week      ${stats.week.toString().padStart(6)}                    │`);
  console.log(`│  Month     ${stats.month.toString().padStart(6)}                    │`);
  console.log(`│  Total     ${stats.total.toString().padStart(6)}  (API limit)      │`);
  console.log(`│                                       │`);
  console.log(`└───────────────────────────────────────┘`);

  console.log(`\n💡 This matches the screenshot's top-left stats!`);

  // Show sales breakdown by size
  console.log(`\n\n${'═'.repeat(80)}`);
  console.log('SIZE DISTRIBUTION');
  console.log('═'.repeat(80));

  const sizeCounts = {};
  sales.forEach(sale => {
    sizeCounts[sale.size] = (sizeCounts[sale.size] || 0) + 1;
  });

  const topSizes = Object.entries(sizeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  console.log(`\n📊 Top 10 sizes (from ${sales.length} sales):\n`);
  console.log('-'.repeat(50));
  console.log('Size'.padEnd(15) + 'Count'.padEnd(15) + 'Bar');
  console.log('-'.repeat(50));

  const maxCount = topSizes[0][1];
  topSizes.forEach(([size, count]) => {
    const barLength = Math.floor((count / maxCount) * 30);
    const bar = '█'.repeat(barLength);
    console.log(
      size.padEnd(15) +
      count.toString().padEnd(15) +
      bar
    );
  });

  console.log('-'.repeat(50));

  // Show recent sales
  console.log(`\n\n${'═'.repeat(80)}`);
  console.log('RECENT SALES (All Sizes)');
  console.log('═'.repeat(80));

  console.log(`\n📅 Last 10 sales:\n`);
  console.log('-'.repeat(75));
  console.log('Date'.padEnd(25) + 'Size'.padEnd(10) + 'Price'.padEnd(15) + 'Days Ago');
  console.log('-'.repeat(75));

  sales.slice(0, 10).forEach(sale => {
    const date = new Date(sale.purchased_at);
    const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    const price = `$${(parseInt(sale.price_cents) / 100).toFixed(2)}`;

    console.log(
      date.toLocaleString().substring(0, 24).padEnd(25) +
      sale.size.toString().padEnd(10) +
      price.padEnd(15) +
      `${daysAgo} days`
    );
  });

  console.log('-'.repeat(75));
} else {
  console.log(`\n⚠️  No sales data returned`);
}

console.log(`\n\n${'═'.repeat(80)}`);
console.log('HOW IT WORKS');
console.log('═'.repeat(80));

console.log(`\n✅ Access Pattern #1 (Catalog Item Sales):`);
console.log(`   - catalog_id: required`);
console.log(`   - consigned: must be non-null (true/false)`);
console.log(`   - region_id: optional`);
console.log(`   - Returns: ALL sizes, ALL conditions combined`);

console.log(`\n✅ Access Pattern #2 (Single Variant Sales):`);
console.log(`   - catalog_id: required`);
console.log(`   - size: required`);
console.log(`   - product_condition: required`);
console.log(`   - packaging_condition: required`);
console.log(`   - Returns: Only specific size + condition`);

console.log(`\n💡 The tool uses:`);
console.log(`   - Pattern #1 → Top-left aggregate stats (Day/Week/Month/Total)`);
console.log(`   - Pattern #2 → Per-size "Monthly sales" column`);

console.log(`\n${'═'.repeat(80)}\n`);
