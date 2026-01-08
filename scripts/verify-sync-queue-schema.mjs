import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('📋 STEP 1: Verify RPC functions exist\n');

// Test queue_stats_v4
const { data: stats, error: statsErr } = await supabase.rpc('queue_stats_v4');
if (statsErr) {
  console.log('  ❌ queue_stats_v4:', statsErr.message);
} else {
  console.log('  ✅ queue_stats_v4 works');
  const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
  for (const row of stats || []) {
    counts[row.status] = Number(row.count);
  }
  console.log(`     Pending: ${counts.pending}, Processing: ${counts.processing}, Completed: ${counts.completed}, Failed: ${counts.failed}`);
}

// Test fetch_sync_jobs
const { data: fetchData, error: fetchErr } = await supabase.rpc('fetch_sync_jobs', { _limit: 0, _provider: null });
if (fetchErr) {
  console.log('  ❌ fetch_sync_jobs:', fetchErr.message);
} else {
  console.log('  ✅ fetch_sync_jobs works');
}

console.log('\n📋 STEP 2: Sample job (verify column names)\n');
const { data: sample, error: sampleErr } = await supabase
  .from('inventory_v4_sync_queue')
  .select('*')
  .limit(1);

if (sampleErr) {
  console.log('Error:', sampleErr.message);
} else if (sample && sample.length > 0) {
  console.log('  Columns present:', Object.keys(sample[0]).join(', '));
  console.log('\n  Expected from 20251212 migration:');
  console.log('  id (uuid), style_id, provider, status, attempts, max_attempts,');
  console.log('  last_attempt_at, next_retry_at, last_error, created_at, completed_at');

  // Check for expected columns
  const expected = ['id', 'style_id', 'provider', 'status', 'attempts', 'max_attempts',
                    'last_attempt_at', 'next_retry_at', 'last_error', 'created_at', 'completed_at'];
  const actual = Object.keys(sample[0]);
  const missing = expected.filter(c => !actual.includes(c));
  const extra = actual.filter(c => !expected.includes(c));

  if (missing.length === 0 && extra.length === 0) {
    console.log('\n  ✅ Schema matches expected!');
  } else {
    if (missing.length > 0) console.log('\n  ❌ Missing columns:', missing.join(', '));
    if (extra.length > 0) console.log('  ⚠️  Extra columns:', extra.join(', '));
  }

  // Check ID type
  const idType = typeof sample[0].id;
  const idIsUuid = typeof sample[0].id === 'string' && sample[0].id.includes('-');
  console.log(`\n  ID type: ${idType} (${idIsUuid ? '✅ UUID' : '❌ NOT UUID'})`);
  console.log('  Sample ID:', sample[0].id);
} else {
  console.log('  Queue is empty - checking schema directly...');

  // Try to insert and rollback to verify columns
  const { data: testInsert, error: insertErr } = await supabase
    .from('inventory_v4_sync_queue')
    .select('id, style_id, provider, status, attempts, max_attempts, last_attempt_at, next_retry_at, last_error, created_at, completed_at')
    .limit(0);

  if (insertErr) {
    console.log('  Schema check error:', insertErr.message);
  } else {
    console.log('  ✅ All expected columns exist (verified via SELECT)');
  }
}
