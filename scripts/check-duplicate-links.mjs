/**
 * Check Duplicate Links
 * Verify no duplicate inventory_market_links
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate market links...\n')

  // Get all links
  const { data: links, error } = await supabase
    .from('inventory_market_links')
    .select('inventory_id, provider')

  if (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  // Build map to check duplicates
  const linkMap = new Map()
  const duplicates = []

  links.forEach(link => {
    const key = `${link.inventory_id}:${link.provider}`
    if (linkMap.has(key)) {
      linkMap.set(key, linkMap.get(key) + 1)
    } else {
      linkMap.set(key, 1)
    }
  })

  linkMap.forEach((count, key) => {
    if (count > 1) {
      duplicates.push({ key, count })
    }
  })

  if (duplicates.length === 0) {
    console.log('✅ No duplicates found!')
    console.log(`   Total links: ${links.length}\n`)
  } else {
    console.log('⚠️  Found duplicates:')
    duplicates.forEach(dup => {
      console.log(`   • ${dup.key}: ${dup.count} copies`)
    })
    console.log()
    process.exit(1)
  }
}

checkDuplicates().catch(console.error)
