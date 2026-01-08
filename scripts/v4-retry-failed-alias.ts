/**
 * Batch retry failed Alias sync jobs
 * Usage: npx tsx scripts/v4-retry-failed-alias.ts --since-days=7 --limit=25
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Parse CLI args
const args = process.argv.slice(2)
const getArg = (name: string, defaultValue: number): number => {
  const arg = args.find(a => a.startsWith(`--${name}=`))
  if (arg) {
    const val = parseInt(arg.split('=')[1], 10)
    return isNaN(val) ? defaultValue : val
  }
  return defaultValue
}

const sinceDays = getArg('since-days', 7)
const limit = getArg('limit', 25)
const dryRun = args.includes('--dry-run')

async function main() {
  console.log('='.repeat(60))
  console.log('V4 RETRY FAILED ALIAS JOBS')
  console.log('='.repeat(60))
  console.log(`Since days: ${sinceDays}`)
  console.log(`Limit: ${limit}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('')

  // Calculate cutoff date
  const cutoffDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()

  // Find failed Alias jobs within the window
  const { data: failedJobs, error } = await supabase
    .from('inventory_v4_sync_queue')
    .select('id, style_id, last_error, attempts, max_attempts, completed_at')
    .eq('status', 'failed')
    .eq('provider', 'alias')
    .gte('completed_at', cutoffDate)
    .order('completed_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch jobs:', error.message)
    process.exit(1)
  }

  console.log(`Found ${failedJobs?.length || 0} failed Alias jobs`)
  console.log('')

  if (!failedJobs || failedJobs.length === 0) {
    console.log('Nothing to retry.')
    return
  }

  // Display jobs
  console.log('Jobs to retry:')
  for (const job of failedJobs) {
    const shortError = job.last_error?.substring(0, 50) || 'Unknown error'
    console.log(`  ${job.style_id} (attempts: ${job.attempts}/${job.max_attempts}) - ${shortError}...`)
  }
  console.log('')

  if (dryRun) {
    console.log('DRY RUN - No changes made.')
    console.log('Run without --dry-run to execute retry.')
    return
  }

  // Reset each failed job to pending
  let success = 0
  let failed = 0

  for (const job of failedJobs) {
    const { error: updateError } = await supabase
      .from('inventory_v4_sync_queue')
      .update({
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        last_error: null,
        next_retry_at: new Date().toISOString(),
        completed_at: null
      })
      .eq('id', job.id)

    if (updateError) {
      console.log(`  ✗ ${job.style_id}: ${updateError.message}`)
      failed++
    } else {
      console.log(`  ✓ ${job.style_id}: reset to pending`)
      success++
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log(`Success: ${success}`)
  console.log(`Failed: ${failed}`)
  console.log('='.repeat(60))

  if (success > 0) {
    console.log('')
    console.log('Jobs have been queued. Run a sync worker to process them:')
    console.log('  source .env.local && npx tsx scripts/inventory-v4-sync-worker.ts --drain --provider=alias --batch=5')
  }
}

main().catch(err => {
  console.error('Script error:', err)
  process.exit(1)
})
