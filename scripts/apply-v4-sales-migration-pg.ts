import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import 'dotenv/config'

// Apply migration using Supabase Management API
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('=== Applying V4 Sales Migration (pg approach) ===\n')

  // Read migration SQL
  const sql = readFileSync('supabase/migrations/20251222_create_inventory_v4_sales.sql', 'utf-8')

  // First, try to drop existing table and create new one via direct SQL
  // Since we can't use exec_raw_sql, let's try the Supabase Management API
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1]

  if (!projectRef) {
    console.error('Could not extract project ref from SUPABASE_URL')
    process.exit(1)
  }

  console.log('Project ref:', projectRef)
  console.log('')

  // Use the REST API to execute SQL via Supabase Management API
  // We need to use the service role key to do this
  const supabaseApiUrl = `https://${projectRef}.supabase.co/rest/v1/`

  // Let's try a simpler approach - just check if we can access the API and then execute
  // individual DDL statements via the rpc endpoint if available

  // First, let's check if the table already exists
  const { data: existingCheck, error: checkError } = await supabase
    .from('inventory_v4_sales')
    .select('id')
    .limit(1)

  if (!checkError) {
    console.log('✅ Table inventory_v4_sales already exists!')
    console.log('Checking schema...')

    // Verify the table has the expected columns by attempting an insert
    const { data: schemaCheck, error: schemaError } = await supabase
      .from('inventory_v4_sales')
      .select('id, user_id, style_id, sku, sold_price, sale_currency, sold_date, platform, original_item_id')
      .limit(0)

    if (schemaError) {
      console.log('Schema check failed:', schemaError.message)
    } else {
      console.log('Schema looks good!')
    }

    return
  }

  console.log('Table does not exist, error:', checkError.message)
  console.log('')
  console.log('⚠️  The table needs to be created via Supabase SQL Editor.')
  console.log('')
  console.log('Please run the following SQL in Supabase Dashboard > SQL Editor:')
  console.log('')
  console.log('---')
  console.log(sql)
  console.log('---')
  console.log('')
  console.log('Migration file location: supabase/migrations/20251222_create_inventory_v4_sales.sql')
}

main().catch(console.error)
