#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
})

async function applyMigration() {
  console.log('\n🚀 Applying catalog_id column migration...\n')

  // Read migration SQL
  const migrationPath = join(__dirname, '../supabase/migrations/20251206_add_catalog_id_to_inventory.sql')
  const sql = readFileSync(migrationPath, 'utf8')

  console.log('📄 Migration SQL:')
  console.log(sql)
  console.log('\n⚙️  Executing...\n')

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // Try alternative approach: split by semicolon and execute each statement
      console.log('⚠️  exec_sql not available, trying direct execution...\n')

      const statements = sql.split(';').filter((s) => s.trim())

      for (const statement of statements) {
        if (!statement.trim()) continue

        console.log(`Executing: ${statement.trim().substring(0, 80)}...`)

        // Use the pg connection if available
        const DATABASE_URL = process.env.DATABASE_URL
        if (!DATABASE_URL) {
          throw new Error('DATABASE_URL not found - cannot execute raw SQL')
        }

        // Use node-postgres
        const { default: pg } = await import('pg')
        const pool = new pg.Pool({ connectionString: DATABASE_URL })

        try {
          await pool.query(statement)
          console.log('  ✅ Success')
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log('  ℹ️  Already exists, skipping')
          } else {
            throw err
          }
        } finally {
          await pool.end()
        }
      }

      console.log('\n✅ Migration applied successfully!\n')
    } else {
      console.log('✅ Migration applied successfully!')
      console.log('Data:', data)
    }
  } catch (err) {
    console.error('❌ Migration failed!')
    console.error(err)
    process.exit(1)
  }
}

applyMigration()
