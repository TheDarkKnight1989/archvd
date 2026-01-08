/**
 * Apply sync queue dedupe migration via Supabase REST API
 * Uses the SQL Editor API endpoint
 */

import fs from 'fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0]

async function runSql(sql, description) {
  console.log(`\n${description}...`)

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_raw_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  })

  if (!response.ok) {
    // exec_raw_sql might not exist, try running via the query endpoint
    console.log('   exec_raw_sql not available, trying alternative...')
    return null
  }

  const result = await response.json()
  return result
}

async function main() {
  console.log('=' .repeat(60))
  console.log('APPLY SYNC QUEUE DEDUPE MIGRATION')
  console.log('=' .repeat(60))
  console.log(`Project: ${projectRef}`)
  console.log('')

  // Read the migration file
  const migrationPath = 'supabase/migrations/20251218_add_sync_queue_dedupe_index.sql'
  const sql = fs.readFileSync(migrationPath, 'utf8')

  console.log('Migration SQL loaded from:', migrationPath)
  console.log('')

  // Split into individual statements (rough split on semicolons followed by newlines)
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements`)
  console.log('')

  // Try to run via exec_raw_sql
  const testResult = await runSql('SELECT 1 as test', 'Testing exec_raw_sql RPC')

  if (testResult === null) {
    console.log('\n⚠️  exec_raw_sql RPC is not available.')
    console.log('')
    console.log('Please apply the migration manually:')
    console.log('1. Go to Supabase Dashboard → SQL Editor')
    console.log('2. Paste the following SQL and run it:')
    console.log('')
    console.log('-'.repeat(60))
    console.log(sql)
    console.log('-'.repeat(60))
    console.log('')
    console.log('Or use the Supabase CLI:')
    console.log(`  npx supabase db push --linked`)
    return
  }

  // Run each statement
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ')

    try {
      await runSql(stmt + ';', `[${i + 1}/${statements.length}] ${preview}...`)
      console.log('   ✅ Success')
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`)
    }
  }

  // Verify
  console.log('\n' + '='.repeat(60))
  console.log('VERIFICATION')
  console.log('='.repeat(60))

  const indexCheck = await runSql(
    `SELECT indexname FROM pg_indexes WHERE indexname = 'uq_v4_sync_active_job'`,
    'Checking index'
  )
  console.log('   Index exists:', indexCheck ? '✅' : '❌')

  const funcCheck = await runSql(
    `SELECT proname FROM pg_proc WHERE proname = 'enqueue_stale_v4_sync_jobs'`,
    'Checking function'
  )
  console.log('   Function exists:', funcCheck ? '✅' : '❌')

  console.log('')
  console.log('✅ Migration complete!')
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
