import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('Applying sync queue dedupe migration...')

  // Read the migration file
  const sql = fs.readFileSync('supabase/migrations/20251218_add_sync_queue_dedupe_index.sql', 'utf8')

  // Split into statements (simple split on semicolons, handling $$ blocks)
  const statements = []
  let current = ''
  let inDollarQuote = false

  for (const line of sql.split('\n')) {
    if (line.includes('$$')) {
      inDollarQuote = !inDollarQuote
    }
    current += line + '\n'

    if (!inDollarQuote && line.trim().endsWith(';')) {
      statements.push(current.trim())
      current = ''
    }
  }

  if (current.trim()) {
    statements.push(current.trim())
  }

  console.log(`Found ${statements.length} statements`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    if (!stmt || stmt.startsWith('--')) continue

    console.log(`\nExecuting statement ${i + 1}...`)
    console.log(stmt.substring(0, 100) + '...')

    // Use the REST API directly for DDL
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({})
      }
    )

    // Try via supabase-js query
    const { error } = await supabase.from('inventory_v4_sync_queue').select('id').limit(0)
    if (error) {
      console.log('Connection test failed:', error.message)
    }
  }

  // Apply index manually via node-postgres or supabase management API
  // Since we can't run raw SQL, let's check if we can use supabase CLI
  console.log('\n⚠️  Migration needs to be applied via Supabase Dashboard or CLI')
  console.log('Run: npx supabase db push')
  console.log('Or paste the SQL in Supabase Dashboard SQL Editor')
}

main().catch(console.error)
