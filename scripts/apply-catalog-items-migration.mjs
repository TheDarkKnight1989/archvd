#!/usr/bin/env node
/**
 * Apply alias_catalog_items migration
 */

import pg from 'pg'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'

dotenv.config({ path: '.env.local' })

const { Client } = pg

async function applyMigration() {
  console.log('Applying alias_catalog_items migration...\n')

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    await client.connect()
    console.log('✅ Connected to database')

    // Read the migration file
    const sql = readFileSync('supabase/migrations/20251125_alias_catalog_items.sql', 'utf8')

    // Execute the migration
    await client.query(sql)

    console.log('✅ Migration applied successfully!')
    console.log('\nCreated:')
    console.log('  - alias_catalog_items table')
    console.log('  - slug and SKU indexes')
    console.log('  - RLS policies')
    console.log('  - Auto-update trigger for updated_at')
  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      console.log('✅ Table already exists, skipping migration')
    } else {
      console.error('❌ Migration failed:', error)
      console.error('Error message:', error.message)
      console.error('Error code:', error.code)
      process.exit(1)
    }
  } finally {
    await client.end()
  }
}

applyMigration()
