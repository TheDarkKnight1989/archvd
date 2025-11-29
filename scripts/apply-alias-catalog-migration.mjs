import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

// Read the migration SQL
const migrationFile = join(__dirname, '../supabase/migrations/20251125_alias_catalog_items.sql')
const sql = fs.readFileSync(migrationFile, 'utf8')

console.log('🔄 Applying alias_catalog_items migration...\n')

// Use direct fetch to Supabase REST API
const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  },
  body: JSON.stringify({ sql })
})

if (!response.ok) {
  const error = await response.text()

  // Check if it's because exec_sql doesn't exist
  if (error.includes('exec_sql')) {
    console.log('⚠️  exec_sql RPC not available, using Supabase client...\n')

    // Try using raw SQL via Postgres connection
    // This is a workaround - split into individual CREATE statements
    const statements = [
      `CREATE TABLE IF NOT EXISTS alias_catalog_items (
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
      );`,
      `CREATE INDEX IF NOT EXISTS idx_alias_catalog_items_slug ON alias_catalog_items(slug);`,
      `CREATE INDEX IF NOT EXISTS idx_alias_catalog_items_sku ON alias_catalog_items(sku);`,
      `ALTER TABLE alias_catalog_items ENABLE ROW LEVEL SECURITY;`,
    ]

    console.log('📊 Executing SQL statements via direct connection...\n')

    // Import postgres client
    const { default: postgres } = await import('postgres')

    // Get DATABASE_URL from env
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      console.error('❌ DATABASE_URL not found in environment')
      process.exit(1)
    }

    const sql = postgres(databaseUrl, { max: 1 })

    try {
      for (let i = 0; i < statements.length; i++) {
        console.log(`  ${i + 1}/${statements.length} Executing...`)
        await sql.unsafe(statements[i])
        console.log(`  ✅ Statement ${i + 1} completed`)
      }

      console.log('\n✅ Migration completed successfully!')

      // Verify table exists
      const result = await sql`SELECT COUNT(*) FROM alias_catalog_items`
      console.log(`\n✅ Table verified: alias_catalog_items exists (${result[0].count} rows)`)

    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('\n✅ Table already exists!')
      } else {
        console.error('\n❌ Error:', err.message)
        process.exit(1)
      }
    } finally {
      await sql.end()
    }

  } else {
    console.error('❌ Failed to apply migration:', error)
    process.exit(1)
  }
} else {
  console.log('✅ Migration applied successfully!')
}

// Verify using Supabase client
const supabase = createClient(supabaseUrl, supabaseKey)
const { data, error } = await supabase
  .from('alias_catalog_items')
  .select('id')
  .limit(1)

if (error) {
  console.error('\n❌ Table verification failed:', error.message)
} else {
  console.log('\n✅ Table is now accessible via Supabase client!')
}
