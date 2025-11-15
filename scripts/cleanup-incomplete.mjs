#!/usr/bin/env node

/**
 * Cleanup Incomplete Items Script
 *
 * Identifies and handles incomplete inventory items based on the following criteria:
 * - Missing brand, model, or image
 * - Listed items with no purchase total and no market data
 * - Items with no market link
 *
 * Usage:
 *   node scripts/cleanup-incomplete.mjs              # Dry run (shows what would be affected)
 *   node scripts/cleanup-incomplete.mjs --archive    # Archive incomplete items (set status='archived')
 *   node scripts/cleanup-incomplete.mjs --delete --confirm  # Hard delete (requires confirmation)
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Parse command line arguments
const args = process.argv.slice(2)
const isDryRun = !args.includes('--archive') && !args.includes('--delete')
const isArchive = args.includes('--archive')
const isDelete = args.includes('--delete')
const isConfirmed = args.includes('--confirm')

/**
 * Determine if an item is incomplete based on defined criteria
 */
function isIncomplete(item, marketLinks) {
  const reasons = []

  // 1. Missing critical product information
  if (!item.brand || !item.model) {
    reasons.push('missing_product_info')
  }

  if (!item.image_url) {
    reasons.push('missing_image')
  }

  // 2. Listed items with no value
  if (item.status === 'listed') {
    const purchaseTotal = item.purchase_total || item.purchase_price || 0
    const hasMarketData = item.market_value || item.custom_market_value

    if (purchaseTotal === 0 && !hasMarketData) {
      reasons.push('listed_no_value')
    }
  }

  // 3. No market link (for sneakers/apparel)
  const hasMarketLink = marketLinks.some(link => link.inventory_id === item.id)
  if (['sneaker', 'apparel', 'accessory'].includes(item.category?.toLowerCase()) && !hasMarketLink) {
    reasons.push('no_market_link')
  }

  return {
    isIncomplete: reasons.length > 0,
    reasons,
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Scanning for incomplete inventory items...\n')

  // Fetch all inventory items (excluding sold and archived)
  const { data: items, error: itemsError } = await supabase
    .from('Inventory')
    .select('*')
    .in('status', ['active', 'listed', 'worn'])

  if (itemsError) {
    console.error('❌ Failed to fetch inventory:', itemsError.message)
    process.exit(1)
  }

  // Fetch all market links
  const { data: marketLinks, error: linksError } = await supabase
    .from('inventory_market_links')
    .select('inventory_id, provider')

  if (linksError) {
    console.error('❌ Failed to fetch market links:', linksError.message)
    process.exit(1)
  }

  // Analyze items
  const incompleteItems = []
  const reasonCounts = {
    missing_product_info: 0,
    missing_image: 0,
    listed_no_value: 0,
    no_market_link: 0,
  }

  for (const item of items) {
    const result = isIncomplete(item, marketLinks)
    if (result.isIncomplete) {
      incompleteItems.push({ ...item, reasons: result.reasons })
      result.reasons.forEach(reason => {
        reasonCounts[reason]++
      })
    }
  }

  // Display results
  console.log(`📊 Analysis Results:`)
  console.log(`   Total inventory items: ${items.length}`)
  console.log(`   Incomplete items: ${incompleteItems.length}\n`)

  if (incompleteItems.length === 0) {
    console.log('✅ No incomplete items found!')
    return
  }

  console.log(`📋 Breakdown by reason:`)
  Object.entries(reasonCounts).forEach(([reason, count]) => {
    if (count > 0) {
      const label = reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      console.log(`   ${label}: ${count}`)
    }
  })
  console.log('')

  // Display sample items
  console.log(`📄 Sample incomplete items (first 5):`)
  incompleteItems.slice(0, 5).forEach((item, idx) => {
    console.log(`   ${idx + 1}. ${item.sku || item.id}`)
    console.log(`      Brand: ${item.brand || '(missing)'}`)
    console.log(`      Model: ${item.model || '(missing)'}`)
    console.log(`      Image: ${item.image_url ? '✓' : '✗'}`)
    console.log(`      Status: ${item.status}`)
    console.log(`      Reasons: ${item.reasons.join(', ')}`)
    console.log('')
  })

  // Take action based on flags
  if (isDryRun) {
    console.log('ℹ️  This was a dry run. No changes were made.')
    console.log('   Run with --archive to archive incomplete items')
    console.log('   Run with --delete --confirm to permanently delete')
    return
  }

  if (isArchive) {
    console.log(`📦 Archiving ${incompleteItems.length} incomplete items...`)

    const itemIds = incompleteItems.map(item => item.id)
    const { error: updateError } = await supabase
      .from('Inventory')
      .update({ status: 'archived' })
      .in('id', itemIds)

    if (updateError) {
      console.error('❌ Failed to archive items:', updateError.message)
      process.exit(1)
    }

    console.log('✅ Items archived successfully!')
    return
  }

  if (isDelete) {
    if (!isConfirmed) {
      console.log('⚠️  Delete requires --confirm flag to proceed')
      console.log('   This action is irreversible!')
      return
    }

    console.log(`🗑️  Deleting ${incompleteItems.length} incomplete items...`)

    const itemIds = incompleteItems.map(item => item.id)
    const { error: deleteError } = await supabase
      .from('Inventory')
      .delete()
      .in('id', itemIds)

    if (deleteError) {
      console.error('❌ Failed to delete items:', deleteError.message)
      process.exit(1)
    }

    console.log('✅ Items deleted successfully!')
    return
  }
}

// Run script
main().catch(error => {
  console.error('❌ Script failed:', error.message)
  process.exit(1)
})
