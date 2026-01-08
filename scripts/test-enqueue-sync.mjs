import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sku = process.argv[2] || 'DZ4137-106';
const provider = process.argv[3] || null; // 'stockx' | 'alias' | null (both)

console.log(`\n📤 Enqueueing sync job for: ${sku}`);
console.log(`   Provider: ${provider || 'both'}\n`);

// Enqueue job(s)
const providers = provider ? [provider] : ['stockx', 'alias'];

for (const p of providers) {
  const { data: jobId, error } = await supabase.rpc('enqueue_sync_job_v4', {
    p_style_id: sku.toUpperCase(),
    p_provider: p,
  });

  if (error) {
    console.log(`❌ Failed to enqueue ${p}:`, error.message);
  } else {
    console.log(`✅ Enqueued ${p} job: ${jobId || '(deduplicated - job already exists)'}`);
  }
}

// Check queue status
console.log('\n📊 Current queue status:');
const { data: jobs, error: jobsErr } = await supabase
  .from('inventory_v4_sync_queue')
  .select('id, style_id, provider, status, attempts, last_error, created_at, completed_at')
  .eq('style_id', sku.toUpperCase())
  .order('created_at', { ascending: false })
  .limit(10);

if (jobsErr) {
  console.log('Error fetching jobs:', jobsErr.message);
} else if (!jobs?.length) {
  console.log('No jobs found for this SKU');
} else {
  for (const job of jobs) {
    console.log(`\n  [${job.provider}] ${job.status}`);
    console.log(`    ID: ${job.id}`);
    console.log(`    Attempts: ${job.attempts}`);
    console.log(`    Created: ${job.created_at}`);
    if (job.completed_at) console.log(`    Completed: ${job.completed_at}`);
    if (job.last_error) console.log(`    Error: ${job.last_error}`);
  }
}

// Also show overall queue stats
console.log('\n📈 Queue stats:');
const { data: stats, error: statsErr } = await supabase.rpc('queue_stats_v4');
if (statsErr) {
  console.log('Error fetching stats:', statsErr.message);
} else {
  const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
  for (const row of stats || []) {
    counts[row.status] = Number(row.count);
  }
  console.log(`  Pending: ${counts.pending}, Processing: ${counts.processing}, Completed: ${counts.completed}, Failed: ${counts.failed}`);
}
