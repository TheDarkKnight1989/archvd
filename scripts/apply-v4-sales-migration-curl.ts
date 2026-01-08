import { readFileSync } from 'fs'
import 'dotenv/config'

async function main() {
  console.log('=== Applying V4 Sales Migration via REST ===\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1]

  // Read migration SQL
  const sql = readFileSync('supabase/migrations/20251222_create_inventory_v4_sales.sql', 'utf-8')

  // Try the query endpoint (PostgREST-compatible)
  console.log('Attempting to execute migration via pg-meta endpoint...')

  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ query: sql })
  })

  console.log('Response status:', response.status)

  if (!response.ok) {
    const text = await response.text()
    console.log('Response:', text.slice(0, 500))

    // Try alternative - Supabase Management API via SQL endpoint
    console.log('\nTrying Supabase database query endpoint...')

    // The pg_stat endpoint is read-only so we can't use it
    // Let's check if the Management API is available

    console.log('\n⚠️  Direct SQL execution not available via REST.')
    console.log('')
    console.log('Apply the migration manually by:')
    console.log('1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/' + projectRef)
    console.log('2. Navigate to SQL Editor')
    console.log('3. Copy and paste the migration SQL below')
    console.log('')
    console.log('Or copy from: supabase/migrations/20251222_create_inventory_v4_sales.sql')
  } else {
    const data = await response.json()
    console.log('Success:', data)
  }
}

main().catch(console.error)
