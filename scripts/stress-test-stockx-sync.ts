/**
 * Stress test for multi-currency StockX sync
 * Tests: parallel batching, rate limiting, GBP success criteria
 */

import { syncStockxProductBySku } from '../src/lib/services/stockx-v4/sync';

const TEST_SKUS = [
  'DD1391-100', // Nike Dunk Low - popular, many sizes
  'DZ5485-612', // Nike Dunk Low - another popular
  'M990GL6',    // New Balance 990v6
  'FQ8060-091', // Nike Air Max
  'DV0833-105', // Nike Dunk Low
];

async function stressTest() {
  console.log('🚀 STRESS TEST: Multi-Currency StockX Sync');
  console.log('=' .repeat(60));
  console.log(`Testing ${TEST_SKUS.length} SKUs with 3 currencies each (GBP/EUR/USD)`);
  console.log('');

  const startTime = Date.now();
  let totalVariants = 0;
  let totalMarketData = 0;
  let totalRateLimited = 0;
  let successCount = 0;

  // Run syncs sequentially to not overwhelm the API
  for (const sku of TEST_SKUS) {
    console.log(`\n📦 Syncing: ${sku}`);
    const skuStart = Date.now();

    try {
      const result = await syncStockxProductBySku(sku);
      const skuDuration = ((Date.now() - skuStart) / 1000).toFixed(1);

      totalVariants += result.counts.variantsSynced;
      totalMarketData += result.counts.marketDataRefreshed;
      totalRateLimited += result.counts.rateLimited;

      if (result.success) {
        successCount++;
        console.log(`   ✅ SUCCESS in ${skuDuration}s`);
      } else {
        console.log(`   ❌ FAILED in ${skuDuration}s`);
      }

      console.log(`   📊 Variants: ${result.counts.variantsSynced}`);
      console.log(`   📈 Market data: ${result.counts.marketDataRefreshed} (3 currencies × variants)`);
      console.log(`   ⚠️  Rate limited: ${result.counts.rateLimited}`);

      if (result.errors.length > 0) {
        const rateLimitErrors = result.errors.filter(e => e.error.includes('RATE LIMITED')).length;
        const otherErrors = result.errors.length - rateLimitErrors;
        if (otherErrors > 0) {
          console.log(`   🔴 Other errors: ${otherErrors}`);
        }
      }
    } catch (err) {
      console.log(`   💥 EXCEPTION: ${(err as Error).message}`);
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '=' .repeat(60));
  console.log('📊 STRESS TEST RESULTS');
  console.log('=' .repeat(60));
  console.log(`✅ Success: ${successCount}/${TEST_SKUS.length} SKUs`);
  console.log(`📦 Total variants: ${totalVariants}`);
  console.log(`📈 Total market data fetched: ${totalMarketData}`);
  console.log(`⚠️  Total rate limited: ${totalRateLimited}`);
  console.log(`⏱️  Total time: ${totalDuration}s`);
  console.log(`📉 Avg time per SKU: ${(parseFloat(totalDuration) / TEST_SKUS.length).toFixed(1)}s`);

  if (totalRateLimited > 0) {
    const rateLimitPct = ((totalRateLimited / totalMarketData) * 100).toFixed(1);
    console.log(`\n⚠️  Rate limit hit rate: ${rateLimitPct}%`);
  } else {
    console.log(`\n🎉 No rate limits hit!`);
  }
}

stressTest().catch(console.error);
