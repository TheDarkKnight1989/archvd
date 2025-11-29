#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkAliasData() {
  console.log('=== CHECKING ALIAS DATA ===\n')

  // Check inventory_alias_links
  const { data: aliasLinks, error: linksError } = await supabase
    .from('inventory_alias_links')
    .select('*')
    .limit(10)

  console.log('inventory_alias_links:', {
    count: aliasLinks?.length || 0,
    error: linksError,
    data: aliasLinks
  })

  // Check alias_market_snapshots
  const { data: snapshots, error: snapshotsError } = await supabase
    .from('alias_market_snapshots')
    .select('*')
    .limit(10)

  console.log('\nalias_market_snapshots:', {
    count: snapshots?.length || 0,
    error: snapshotsError,
    data: snapshots
  })

  // Check specific mapping for debugging
  if (aliasLinks && aliasLinks.length > 0) {
    const firstLink = aliasLinks[0]
    console.log('\n=== DETAILED CHECK FOR FIRST ITEM ===')
    console.log('Mapping:', firstLink)

    // Try to find snapshot
    const { data: matchingSnapshots, error: snapshotError } = await supabase
      .from('alias_market_snapshots')
      .select('*')
      .eq('catalog_id', firstLink.alias_catalog_id)

    console.log('Matching snapshots:', {
      count: matchingSnapshots?.length || 0,
      error: snapshotError,
      data: matchingSnapshots
    })
  }
}

checkAliasData()
