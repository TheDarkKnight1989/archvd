/**
 * Apply sync queue dedupe migration via direct SQL execution
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('Applying sync queue dedupe migration...')

  // Read the migration file
  const sql = fs.readFileSync('supabase/migrations/20251218_add_sync_queue_dedupe_index.sql', 'utf8')

  // Execute via exec_raw_sql RPC (needs to exist in Supabase)
  // Try to execute each statement separately

  // For now, just show the SQL that needs to be applied
  console.log('\n=== MIGRATION SQL ===\n')
  console.log(sql)
  console.log('\n=== END MIGRATION SQL ===\n')

  console.log('To apply this migration:')
  console.log('1. Go to Supabase Dashboard → SQL Editor')
  console.log('2. Paste the SQL above and run it')
  console.log('3. Or use: npx supabase db push (if linked)')

  // Try to check if the index already exists
  const { data: indexes, error } = await supabase.rpc('exec_raw_sql', {
    sql: `SELECT indexname FROM pg_indexes WHERE indexname = 'uq_v4_sync_active_job'`
  }).maybeSingle()

  if (!error && indexes) {
    console.log('\n✓ Index uq_v4_sync_active_job already exists')
  }

  // Try to check if the function exists
  const { data: funcs, error: funcError } = await supabase.rpc('exec_raw_sql', {
    sql: `SELECT proname FROM pg_proc WHERE proname = 'enqueue_stale_v4_sync_jobs'`
  }).maybeSingle()

  if (!funcError && funcs) {
    console.log('✓ Function enqueue_stale_v4_sync_jobs exists')
  }
}

main().catch(console.error)
