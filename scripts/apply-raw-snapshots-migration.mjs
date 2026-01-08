/**
 * Apply raw snapshots migration
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════════')
  console.log('Applying Raw Snapshots Migration')
  console.log('═══════════════════════════════════════════════════════════════════════════\n')

  // Read migration file
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251203_create_raw_snapshot_tables.sql')
  const sql = readFileSync(migrationPath, 'utf-8')

  console.log('📄 Migration file:', migrationPath)
  console.log('📏 SQL size:', sql.length, 'bytes')
  console.log()

  console.log('🔧 Applying migration...')

  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // Try direct execution if rpc doesn't exist
      console.log('⚠️  RPC method not available, trying direct execution...')

      // Split into individual statements and execute them
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'DO $$' && !s.includes('RAISE NOTICE'))

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i]
        if (stmt.length === 0) continue

        console.log(`\n📝 Executing statement ${i + 1}/${statements.length}...`)

        // Use the Supabase client to execute raw SQL
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('/rest/v1', '')
        const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ query: stmt + ';' })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ Failed to execute statement ${i + 1}:`, errorText)
        }
      }

      console.log('\n✅ Migration applied (with warnings - manual verification recommended)')
    } else {
      console.log('✅ Migration applied successfully')
    }
  } catch (err) {
    console.error('❌ Error applying migration:', err.message)
    throw err
  }

  console.log()
  console.log('═══════════════════════════════════════════════════════════════════════════')
  console.log('Verifying Tables')
  console.log('═══════════════════════════════════════════════════════════════════════════\n')

  // Verify tables exist
  const { data: stockxTable, error: stockxError } = await supabase
    .from('stockx_raw_snapshots')
    .select('id')
    .limit(1)

  const { data: aliasTable, error: aliasError } = await supabase
    .from('alias_raw_snapshots')
    .select('id')
    .limit(1)

  if (stockxError) {
    console.log('❌ stockx_raw_snapshots table:', stockxError.message)
  } else {
    console.log('✅ stockx_raw_snapshots table: EXISTS')
  }

  if (aliasError) {
    console.log('❌ alias_raw_snapshots table:', aliasError.message)
  } else {
    console.log('✅ alias_raw_snapshots table: EXISTS')
  }

  console.log()
}

main().catch(console.error)
