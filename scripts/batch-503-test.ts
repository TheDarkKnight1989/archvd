import { syncAliasProductByCatalogId } from '../src/lib/services/alias-v4/sync';

const TEST_CATALOG_IDS = [
  'nike-dunk-low-retro-white-black-dd1391-100',
  'air-jordan-4-retro-og-fire-red-2020-dc7770-160',
  'a-ma-maniere-x-wmns-air-jordan-3-retro-sp-violet-ore-dh3434-110',
  'air-jordan-1-retro-high-og-chicago-lost-and-found-dz5485-612',
  'air-jordan-4-retro-military-black-dh6927-111',
];

interface BatchResult {
  catalogId: string;
  attempts: number;
  status: 'success' | 'failed';
  lastError: string | null;
  duration: number;
}

async function runBatchTest() {
  console.log('=== BATCH 503 TEST (5 SKUs) ===\n');
  console.log('Start:', new Date().toISOString());
  console.log('');

  const results: BatchResult[] = [];

  for (const catalogId of TEST_CATALOG_IDS) {
    console.log(`\n--- Syncing: ${catalogId.slice(0, 40)}... ---`);
    const startTime = Date.now();

    try {
      const result = await syncAliasProductByCatalogId(catalogId, { fetchSales: false });

      results.push({
        catalogId: catalogId.slice(0, 35),
        attempts: 1, // We can't easily track internal retries here
        status: result.success ? 'success' : 'failed',
        lastError: result.errors.length > 0 ? result.errors[0].message : null,
        duration: Date.now() - startTime,
      });

      if (result.success) {
        console.log(`✅ SUCCESS (${Date.now() - startTime}ms)`);
      } else {
        console.log(`❌ FAILED: ${result.errors[0]?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      results.push({
        catalogId: catalogId.slice(0, 35),
        attempts: 1,
        status: 'failed',
        lastError: error.message,
        duration: Date.now() - startTime,
      });
      console.log(`❌ EXCEPTION: ${error.message}`);
    }
  }

  console.log('\n=== BATCH RESULTS ===\n');
  console.log('| SKU (truncated) | Status | Last Error | Duration |');
  console.log('|-----------------|--------|------------|----------|');
  for (const r of results) {
    const err = r.lastError ? r.lastError.slice(0, 30) + '...' : '-';
    console.log(`| ${r.catalogId} | ${r.status} | ${err} | ${r.duration}ms |`);
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const failCount = results.filter(r => r.status === 'failed').length;
  console.log(`\nSuccess: ${successCount}/${results.length}, Failed: ${failCount}/${results.length}`);
  console.log('End:', new Date().toISOString());
}

runBatchTest().catch(console.error);
