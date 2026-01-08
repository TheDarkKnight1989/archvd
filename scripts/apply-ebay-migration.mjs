/**
 * Apply master_market_data migration using Supabase JS client
 * Alternative to using psql
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  console.log('🔧 Applying master_market_data Migration')
  console.log('=' .repeat(60))

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:')
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET')
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'NOT SET')
    console.error('\n💡 Make sure to load .env.local:')
    console.error('   set -a && source .env.local && set +a && node scripts/apply-ebay-migration.mjs')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Read the migration file
  const migrationPath = join(__dirname, '../supabase/migrations/20251203_create_master_market_data.sql')
  console.log('\n📄 Reading migration file:')
  console.log('  ', migrationPath)

  let sql
  try {
    sql = readFileSync(migrationPath, 'utf-8')
  } catch (error) {
    console.error('❌ Failed to read migration file:', error.message)
    process.exit(1)
  }

  console.log('✅ File read successfully')
  console.log('   SQL length:', sql.length, 'characters')

  // Execute the SQL
  console.log('\n⚙️  Executing migration...')

  try {
    // Note: This uses Supabase's RPC to execute raw SQL
    // The service role key has permission to execute DDL
    const { data, error } = await supabase.rpc('exec', { sql })

    if (error) {
      // Try alternative: split by statement and execute one by one
      console.log('⚠️  Direct exec failed, trying statement-by-statement...')

      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      console.log(`   Found ${statements.length} SQL statements`)

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i]
        if (!stmt) continue

        console.log(`   [${i + 1}/${statements.length}] Executing...`)

        const { error: stmtError } = await supabase.rpc('exec', { sql: stmt })

        if (stmtError) {
          console.error(`   ❌ Statement ${i + 1} failed:`, stmtError.message)
          // Continue anyway - might be "already exists" errors
        } else {
          console.log(`   ✅ Statement ${i + 1} succeeded`)
        }
      }
    } else {
      console.log('✅ Migration executed successfully')
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    console.error('\n💡 Alternative: Apply migration via Supabase Dashboard:')
    console.error('   1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql')
    console.error('   2. Paste contents of: supabase/migrations/20251203_create_master_market_data.sql')
    console.error('   3. Click "Run"')
    process.exit(1)
  }

  // Verify table exists
  console.log('\n📊 Verifying master_market_data table...')

  const { data, error } = await supabase
    .from('master_market_data')
    .select('id')
    .limit(1)

  if (error) {
    if (error.message.includes('master_market_data')) {
      console.error('❌ Table still not found. Manual migration required.')
      console.error('\n📋 Manual Steps:')
      console.error('   1. Go to Supabase Dashboard → SQL Editor')
      console.error('   2. Copy/paste: supabase/migrations/20251203_create_master_market_data.sql')
      console.error('   3. Run the SQL')
    } else {
      console.error('❌ Verification error:', error.message)
    }
  } else {
    console.log('✅ Table exists and is accessible!')
    console.log('\n🎉 Migration complete!')
    console.log('\n📝 Next: Run the eBay integration test:')
    console.log('   set -a && source .env.local && set +a && npx tsx scripts/test-ebay-to-master-market.ts')
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
