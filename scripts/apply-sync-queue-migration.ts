#!/usr/bin/env node

/**
 * Apply the sync queue migration
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('🔄 Applying sync queue migration...\n')

  // Read migration file
  const migrationPath = join(process.cwd(), 'supabase/migrations/20251211_create_sync_queue_system.sql')
  const sql = readFileSync(migrationPath, 'utf-8')

  try {
    // Execute migration
    const { error } = await supabase.rpc('exec', { sql })

    if (error) {
      console.error('❌ Migration failed:', error.message)
      process.exit(1)
    }

    console.log('✅ Migration applied successfully!\n')

    // Verify table exists
    const { data, error: checkError } = await supabase
      .from('inventory_v4_sync_queue')
      .select('id')
      .limit(0)

    if (checkError) {
      console.error('⚠️  Table verification failed:', checkError.message)
    } else {
      console.log('✅ Table verified: inventory_v4_sync_queue exists\n')
    }

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

main()
