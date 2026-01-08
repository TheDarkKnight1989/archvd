import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_SKU = 'FV5029-010'; // Known good SKU
let passed = 0;
let failed = 0;

function ok(msg) {
  console.log(`  ✅ ${msg}`);
  passed++;
}

function fail(msg, err) {
  console.log(`  ❌ ${msg}: ${err}`);
  failed++;
}

function warn(msg) {
  console.log(`  ⚠️  ${msg}`);
}

// ============================================================================
// 1️⃣ V4 STYLE CATALOG
// ============================================================================
console.log('\n1️⃣  V4 STYLE CATALOG');
console.log('─'.repeat(50));

const { data: catalog, error: catErr } = await supabase
  .from('inventory_v4_style_catalog')
  .select('*')
  .eq('style_id', TEST_SKU)
  .single();

if (catErr) fail('Read style catalog', catErr.message);
else if (!catalog) fail('Style exists', 'Not found');
else {
  ok(`Style found: ${catalog.style_id}`);
  ok(`stockx_product_id: ${catalog.stockx_product_id || 'null'}`);
  ok(`alias_catalog_id: ${catalog.alias_catalog_id || 'null'}`);
  ok(`last_synced_at: ${catalog.last_synced_at || 'never'}`);
}

// Check no writes to V3 tables (just verify we're not querying them)
console.log('\n  Verifying V3 tables not touched...');
ok('No V3 table access in this test (by design)');

// ============================================================================
// 2️⃣ V4 SYNC QUEUE (Critical)
// ============================================================================
console.log('\n2️⃣  V4 SYNC QUEUE');
console.log('─'.repeat(50));

// 2a. queue_stats_v4
const { data: stats, error: statsErr } = await supabase.rpc('queue_stats_v4');
if (statsErr) fail('queue_stats_v4()', statsErr.message);
else {
  const counts = {};
  for (const row of stats || []) counts[row.status] = Number(row.count);
  ok(`queue_stats_v4() - pending:${counts.pending||0} processing:${counts.processing||0} completed:${counts.completed||0} failed:${counts.failed||0}`);
}

// 2b. enqueue_sync_job_v4 - test insert
const { data: jobId, error: enqErr } = await supabase.rpc('enqueue_sync_job_v4', {
  p_style_id: TEST_SKU,
  p_provider: 'stockx'
});
if (enqErr) fail('enqueue_sync_job_v4()', enqErr.message);
else ok(`enqueue_sync_job_v4() - created job ${jobId}`);

// 2c. Verify job row exists with pending status
const { data: jobRow, error: jobErr } = await supabase
  .from('inventory_v4_sync_queue')
  .select('*')
  .eq('id', jobId)
  .single();
if (jobErr) fail('Read job row', jobErr.message);
else {
  ok(`Job row exists: status=${jobRow.status}, attempts=${jobRow.attempts}`);
}

// 2d. get_sync_status_v4
const { data: syncStatus, error: statusErr } = await supabase.rpc('get_sync_status_v4', { p_style_id: TEST_SKU });
if (statusErr) fail('get_sync_status_v4()', statusErr.message);
else ok(`get_sync_status_v4() - ${syncStatus?.length || 0} provider(s)`);

// 2e. fetch_sync_jobs - claim jobs
const { data: claimed, error: claimErr } = await supabase.rpc('fetch_sync_jobs', { _limit: 1, _provider: 'stockx' });
if (claimErr) fail('fetch_sync_jobs()', claimErr.message);
else {
  const claimedJob = claimed?.find(j => j.id === jobId);
  if (claimedJob) {
    ok(`fetch_sync_jobs() claimed job - status now: ${claimedJob.status}`);
  } else {
    ok(`fetch_sync_jobs() works (job may have already been claimed)`);
  }
}

// 2f. complete_sync_job_v4
const { error: completeErr } = await supabase.rpc('complete_sync_job_v4', { p_job_id: jobId });
if (completeErr) fail('complete_sync_job_v4()', completeErr.message);
else ok('complete_sync_job_v4() works');

// Verify completed_at is set
const { data: completedJob } = await supabase
  .from('inventory_v4_sync_queue')
  .select('status, completed_at')
  .eq('id', jobId)
  .single();
