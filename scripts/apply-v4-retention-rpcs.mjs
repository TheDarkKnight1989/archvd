/**
 * Apply V4 Retention RPCs Migration
 * Creates the RPC functions for rollup and prune operations
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('=== APPLYING V4 RETENTION RPCs MIGRATION ===')
  console.log('')

  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20251217_create_v4_retention_rpcs.sql')
  const sql = fs.readFileSync(migrationPath, 'utf-8')

  // Split by function creation to apply each separately
  // The full SQL has comments which exec_raw_sql should handle
  const { data, error } = await supabase.rpc('exec_raw_sql', { sql_text: sql })

  if (error) {
    console.error('Migration failed:', error.message)
    console.log('')
    console.log('Trying statement-by-statement...')

    // Try applying each CREATE OR REPLACE FUNCTION separately
    const statements = sql.split(/(?=CREATE OR REPLACE FUNCTION|REVOKE ALL|GRANT EXECUTE|COMMENT ON)/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    let success = 0
    let failed = 0

    for (const stmt of statements) {
      if (stmt.startsWith('--')) continue
      const { error: stmtError } = await supabase.rpc('exec_raw_sql', { sql_text: stmt })
      if (stmtError) {
        console.error('Failed:', stmt.substring(0, 60) + '...')
        console.error('  Error:', stmtError.message)
        failed++
      } else {
        console.log('Applied:', stmt.substring(0, 60) + '...')
        success++
      }
    }

    console.log('')
    console.log(`Results: ${success} succeeded, ${failed} failed`)
  } else {
    console.log('Migration applied successfully!')
  }

  // Verify functions exist
  console.log('')
  console.log('=== VERIFYING FUNCTIONS ===')

  const functions = [
    'rollup_alias_sales_daily_v4',
    'rollup_alias_sales_monthly_v4',
    'prune_alias_sales_history_v4',
    'prune_alias_sales_daily_v4',
    'prune_alias_price_history_v4',
    'prune_stockx_price_history_v4'
  ]

  for (const fn of functions) {
    const { data, error } = await supabase.rpc(fn)
    if (error) {
      console.log(`${fn}: ERROR - ${error.message}`)
    } else {
      console.log(`${fn}: EXISTS (returned ${data})`)
    }
  }
}

main()
