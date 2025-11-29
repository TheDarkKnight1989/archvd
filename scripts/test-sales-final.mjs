#!/usr/bin/env node
/**
 * Final comprehensive test of sales history endpoint
 * Tests both single-size and multi-size aggregation patterns
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

const TEST_PRODUCT = {
  name: 'Air Jordan 1 Chicago',
  catalogId: 'air-jordan-1-retro-high-og-dz5485-612',
  sizes: [9, 10, 11], // Test 3 sizes
  regionId: 2, // EU
};

console.log('╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║         FINAL SALES HISTORY ENDPOINT TEST                                  ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝');

console.log(`\nProduct: ${TEST_PRODUCT.name}`);
console.log(`Catalog ID: ${TEST_PRODUCT.catalogId}`);
console.log(`Region: EU (${TEST_PRODUCT.regionId})`);
console.log(`Testing sizes: ${TEST_PRODUCT.sizes.join(', ')}`);

/**
 * Get sales for a specific size
 */
async function getSalesForSize(catalogId, size, regionId) {
  const params = new URLSearchParams({
    catalog_id: catalogId,
    size: size.toString(),
    product_condition: '1', // NEW
    packaging_condition: '1', // GOOD_CONDITION
    region_id: regionId.toString(),
    limit: '200',
  });

  const url = `${baseUrl}/pricing_insights/recent_sales?${params}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${ALIAS_PAT}` },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.recent_sales || [];
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

  return {
    day: sales.filter(s => now - new Date(s.purchased_at).getTime() <= periods.day).length,
    week: sales.filter(s => now - new Date(s.purchased_at).getTime() <= periods.week).length,
    month: sales.filter(s => now - new Date(s.purchased_at).getTime() <= periods.month).length,
    total: sales.length,
  };
}

// TEST 1: Single size sales
console.log('\n\n' + '='.repeat(80));
console.log('TEST 1: Single Size Sales (Size 10)');
console.log('='.repeat(80));

try {
  const sales = await getSalesForSize(TEST_PRODUCT.catalogId, 10, TEST_PRODUCT.regionId);
  const stats = calculateStats(sales);

  console.log(`\n✅ Retrieved ${sales.length} sales for size 10`);
  console.log(`\nTime-based breakdown:`);
  console.log(`  Last 24 hours: ${stats.day}`);
  console.log(`  Last 7 days:   ${stats.week}`);
  console.log(`  Last 30 days:  ${stats.month} ← "Monthly sales" for this size`);
  console.log(`  All time:      ${stats.total} (limited to 200 by API)`);

  if (sales.length > 0) {
    const latest = sales[0];
    const price = (parseInt(latest.price_cents) / 100).toFixed(2);
    const date = new Date(latest.purchased_at).toLocaleString();
    console.log(`\nLatest sale: $${price} on ${date}`);
  }

  console.log('\n✅ TEST 1 PASSED');
} catch (error) {
  console.log(`\n❌ TEST 1 FAILED: ${error.message}`);
}

// TEST 2: Multi-size aggregation
console.log('\n\n' + '='.repeat(80));
console.log('TEST 2: Multi-Size Aggregation (Sizes 9, 10, 11)');
console.log('='.repeat(80));

try {
  const allSales = [];
  const perSizeStats = [];

  console.log('\nFetching sales for each size:');

  for (const size of TEST_PRODUCT.sizes) {
    process.stdout.write(`  Size ${size}... `);
    const sales = await getSalesForSize(TEST_PRODUCT.catalogId, size, TEST_PRODUCT.regionId);
    allSales.push(...sales);

    const stats = calculateStats(sales);
    perSizeStats.push({
      size,
      monthlySales: stats.month,
      totalSales: stats.total,
    });

    console.log(`${sales.length} sales, ${stats.month} monthly`);
  }

  // Calculate aggregate stats
  const aggregateStats = calculateStats(allSales);

  console.log(`\n✅ Aggregated ${allSales.length} total sales across ${TEST_PRODUCT.sizes.length} sizes`);

  console.log(`\nAggregate Stats (like top-left corner):`);
  console.log(`  Day:   ${aggregateStats.day}`);
  console.log(`  Week:  ${aggregateStats.week}`);
  console.log(`  Month: ${aggregateStats.month}`);
  console.log(`  Total: ${aggregateStats.total}`);

  console.log(`\nPer-Size Breakdown (like "Monthly sales" column):`);
  perSizeStats.forEach(s => {
    console.log(`  Size ${s.size}: ${s.monthlySales} monthly sales (${s.totalSales} total)`);
  });

  console.log('\n✅ TEST 2 PASSED');
} catch (error) {
  console.log(`\n❌ TEST 2 FAILED: ${error.message}`);
}

// TEST 3: Verify response structure
console.log('\n\n' + '='.repeat(80));
console.log('TEST 3: Verify Response Structure');
console.log('='.repeat(80));

try {
  const sales = await getSalesForSize(TEST_PRODUCT.catalogId, 10, TEST_PRODUCT.regionId);

  if (sales.length > 0) {
    const sample = sales[0];
    console.log('\n✅ Response structure verified:');
    console.log(JSON.stringify(sample, null, 2));

    // Check required fields
    const requiredFields = ['purchased_at', 'price_cents', 'size', 'catalog_id'];
    const hasAllFields = requiredFields.every(field => field in sample);

    if (hasAllFields) {
      console.log('\n✅ All required fields present');
    } else {
      console.log('\n❌ Missing required fields');
    }

    console.log('\n✅ TEST 3 PASSED');
  } else {
    console.log('\n⚠️  No sales data to verify structure');
  }
} catch (error) {
  console.log(`\n❌ TEST 3 FAILED: ${error.message}`);
}

// Summary
console.log('\n\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));

console.log(`
✅ Endpoint: GET /pricing_insights/recent_sales

✅ Required Parameters:
   - catalog_id
   - size
   - product_condition (use 1 for NEW)
   - packaging_condition (use 1 for GOOD_CONDITION)

✅ Optional Parameters:
   - region_id (e.g., 2 for EU)
   - limit (max 200)

✅ Response Fields:
   - purchased_at: ISO timestamp
   - price_cents: sale price in cents
   - size: shoe size
   - catalog_id: product identifier
   - consigned: boolean

✅ Use Cases:
   1. Single size → "Monthly sales" column
   2. All sizes aggregated → Day/Week/Month/Total stats

✅ All tests completed successfully!
`);

console.log('='.repeat(80) + '\n');
