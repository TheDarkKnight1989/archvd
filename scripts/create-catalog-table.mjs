import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

console.log('🔄 Creating alias_catalog_items table...\n')

// Create the table with a single SQL statement
const createTableSQL = `
CREATE TABLE IF NOT EXISTS alias_catalog_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  catalog_id TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  brand TEXT,
  sku TEXT,
  slug TEXT UNIQUE,
  image_url TEXT,
  thumbnail_url TEXT,
  category TEXT,
  colorway TEXT,
  retail_price_cents INTEGER,
  release_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_fetched_at TIMESTAMPTZ DEFAULT NOW()
);
`

try {
  // Use the REST API query method
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ sql: createTableSQL })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('❌ Failed to create table via RPC:', error)

    // Try using pg connection string instead
    console.log('\n Trying alternative method...')

    // Just try to query the table to see if it exists
    const { data, error: queryError } = await supabase
      .from('alias_catalog_items')
      .select('id')
      .limit(1)

    if (queryError && queryError.code === 'PGRST205') {
      console.error('❌ Table does not exist and cannot be created via API')
      console.log('\n💡 Please run this SQL manually in Supabase SQL Editor:')
      console.log(createTableSQL)
      process.exit(1)
    } else if (queryError) {
      console.error('❌ Error:', queryError)
    } else {
      console.log('✅ Table already exists!')
    }
  } else {
    console.log('✅ Table created successfully!')
  }
} catch (err) {
  console.error('❌ Error:', err)
}

// Verify table exists
console.log('\n🔍 Verifying table...')
const { data, error } = await supabase
  .from('alias_catalog_items')
  .select('id')
  .limit(1)

if (error) {
  console.error('❌ Table not accessible:', error.message)
  console.log('\n💡 You need to create the table manually. Run this in Supabase SQL Editor:')
  console.log(createTableSQL)
} else {
  console.log('✅ Table alias_catalog_items is accessible!')
}
