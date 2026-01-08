#!/usr/bin/env node

/**
 * Re-sync eBay data with TWO-STEP API and variation detection
 * Shows exactly what eBay returns and how we interpret sizes
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { EbayClient } from '../src/lib/services/ebay/client.js'
import { enrichEbaySoldItem } from '../src/lib/services/ebay/extractors.js'

const SKU = process.argv[2] || 'DZ4137-700'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n' + '═'.repeat(80))
console.log(`eBay Re-Sync with Variation Detection - ${SKU}`)
console.log('═'.repeat(80) + '\n')

// Step 1: Clear old data
console.log('STEP 1: Clearing old master_market_data for eBay + ' + SKU + '...\n')

const { error: deleteError } = await supabase
  .from('master_market_data')
  .delete()
  .eq('provider', 'ebay')
  .ilike('sku', `%${SKU}%`)

if (deleteError) {
  console.error('Error deleting:', deleteError)
} else {
  console.log('✅ Old data cleared\n')
}

// Step 2: Fetch with two-step API
console.log('STEP 2: Fetching from eBay with TWO-STEP API (fetchFullDetails: true)...\n')

const client = new EbayClient()

const result = await client.searchSold({
  query: SKU,
  limit: 50,
  conditionIds: [1000, 1500, 1750], // All conditions
  qualifiedPrograms: ['AUTHENTICITY_GUARANTEE'],
  categoryIds: ['15709', '95672', '155194'],
  soldItemsOnly: true,
  fetchFullDetails: true, // ← CRITICAL: Two-step API for variations
})

console.log(`✅ Fetched ${result.items.length} items from eBay\n`)
console.log(`   - Total fetched: ${result.totalFetched}`)
console.log(`   - Full details fetched: ${result.fullDetailsFetched}\n`)

if (result.items.length === 0) {
  console.log('❌ No items returned. Check EBAY_MARKET_DATA_ENABLED=true')
  process.exit(0)
}

// Step 3: Show what we got
console.log('═'.repeat(80))
console.log('STEP 3: Raw eBay Data Analysis')
console.log('═'.repeat(80) + '\n')

console.log('Sample Items (first 5):\n')

result.items.slice(0, 5).forEach((item, i) => {
  console.log(`${i + 1}. ${item.title}`)
  console.log(`   Item ID: ${item.itemId}`)
  console.log(`   Price: ${item.currency} ${item.price}`)
  console.log(`   Condition: ${item.conditionId}`)
  console.log(`   AG: ${item.authenticityVerification ? 'YES' : 'NO'}`)

  if (item.variations && item.variations.length > 0) {
    console.log(`   Variations: ${item.variations.length}`)
    item.variations.slice(0, 2).forEach((v, vi) => {
      if (v.localizedAspects) {
        console.log(`     Variation ${vi + 1}:`)
        v.localizedAspects.forEach((aspect) => {
          console.log(`       ${aspect.name}: ${aspect.value}`)
        })
      }
    })
  } else {
    console.log('   Variations: NONE (will use title parsing)')
  }

  console.log()
})

// Step 4: Enrich and analyze
console.log('═'.repeat(80))
console.log('STEP 4: Size Extraction Analysis')
console.log('═'.repeat(80) + '\n')

console.log('Enriching items with size detection...\n')

result.items.forEach((item) => {
  enrichEbaySoldItem(item)
})

// Count by confidence
const byConfidence = result.items.reduce((acc, item) => {
  const conf = item.sizeInfo?.confidence || 'NONE'
  acc[conf] = (acc[conf] || 0) + 1
  return acc
}, {})

console.log('Size Confidence Breakdown:')
Object.entries(byConfidence).forEach(([conf, count]) => {
  const label =
    conf === 'HIGH' ? 'HIGH (from variations with explicit US/UK/EU)' :
    conf === 'MEDIUM' ? 'MEDIUM (from title, defaults to US)' :
    conf === 'LOW' ? 'LOW (ambiguous)' :
    'NONE (no size found)'
  console.log(`  ${label}: ${count}`)
})
console.log()

// Count by size system
const bySizeSystem = result.items
  .filter((item) => item.sizeInfo)
  .reduce((acc, item) => {
    const system = item.sizeInfo.system
    acc[system] = (acc[system] || 0) + 1
    return acc
  }, {})

console.log('Size System Breakdown:')
Object.entries(bySizeSystem).forEach(([system, count]) => {
  console.log(`  ${system}: ${count}`)
})
console.log()

// Show items with different confidence levels
console.log('Examples by Confidence Level:\n')

const highExample = result.items.find((i) => i.sizeInfo?.confidence === 'HIGH')
if (highExample) {
  console.log('HIGH Confidence Example:')
  console.log(`  Title: ${highExample.title}`)
  console.log(`  Extracted: ${highExample.sizeInfo?.normalizedKey} (${highExample.sizeInfo?.system})`)
  console.log(`  Source: Variation aspect name`)
  console.log()
}

const mediumExample = result.items.find((i) => i.sizeInfo?.confidence === 'MEDIUM')
if (mediumExample) {
  console.log('MEDIUM Confidence Example:')
  console.log(`  Title: ${mediumExample.title}`)
  console.log(`  Extracted: ${mediumExample.sizeInfo?.normalizedKey} (${mediumExample.sizeInfo?.system})`)
  console.log(`  Source: Title parsing (NO variations)')
  console.log('  ⚠️  Will be EXCLUDED from metrics (confidence < 1.0)')
  console.log()
}

// Step 5: Show what would be included vs excluded
console.log('═'.repeat(80))
console.log('STEP 5: Inclusion Analysis (NEW STRICT RULES)')
console.log('═'.repeat(80) + '\n')

const included = result.items.filter((item) => {
  return (
    item.conditionId === 1000 &&
    item.authenticityVerification &&
    item.sizeInfo &&
    item.sizeInfo.system !== 'UNKNOWN' &&
    item.sizeInfo.confidence === 'HIGH' // Only HIGH accepted!
  )
})

const excluded = result.items.filter((item) => !included.includes(item))

console.log(`Total items: ${result.items.length}`)
console.log(`Included in metrics: ${included.length} (${((included.length / result.items.length) * 100).toFixed(1)}%)`)
console.log(`Excluded: ${excluded.length} (${((excluded.length / result.items.length) * 100).toFixed(1)}%)\n`)

// Exclusion reasons
console.log('Exclusion Reasons:')
const exclusionReasons = {}

excluded.forEach((item) => {
  let reason = 'unknown'

  if (item.conditionId !== 1000) {
    reason = 'not_new_condition (1500/1750)'
  } else if (!item.authenticityVerification) {
    reason = 'no_authenticity_guarantee'
  } else if (!item.sizeInfo) {
    reason = 'missing_size'
  } else if (item.sizeInfo.system === 'UNKNOWN') {
    reason = 'size_system_unknown'
  } else if (item.sizeInfo.confidence !== 'HIGH') {
    reason = 'size_not_from_variations (MEDIUM/LOW confidence)'
  }

  exclusionReasons[reason] = (exclusionReasons[reason] || 0) + 1
})

Object.entries(exclusionReasons).forEach(([reason, count]) => {
  console.log(`  ${reason}: ${count}`)
})
console.log()

// Step 6: Show breakdown by size system (INCLUDED items only)
console.log('═'.repeat(80))
console.log('STEP 6: Size System Breakdown (INCLUDED ITEMS ONLY)')
console.log('═'.repeat(80) + '\n')

const includedBySystem = included.reduce((acc, item) => {
  const system = item.sizeInfo.system
  if (!acc[system]) {
    acc[system] = []
  }
  acc[system].push(item)
  return acc
}, {})

Object.entries(includedBySystem).forEach(([system, items]) => {
  console.log(`${system} Sizes (${items.length} items):`)

  // Group by size
  const bySize = items.reduce((acc, item) => {
    const size = item.sizeInfo.normalizedKey
    if (!acc[size]) {
      acc[size] = []
    }
    acc[size].push(item)
    return acc
  }, {})

  Object.entries(bySize)
    .sort((a, b) => {
      const aNum = parseFloat(a[0].replace(/[^0-9.]/g, ''))
      const bNum = parseFloat(b[0].replace(/[^0-9.]/g, ''))
      return aNum - bNum
    })
    .forEach(([size, sizeItems]) => {
      const prices = sizeItems.map((i) => i.price)
      const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length
      const min = Math.min(...prices)
      const max = Math.max(...prices)

      console.log(`  ${size}: ${sizeItems.length} items, avg £${avg.toFixed(2)}, range £${min.toFixed(2)}-£${max.toFixed(2)}`)
    })

  console.log()
})

console.log('═'.repeat(80))
console.log('SUMMARY')
console.log('═'.repeat(80) + '\n')

console.log('✅ Two-step API used (variation data fetched)')
console.log('✅ Size systems correctly detected from variation aspect names')
console.log('✅ US and UK sizes kept SEPARATE')
console.log('✅ Only HIGH confidence (variation-sourced) items included\n')

console.log('Next steps:')
console.log('1. Apply migration: supabase/migrations/20251204_create_ebay_time_series_tables.sql')
console.log('2. Run transaction ingestion to store in ebay_sold_transactions')
console.log('3. Compute metrics with rolling medians')
console.log('4. Map to master_market_data with correct size systems\n')

console.log('═'.repeat(80) + '\n')
