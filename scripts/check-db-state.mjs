#!/usr/bin/env node
/**
 * Check current database state for releases worker
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in environment')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function checkDatabase() {
  console.log('🔍 Checking database state...\n')

  // Check release_sources_whitelist
  console.log('1. Checking release_sources_whitelist table:')
  const { data: sources, error: sourcesError } = await supabase
    .from('release_sources_whitelist')
    .select('*')

  if (sourcesError) {
    console.log('   ❌ Error:', sourcesError.message)
  } else {
    console.log(`   ✓ Found ${sources?.length || 0} sources`)
    sources?.forEach(s => {
      console.log(`     - ${s.source_name || 'NULL'}: ${s.source_url || 'NULL'} (enabled: ${s.enabled})`)
    })
  }

  console.log('\n2. Checking releases table:')
  const { data: releases, error: releasesError } = await supabase
    .from('releases')
    .select('*')
    .limit(5)

  if (releasesError) {
    console.log('   ❌ Error:', releasesError.message)
  } else {
    console.log(`   ✓ Found ${releases?.length || 0} releases (showing max 5)`)
  }

  console.log('\n3. Checking product_catalog table:')
  const { data: products, error: productsError } = await supabase
    .from('product_catalog')
    .select('*')
    .limit(5)

  if (productsError) {
    console.log('   ❌ Error:', productsError.message)
  } else {
    console.log(`   ✓ Found ${products?.length || 0} products (showing max 5)`)
  }

  console.log('\n4. Checking worker_logs table:')
  const { data: logs, error: logsError } = await supabase
    .from('worker_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3)

  if (logsError) {
    console.log('   ❌ Error:', logsError.message)
  } else {
    console.log(`   ✓ Found ${logs?.length || 0} log entries (showing latest 3)`)
    logs?.forEach(log => {
      console.log(`     - ${log.worker_name}: ${log.status} at ${log.completed_at}`)
    })
  }

  console.log('\n✅ Database check complete')
}

checkDatabase().catch(console.error)
