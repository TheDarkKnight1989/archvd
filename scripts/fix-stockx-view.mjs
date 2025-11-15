/**
 * Fix stockx_latest_prices view
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })
dotenv.config({ path: join(__dirname, '..', '.env') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔧 FIXING stockx_latest_prices VIEW\n')

const sql = readFileSync(
  join(__dirname, '..', 'supabase/migrations/20251118_fix_stockx_latest_prices_view.sql'),
  'utf8'
)

console.log('Executing SQL...\n')

// Split by semicolons and execute each statement
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--'))

for (const statement of statements) {
  if (!statement) continue

  console.log(`Running: ${statement.substring(0, 100)}...`)

  const { error } = await supabase.rpc('exec_sql', { sql: statement })

  if (error) {
    // Try with raw query
    const { error: rawError } = await supabase.from('_sql').select(statement)
    if (rawError) {
      console.error(`❌ Error: ${error?.message || rawError?.message}`)
    }
  } else {
    console.log('   ✓ Success')
  }
}

console.log('\n✅ View recreation complete!')

// Verify it works
const { data, error } = await supabase
  .from('stockx_latest_prices')
  .select('*')
  .limit(5)

if (error) {
  console.error('\n❌ View still not working:', error)
} else {
  console.log(`\n✓ View now returns ${data.length} rows:`)
  data.forEach(row => {
    console.log(`  ${row.sku} size ${row.size}: Ask $${row.lowest_ask}`)
  })
}
