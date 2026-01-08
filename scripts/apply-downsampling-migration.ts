#!/usr/bin/env npx tsx
/**
 * Apply Data Retention/Downsampling Migration
 * Executes the SQL migration directly using postgres client
 */

import { readFileSync } from 'fs'
import pg from 'pg'

const { Client } = pg

async function main() {
  console.log('📦 Applying downsampling migration...\n')

  // Read migration file
  const migrationSQL = readFileSync(
    'supabase/migrations/20251207_add_data_retention_policy.sql',
    'utf-8'
  )

  // Build Supabase PostgreSQL connection string
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Extract project ref from URL (e.g., https://cjoucwhhwhpippksytoi.supabase.co)
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

  if (!projectRef) {
    throw new Error('Could not extract project ref from NEXT_PUBLIC_SUPABASE_URL')
  }

  // Supabase direct connection (port 5432, not pooler)
  const connectionString = `postgresql://postgres:${serviceRoleKey}@db.${projectRef}.supabase.co:5432/postgres`

  console.log(`Connecting to project: ${projectRef}`)
  console.log(`Host: db.${projectRef}.supabase.co\n`)

  // Connect to database
  const client = new Client({
    connectionString,
  })

  try {
    await client.connect()
    console.log('✅ Connected to database\n')

    // Execute the full migration
    console.log('Running migration SQL...')
    await client.query(migrationSQL)

    console.log('\n✅ Migration applied successfully!\n')
    console.log('Created:')
    console.log('  - master_market_data_daily table')
    console.log('  - master_market_data_weekly table')
    console.log('  - downsample_to_daily() function')
    console.log('  - downsample_to_weekly() function')
    console.log('')

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message)
    throw error
  } finally {
    await client.end()
  }
}

main().catch(console.error)
