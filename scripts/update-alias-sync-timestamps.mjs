#!/usr/bin/env node

/**
 * Update last_sync_success_at for all inventory_alias_links
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateTimestamps() {
  console.log('\n=== UPDATING SYNC TIMESTAMPS FOR ALL ALIAS LINKS ===\n')

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('inventory_alias_links')
    .update({
      last_sync_success_at: now,
      last_sync_error: null
    })
    .eq('mapping_status', 'ok')
    .select()

  if (error) {
    console.error('Error updating timestamps:', error)
    return
  }

  console.log(`✓ Updated ${data?.length || 0} mappings with timestamp: ${now}`)
  console.log('\nAll Alias-mapped items should now appear in the Alias tab!')
}

updateTimestamps().catch(console.error)
