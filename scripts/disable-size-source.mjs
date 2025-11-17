#!/usr/bin/env node
/**
 * Disable Size? in release_sources_whitelist
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL')
  process.exit(1)
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function disableSizeSource() {
  console.log('🔍 Checking current status of Size? source...\n')

  // Check current status
  const { data: before, error: beforeError } = await supabase
    .from('release_sources_whitelist')
    .select('*')
    .eq('source_name', 'size')

  if (beforeError) {
    console.error('❌ Error checking source:', beforeError.message)
    process.exit(1)
  }

  if (!before || before.length === 0) {
    console.log('⚠️  Size? source not found in whitelist')
    console.log('   Nothing to disable.')
    return
  }

  const source = before[0]

  console.log('Current status:')
  console.log(`  - source_name: ${source.source_name}`)
  console.log(`  - enabled: ${source.enabled}`)
  console.log(`  - source_url: ${source.source_url}\n`)

  if (!source.enabled) {
    console.log('✅ Size? is already disabled. No changes needed.')
    return
  }

  // Disable the source
  console.log('⚙️  Disabling Size? source...\n')

  const { error: updateError } = await supabase
    .from('release_sources_whitelist')
    .update({ enabled: false })
    .eq('source_name', 'size')

  if (updateError) {
    console.error('❌ Error disabling source:', updateError.message)
    process.exit(1)
  }

  // Verify update
  const { data: after } = await supabase
    .from('release_sources_whitelist')
    .select('*')
    .eq('source_name', 'size')

  if (after && after.length > 0) {
    const updated = after[0]
    console.log('✅ Successfully disabled Size? source\n')
    console.log('Updated status:')
    console.log(`  - source_name: ${updated.source_name}`)
    console.log(`  - enabled: ${updated.enabled}`)
    console.log(`  - source_url: ${updated.source_url}\n`)
  }

  console.log('Reason: Size? launches page has no structured data available')
  console.log('        (no __NEXT_DATA__, JSON-LD, or embedded JSON)\n')
}

disableSizeSource().catch(error => {
  console.error('❌ Fatal error:', error.message)
  process.exit(1)
})
