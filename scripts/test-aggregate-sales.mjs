#!/usr/bin/env node
/**
 * Test aggregate sales (all sizes combined)
 * This is how the tool gets Day/Week/Month/Total stats
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

const catalogId = 'air-jordan-1-retro-high-og-dz5485-612';

console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║         TESTING AGGREGATE SALES (ALL SIZES COMBINED)                      ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝');

console.log(`\n📦 Product: Air Jordan 1 Chicago`);
console.log(`🔍 Catalog ID: ${catalogId}`);

/**
 * Get sales WITHOUT specifying size = gets ALL sizes
 */
async function getAggregateSales(catalogId, regionId = 2) {
  try {
    const params = new URLSearchParams({
      catalog_id: catalogId,
      product_condition: '1',
      packaging_condition: '1',
      region_id: regionId.toString(),
      limit: '200', // Max limit
      consigned: 'false', // Must specify when getting aggregate
    });

    const url = `${baseUrl}/pricing_insights/recent_sales?${params}`;
    console.log(`\n🔗 Request URL:`);
    console.log(`   ${url.substring(0, 120)}...`);
    console.log(`\n📝 Key: NO size parameter = returns ALL sizes combined!`);

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
 * Calculate sales by time period (like the tool does)
 */
function calculateSalesByPeriod(sales) {
  const now = Date.now();
  const periods = {
    day: 1 * 24 * 60 * 60 * 1000,      // 24 hours
    week: 7 * 24 * 60 * 60 * 1000,     // 7 days
    month: 30 * 24 * 60 * 60 * 1000,   // 30 days
  };

  const stats = {
    day: 0,
    week: 0,
    month: 0,
    total: sales.length,
  };

  sales.forEach(sale => {
    const saleTime = new Date(sale.purchased_at).getTime();
    const age = now - saleTime;

    if (age <= periods.day) stats.day++;
    if (age <= periods.week) stats.week++;
    if (age <= periods.month) stats.month++;
  });

  return stats;
}

// Get aggregate sales
const data = await getAggregateSales(catalogId);

if (data && data.recent_sales) {
  const sales = data.recent_sales;

  console.log(`\n✅ Retrieved ${sales.length} sales records (limit: 200)`);

  // Calculate stats like the tool does
  const stats = calculateSalesByPeriod(sales);

  console.log(`\n\n${'═'.repeat(80)}`);
  console.log('AGGREGATE SALES STATS (Like top-left of screenshot)');
  console.log('═'.repeat(80));

  console.log(`\n┌─────────────────────────────────────┐`);
  console.log(`│  Day     ${stats.day.toString().padStart(6)}                  │`);
  console.log(`│  Week    ${stats.week.toString().padStart(6)}                  │`);
  console.log(`│  Month   ${stats.month.toString().padStart(6)}                  │`);
  console.log(`│  Total   ${stats.total.toString().padStart(6)}  (limited)      │`);
  console.log(`└─────────────────────────────────────┘`);

  console.log(`\n⚠️  Note: "Total" is capped at 200 due to API limit`);
  console.log(`    The real total is likely much higher!`);

  // Show size breakdown from the sales
  console.log(`\n\n${'═'.repeat(80)}`);
  console.log('SIZE BREAKDOWN (from aggregate data)');
  console.log('═'.repeat(80));

  const sizeCount = {};
  sales.forEach(sale => {
    const size = sale.size;
    sizeCount[size] = (sizeCount[size] || 0) + 1;
  });

  const sortedSizes = Object.entries(sizeCount)
    .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
    .slice(0, 15); // Show first 15 sizes

  console.log(`\n📊 Top 15 sizes (from ${sales.length} sales):\n`);
  console.log('-'.repeat(40));
  console.log('Size'.padEnd(15) + 'Sales Count');
  console.log('-'.repeat(40));

  sortedSizes.forEach(([size, count]) => {
    const bar = '█'.repeat(Math.min(count, 50));
    console.log(`${size.padEnd(15)}${count.toString().padEnd(5)} ${bar}`);
  });

  console.log('-'.repeat(40));

  // Show recent sales with different sizes
  console.log(`\n\n${'═'.repeat(80)}`);
  console.log('RECENT SALES (showing different sizes)');
  console.log('═'.repeat(80));

  console.log(`\n📅 Last 10 sales across all sizes:\n`);
  console.log('-'.repeat(70));
  console.log('Date'.padEnd(25) + 'Size'.padEnd(10) + 'Price'.padEnd(15) + 'Days Ago');
  console.log('-'.repeat(70));

  sales.slice(0, 10).forEach(sale => {
    const date = new Date(sale.purchased_at);
    const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    const price = `$${(parseInt(sale.price_cents) / 100).toFixed(2)}`;

    console.log(
      date.toLocaleString().substring(0, 24).padEnd(25) +
      sale.size.toString().padEnd(10) +
      price.padEnd(15) +
      `${daysAgo}d`
    );
  });

  console.log('-'.repeat(70));
}

console.log(`\n\n${'═'.repeat(80)}`);
console.log('HOW THE TOOL GETS THOSE TOP-LEFT STATS');
console.log('═'.repeat(80));

console.log(`\n1. Call /recent_sales WITHOUT size parameter:`);
console.log(`   GET /pricing_insights/recent_sales?catalog_id=xxx&limit=200&...`);
console.log(`   ⚠️  NO "size" parameter = returns ALL sizes combined`);

console.log(`\n2. Get up to 200 sales across all sizes`);

console.log(`\n3. Filter by time period:`);
console.log(`   - Day   = sales in last 24 hours`);
console.log(`   - Week  = sales in last 7 days`);
console.log(`   - Month = sales in last 30 days`);
console.log(`   - Total = all sales returned (capped at 200 by API)`);

console.log(`\n4. Display in top-left corner`);

console.log(`\n💡 The tool likely also caches or polls this data regularly`);
console.log(`   to track true total sales over time (beyond 200 limit)`);

console.log(`\n${'═'.repeat(80)}\n`);
