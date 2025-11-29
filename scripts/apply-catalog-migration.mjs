import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔄 Applying alias_catalog_items migration...\n')

// Read the migration file
const migrationPath = path.join(__dirname, '../supabase/migrations/20251125_alias_catalog_items.sql')
const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

console.log('📄 Migration file:', migrationPath)
console.log('📏 SQL length:', migrationSQL.length, 'bytes\n')

// Split SQL into individual statements (rough split by semicolon)
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))

console.log(`📊 Executing ${statements.length} SQL statements...\n`)

let successCount = 0
let errorCount = 0

for (let i = 0; i < statements.length; i++) {
  const statement = statements[i] + ';'

  // Skip empty or comment-only statements
  if (statement.trim() === ';' || statement.trim().startsWith('--')) {
    continue
  }

  try {
    const { error } = await supabase.rpc('exec_sql', { sql: statement })

    if (error) {
      // Check if it's an "already exists" error (which is OK)
      if (error.message && (
        error.message.includes('already exists') ||
        error.message.includes('duplicate')
      )) {
        console.log(`⚠️  Statement ${i + 1}: Already exists (OK)`)
        successCount++
      } else {
        console.error(`❌ Statement ${i + 1} failed:`, error.message)
        errorCount++
      }
    } else {
      console.log(`✅ Statement ${i + 1}: Success`)
      successCount++
    }
  } catch (err) {
    console.error(`❌ Statement ${i + 1} error:`, err)
    errorCount++
  }
}

console.log(`\n📊 Results: ${successCount} success, ${errorCount} errors`)

// Verify table exists
const { data, error } = await supabase
  .from('alias_catalog_items')
  .select('id')
  .limit(1)

if (error) {
  console.error('\n❌ Table verification failed:', error)
} else {
  console.log('\n✅ Table alias_catalog_items is now accessible!')
}