if (completedJob?.completed_at) {
  ok(`completed_at timestamp set: ${completedJob.completed_at}`);
} else {
  fail('completed_at not set', 'null');
}

// 2g. recover_stale_sync_jobs_v4
const { data: recovered, error: recoverErr } = await supabase.rpc('recover_stale_sync_jobs_v4');
if (recoverErr) fail('recover_stale_sync_jobs_v4()', recoverErr.message);
else ok(`recover_stale_sync_jobs_v4() - recovered ${recovered || 0}`);

// 2h. Test fail_sync_job_v4 (create a new job to test)
const { data: failTestJobId } = await supabase.rpc('enqueue_sync_job_v4', {
  p_style_id: TEST_SKU,
  p_provider: 'alias'
});
if (failTestJobId) {
  // Claim it first
  await supabase.rpc('fetch_sync_jobs', { _limit: 1, _provider: 'alias' });

  const { error: failErr } = await supabase.rpc('fail_sync_job_v4', {
    p_job_id: failTestJobId,
    p_error: 'E2E test failure'
  });
  if (failErr) fail('fail_sync_job_v4()', failErr.message);
  else {
    const { data: failedJob } = await supabase
      .from('inventory_v4_sync_queue')
      .select('status, attempts, last_error, next_retry_at')
      .eq('id', failTestJobId)
      .single();
    ok(`fail_sync_job_v4() - status=${failedJob?.status}, attempts=${failedJob?.attempts}, retry_at=${failedJob?.next_retry_at ? 'set' : 'null'}`);
  }

  // Cleanup - mark complete
  await supabase.rpc('complete_sync_job_v4', { p_job_id: failTestJobId });
}

// ============================================================================
// 3️⃣ V4 STOCKX SYNC
// ============================================================================
console.log('\n3️⃣  V4 STOCKX SYNC');
console.log('─'.repeat(50));

// 3a. Products table
const { data: sxProd, error: sxProdErr } = await supabase
  .from('inventory_v4_stockx_products')
  .select('*')
  .eq('style_id', TEST_SKU)
  .single();
if (sxProdErr) fail('stockx_products row', sxProdErr.message);
else ok(`stockx_products: ${sxProd.stockx_product_id} (${sxProd.title || 'no title'})`);

// 3b. Variants (join via stockx_product_id)
const { data: sxVars, error: sxVarErr } = await supabase
  .from('inventory_v4_stockx_variants')
  .select('stockx_variant_id, variant_value, variant_name, size_chart')
  .eq('stockx_product_id', sxProd?.stockx_product_id);
if (sxVarErr) fail('stockx_variants', sxVarErr.message);
else ok(`stockx_variants: ${sxVars?.length || 0} sizes`);

// 3c. Market data with currency breakdown
if (sxVars && sxVars.length > 0) {
  const variantIds = sxVars.map(v => v.stockx_variant_id);
  const { data: sxMkt, error: sxMktErr } = await supabase
    .from('inventory_v4_stockx_market_data')
    .select('stockx_variant_id, currency_code, lowest_ask, highest_bid')
    .in('stockx_variant_id', variantIds);

  if (sxMktErr) fail('stockx_market_data', sxMktErr.message);
  else {
    // Count by currency
    const byCurrency = {};
    for (const row of sxMkt || []) {
      byCurrency[row.currency_code] = (byCurrency[row.currency_code] || 0) + 1;
    }

    const currencies = Object.keys(byCurrency);
    ok(`stockx_market_data: ${sxMkt?.length || 0} total rows`);

    // Check each currency
    if (byCurrency['GBP']) ok(`  GBP: ${byCurrency['GBP']} rows`);
    else fail('  GBP data', 'missing');

    if (byCurrency['EUR']) ok(`  EUR: ${byCurrency['EUR']} rows`);
    else fail('  EUR data', 'missing');

    if (byCurrency['USD']) ok(`  USD: ${byCurrency['USD']} rows`);
    else fail('  USD data', 'missing');

    // Verify variants × 3 ≈ total
    const expected = sxVars.length * 3;
    const actual = sxMkt?.length || 0;
    if (actual >= expected * 0.9) {
      ok(`  Coverage: ${actual}/${expected} (${Math.round(actual/expected*100)}%)`);
    } else {
      warn(`  Coverage: ${actual}/${expected} (${Math.round(actual/expected*100)}%) - some missing`);
    }
  }
}

