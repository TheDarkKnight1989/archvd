#!/usr/bin/env node

/**
 * Test the StockX V4 refresh cron endpoint locally
 *
 * Usage:
 *   node scripts/test-stockx-v4-refresh-cron.mjs
 *
 * This simulates what Vercel Cron will do in production.
 */

console.log('🔄 Testing StockX V4 Refresh Cron Endpoint\n');
console.log('='.repeat(80));

const ENDPOINT = process.env.TEST_URL || 'http://localhost:3000/api/cron/stockx-v4-refresh';
const CRON_SECRET = process.env.CRON_SECRET;

console.log(`\n📍 Endpoint: ${ENDPOINT}`);
console.log(`🔐 Auth: ${CRON_SECRET ? 'Bearer token configured' : 'No auth (dev mode)'}\n`);

const startTime = Date.now();

try {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (CRON_SECRET) {
    headers['Authorization'] = `Bearer ${CRON_SECRET}`;
  }

  console.log('⏳ Sending request...\n');

  const response = await fetch(ENDPOINT, {
    method: 'GET',
    headers,
  });

  const duration = Date.now() - startTime;

  console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
  console.log(`⏱️  Duration: ${duration}ms\n`);

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Error Response:');
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log('✅ Success!\n');
  console.log('='.repeat(80));
  console.log('📈 CRON SUMMARY\n');
  console.log(`Timestamp:        ${data.timestamp}`);
  console.log(`Refreshed:        ${data.refreshed} products`);
  console.log(`Failed:           ${data.failed} products`);
  console.log(`Skipped:          ${data.skipped} products`);
  console.log(`Duration:         ${data.durationMs}ms`);
  console.log(`Remaining Stale:  ${data.staleProductsRemaining} products`);

  if (data.results && data.results.length > 0) {
    console.log('\n' + '─'.repeat(80));
    console.log('🔍 DETAILED RESULTS\n');

    data.results.forEach((result, idx) => {
      const icon = result.success ? '✅' : '❌';
      console.log(`${icon} ${result.styleId}`);
      console.log(`   Product ID: ${result.productId}`);
      console.log(`   Duration: ${result.duration}ms`);

      if (result.success) {
        console.log(`   Variants Refreshed: ${result.variantsRefreshed}`);
      } else {
        console.log(`   Error: ${result.error}`);
      }

      if (idx < data.results.length - 1) {
        console.log('');
      }
    });
  }

  console.log('\n' + '='.repeat(80));

  if (data.staleProductsRemaining > 0) {
    console.log(`\n⚠️  ${data.staleProductsRemaining} products still need refresh (will run on next cron)`);
  } else {
    console.log('\n🎉 All products are fresh!');
  }
} catch (error) {
  console.error('\n❌ Test Failed:');
  console.error(error.message);
  process.exit(1);
}
