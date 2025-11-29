#!/usr/bin/env node
/**
 * Test the recent_sales endpoint to see monthly sales per size
 * This is how the Price Comparison tool gets "Monthly sales" data
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

// Use the product from the screenshot
const catalogId = 'asics-gel-1130-black-pure-silver-cv8481-101'; // ASICS Gel-1130
const testSizes = [6, 7, 8, 9, 10]; // Test a few sizes

console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║              TESTING RECENT SALES ENDPOINT                                 ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝');

console.log(`\n📦 Product: ASICS Gel-1130 Black Pure Silver`);
console.log(`🔍 Catalog ID: ${catalogId}`);

/**
 * Get recent sales for a specific size
 */
async function getRecentSales(catalogId, size, regionId = 2) {
  try {
    const params = new URLSearchParams({
      catalog_id: catalogId,
      size: size.toString(),
      product_condition: '1', // NEW
      packaging_condition: '1', // GOOD_CONDITION
      region_id: regionId.toString(),
      limit: '200', // Max limit to get all sales
    });

    const url = `${baseUrl}/pricing_insights/recent_sales?${params}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: response.statusText };
    }

    const data = await response.json();

    return {
      success: true,
      sales: data.recent_sales || [],
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Calculate monthly sales from sales history
 */
function calculateMonthlySales(sales) {
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const monthlySales = sales.filter(sale => {
    const saleDate = new Date(sale.purchased_at);
    return saleDate >= oneMonthAgo;
  });

  return monthlySales.length;
}

// Test the endpoint for all sizes
console.log('\n' + '═'.repeat(80));
console.log('RECENT SALES BY SIZE (Last 30 Days)');
console.log('═'.repeat(80));

console.log('\n' + '-'.repeat(80));
console.log(
  'Size'.padEnd(10) +
  'Total Sales'.padEnd(15) +
  'Monthly Sales'.padEnd(18) +
  'Avg Price'.padEnd(15) +
  'Latest Sale'
);
console.log('-'.repeat(80));

for (const size of testSizes) {
  process.stdout.write(`\nFetching size ${size}... `);

  const result = await getRecentSales(catalogId, size, 2); // EU region

  if (result.success) {
    const sales = result.sales;
    const monthlySales = calculateMonthlySales(sales);

    if (sales.length > 0) {
      // Calculate average price
      const avgPrice =
        sales.reduce((sum, sale) => sum + parseInt(sale.price_cents || 0), 0) /
        sales.length /
        100;

      // Get latest sale date
      const latestSale = sales[0]?.purchased_at
        ? new Date(sales[0].purchased_at).toLocaleDateString()
        : 'N/A';

      console.log('✓');
      console.log(
        size.toString().padEnd(10) +
        sales.length.toString().padEnd(15) +
        monthlySales.toString().padEnd(18) +
        `$${avgPrice.toFixed(2)}`.padEnd(15) +
        latestSale
      );
    } else {
      console.log('⚠️  No sales data');
    }
  } else {
    console.log(`❌ ${result.error}`);
  }
}

console.log('-'.repeat(80));

// Show detailed breakdown for one size
console.log('\n\n' + '═'.repeat(80));
console.log('DETAILED SALES BREAKDOWN - Size 9');
console.log('═'.repeat(80));

const detailedResult = await getRecentSales(catalogId, 9, 2);

if (detailedResult.success && detailedResult.sales.length > 0) {
  console.log(`\n📊 Found ${detailedResult.sales.length} total sales`);

  // Show last 10 sales
  console.log('\n📅 Last 10 Sales:');
  console.log('-'.repeat(80));
  console.log('Date'.padEnd(25) + 'Price'.padEnd(15) + 'Days Ago');
  console.log('-'.repeat(80));

  const now = Date.now();
  detailedResult.sales.slice(0, 10).forEach(sale => {
    const date = new Date(sale.purchased_at);
    const daysAgo = Math.floor((now - date.getTime()) / (1000 * 60 * 60 * 24));
    const price = `$${(parseInt(sale.price_cents) / 100).toFixed(2)}`;

    console.log(
      date.toLocaleString().padEnd(25) +
      price.padEnd(15) +
      `${daysAgo} days`
    );
  });

  // Calculate sales by time period
  const now2 = new Date();
  const periods = {
    '24h': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
  };

  console.log('\n\n📈 Sales by Time Period:');
  console.log('-'.repeat(40));

  for (const [period, days] of Object.entries(periods)) {
    const cutoff = new Date(now2.getTime() - days * 24 * 60 * 60 * 1000);
    const count = detailedResult.sales.filter(
      sale => new Date(sale.purchased_at) >= cutoff
    ).length;

    console.log(`${period.padEnd(10)} ${count} sales`);
  }
} else {
  console.log('⚠️  No sales data for size 9');
}

console.log('\n\n' + '═'.repeat(80));
console.log('HOW THE TOOL CALCULATES MONTHLY SALES');
console.log('═'.repeat(80));

console.log('\n1. Calls: GET /pricing_insights/recent_sales');
console.log('   - Parameters: catalog_id, size, product_condition, packaging_condition');
console.log('   - limit=200 to get maximum sales history');
console.log('   - region_id=2 for EU market');

console.log('\n2. Filters sales by date:');
console.log('   - Get current date');
console.log('   - Calculate date 30 days ago');
console.log('   - Count sales where purchased_at >= 30 days ago');

console.log('\n3. Displays count as "Monthly sales" column');

console.log('\n💡 This is exactly what the Price Comparison tool is doing!');

console.log('\n' + '═'.repeat(80) + '\n');