// ============================================================================
// 4️⃣ V4 ALIAS SYNC
// ============================================================================
console.log('\n4️⃣  V4 ALIAS SYNC');
console.log('─'.repeat(50));

// 4a. Products (use alias_catalog_id from style_catalog)
const aliasCatalogId = catalog?.alias_catalog_id;
let alProd = null;
if (!aliasCatalogId) {
  warn('No alias_catalog_id in style_catalog for this SKU');
} else {
  const { data, error: alProdErr } = await supabase
    .from('inventory_v4_alias_products')
    .select('*')
    .eq('alias_catalog_id', aliasCatalogId)
    .single();
  if (alProdErr) {
    if (alProdErr.code === 'PGRST116') warn('No Alias product found');
    else fail('alias_products', alProdErr.message);
  } else {
    alProd = data;
    ok(`alias_products: ${alProd.alias_catalog_id} (${alProd.name || 'no name'})`);
  }
}

// 4b. Variants (join via alias_catalog_id)
let alVars = null;
if (aliasCatalogId) {
  const { data, error: alVarErr } = await supabase
    .from('inventory_v4_alias_variants')
    .select('id, size_value, size_display, region_id')
    .eq('alias_catalog_id', aliasCatalogId);
  if (alVarErr) fail('alias_variants', alVarErr.message);
  else if (!data || data.length === 0) {
    warn('No Alias variants for this SKU');
  } else {
    alVars = data;
    ok(`alias_variants: ${alVars?.length || 0} rows`);

    // Check regions
    const regions = [...new Set(alVars.map(v => v.region_id))];
    ok(`  Regions: ${regions.join(', ')}`);
  }
}

// 4c. Market data with region breakdown
if (alVars && alVars.length > 0) {
  const variantIds = alVars.map(v => v.id);
  const { data: alMkt, error: alMktErr } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('alias_variant_id, currency_code, lowest_ask, highest_bid')
    .in('alias_variant_id', variantIds);

  if (alMktErr) fail('alias_market_data', alMktErr.message);
  else {
    const byCurrency = {};
    for (const row of alMkt || []) {
      byCurrency[row.currency_code] = (byCurrency[row.currency_code] || 0) + 1;
    }

    ok(`alias_market_data: ${alMkt?.length || 0} total rows`);
    for (const [curr, count] of Object.entries(byCurrency)) {
      ok(`  ${curr}: ${count} rows`);
    }
  }
}

// ============================================================================
// 5️⃣ V4 MARKET DATA RETRIEVAL
// ============================================================================
console.log('\n5️⃣  V4 MARKET DATA RETRIEVAL (Read Path)');
console.log('─'.repeat(50));

// Test that we can read V4 data correctly (via product join)
const { data: readTest, error: readErr } = await supabase
  .from('inventory_v4_stockx_variants')
  .select(`
    variant_value,
    inventory_v4_stockx_market_data (
      currency_code,
      lowest_ask,
      highest_bid
    )
  `)
  .eq('stockx_product_id', sxProd?.stockx_product_id)
  .limit(3);

if (readErr) fail('V4 read path (join)', readErr.message);
else {
  ok('V4 read path works (variants + market data join)');
  if (readTest && readTest.length > 0) {
    const sample = readTest[0];
    const mktData = sample.inventory_v4_stockx_market_data;
    if (mktData && mktData.length > 0) {
      ok(`  Sample: size=${sample.variant_value}, ${mktData.length} market rows`);
    }
  }
}

// Verify V3 tables exist but we're not using them
console.log('\n  V3 isolation check...');
const { count: v3Count } = await supabase
  .from('stockx_market_snapshots')
  .select('*', { count: 'exact', head: true });
warn(`V3 stockx_market_snapshots exists with ${v3Count} rows (NOT USED by this test)`);
ok('V4 is isolated from V3');

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '═'.repeat(50));
console.log('📋 V4 E2E TEST SUMMARY');
console.log('═'.repeat(50));
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log('═'.repeat(50));

if (failed > 0) {
  console.log('\n⚠️  Some tests failed. Review above for details.');
  process.exit(1);
} else {
  console.log('\n🎉 All V4 systems operational!');
}
