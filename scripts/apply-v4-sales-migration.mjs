import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('=== Applying V4 Sales Migration ===\n')

  // Read migration SQL
  const sql = readFileSync('supabase/migrations/20251222_create_inventory_v4_sales.sql', 'utf-8')

  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements to execute\n`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const preview = stmt.substring(0, 80).replace(/\n/g, ' ')
    console.log(`[${i + 1}/${statements.length}] ${preview}...`)

    const { error } = await supabase.rpc('exec_raw_sql', { sql_text: stmt })

    if (error) {
      // Try direct query if RPC doesn't exist
      if (error.code === '42883') {
        console.log('  RPC not available, trying direct approach...')
        // We'll use the REST API directly
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_raw_sql`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ sql_text: stmt })
          }
        )
        if (!response.ok) {
          console.log(`  Warning: ${error.message}`)
        }
      } else {
        console.log(`  Warning: ${error.message}`)
      }
    } else {
      console.log('  OK')
    }
  }

  // Verify table exists
  console.log('\n=== Verifying Table ===')
  const { data, error: verifyError } = await supabase
    .from('inventory_v4_sales')
    .select('id')
    .limit(1)

  if (verifyError) {
    console.log('Table verification failed:', verifyError.message)
    console.log('Table may not exist yet.')
  } else {
    console.log('Table inventory_v4_sales exists!')
    console.log(`Current rows: ${data?.length || 0}`)
  }
}

main().catch(console.error)
