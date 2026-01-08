import postgres from 'postgres'
import { readFileSync } from 'fs'
import 'dotenv/config'

async function main() {
  console.log('=== Applying V4 Sales Migration (Direct Postgres) ===\n')

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL not found in environment')
    process.exit(1)
  }

  // Create connection
  const sql = postgres(connectionString, {
    ssl: { rejectUnauthorized: false }
  })

  try {
    // Read migration SQL
    const migrationSql = readFileSync('supabase/migrations/20251222_create_inventory_v4_sales.sql', 'utf-8')

    console.log('Executing migration...\n')

    // Execute the full migration
    await sql.unsafe(migrationSql)

    console.log('✅ Migration executed successfully!\n')

    // Verify table exists
    console.log('Verifying table...')
    const result = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'inventory_v4_sales'
      ORDER BY ordinal_position
    `

    console.log(`\n✅ Table 'inventory_v4_sales' created with ${result.length} columns:\n`)
    for (const col of result) {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`)
    }

    // Check RLS is enabled
    const rlsResult = await sql`
      SELECT relrowsecurity
      FROM pg_class
      WHERE relname = 'inventory_v4_sales'
    `
    console.log(`\n✅ RLS enabled: ${rlsResult[0]?.relrowsecurity ? 'YES' : 'NO'}`)

    // Check policies
    const policiesResult = await sql`
      SELECT policyname
      FROM pg_policies
      WHERE tablename = 'inventory_v4_sales'
    `
    console.log(`✅ Policies: ${policiesResult.map(p => p.policyname).join(', ')}`)

  } catch (error: any) {
    console.error('Error executing migration:', error.message)
    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Some objects already exist. Checking current state...')

      // Check if table exists
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'inventory_v4_sales'
        )
      `

      if (tableExists[0]?.exists) {
        console.log('✅ Table inventory_v4_sales already exists!')
      }
    }
  } finally {
    await sql.end()
  }
}

main().catch(console.error)
