#!/usr/bin/env node
/**
 * Test recent_sales with a product we know has data
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

// Use products we know have active markets
const TEST_PRODUCTS = [
  {
    name: 'Air Jordan 1 Chicago',
    catalogId: 'air-jordan-1-retro-high-og-dz5485-612',
    size: 10,
  },
  {
    name: 'Nike Dunk Low Panda',
    catalogId: 'dunk-low-black-white-dd1391-100',
    size: 10,
  },
];

async function testSalesHistory(catalogId, size, regionId = 2) {
  try {
    // Test with all parameters
    const params = new URLSearchParams({
      catalog_id: catalogId,
      size: size.toString(),
      product_condition: '1',
      packaging_condition: '1',
      region_id: regionId.toString(),
      limit: '200',
    });

    const url = `${baseUrl}/pricing_insights/recent_sales?${params}`;
    console.log(`\n🔗 URL: ${url.substring(0, 100)}...`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
      },
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error: ${errorText.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    console.log(`\n📦 Response structure:`);
    console.log(JSON.stringify(data, null, 2).substring(0, 500));

    return data;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║           TESTING SALES HISTORY WITH KNOWN PRODUCTS                       ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝');

for (const product of TEST_PRODUCTS) {
  console.log(`\n\n${'═'.repeat(80)}`);
  console.log(`PRODUCT: ${product.name}`);
  console.log('═'.repeat(80));

  const data = await testSalesHistory(product.catalogId, product.size);

  if (data && data.recent_sales) {
    const sales = data.recent_sales;
    console.log(`\n✅ Found ${sales.length} sales records!`);

    if (sales.length > 0) {
      // Calculate monthly sales (last 30 days)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const monthlySales = sales.filter(sale => {
        const saleDate = new Date(sale.purchased_at);
        return saleDate >= thirtyDaysAgo;
      });

      console.log(`\n📈 Sales breakdown:`);
      console.log(`   Total sales (all time): ${sales.length}`);
      console.log(`   Last 30 days: ${monthlySales.length} ← This is "Monthly sales"!`);

      // Show last few sales
      console.log(`\n📅 Last 5 sales:`);
      console.log('-'.repeat(60));
      sales.slice(0, 5).forEach((sale, i) => {
        const date = new Date(sale.purchased_at).toLocaleDateString();
        const price = `$${(parseInt(sale.price_cents) / 100).toFixed(2)}`;
        const daysAgo = Math.floor(
          (Date.now() - new Date(sale.purchased_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        console.log(`   ${i + 1}. ${date} - ${price} (${daysAgo} days ago)`);
      });
    }
  }
}

console.log('\n\n' + '═'.repeat(80));
console.log('✓ Complete');
console.log('═'.repeat(80) + '\n');
