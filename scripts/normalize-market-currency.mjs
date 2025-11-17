#!/usr/bin/env node
/**
 * Normalize Market Currency Script
 *
 * WHY: Legacy market prices were stored in USD before currency support was added.
 *      This script converts all USD prices to the user's preferred currency (GBP).
 *
 * WHAT IT DOES:
 * 1. Finds all rows in stockx_market_prices where currency = 'USD'
 * 2. Converts prices to GBP using FX rate (0.79)
 * 3. Updates currency field to 'GBP'
 * 4. Preserves original values in meta field for audit trail
 *
 * SAFE TO RUN MULTIPLE TIMES: Uses WHERE currency='USD' to avoid re-converting
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!SUPABASE_URL)
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_KEY)
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// FX rates (same as in useInventoryV3)
const USD_TO_GBP = 0.79
const USD_TO_EUR = 0.92

// User's target currency (could fetch from profiles table in future)
const TARGET_CURRENCY = 'GBP'
const FX_RATE = USD_TO_GBP

async function normalizeMarketCurrency() {
  console.log('🔄 Normalizing market currency from USD to', TARGET_CURRENCY)
  console.log('   Using FX rate:', FX_RATE)
  console.log()

  // 1. Count USD rows
  const { count: totalUsdRows, error: countError } = await supabase
    .from('stockx_market_prices')
    .select('*', { count: 'exact', head: true })
    .eq('currency', 'USD')

  if (countError) {
    console.error('❌ Failed to count USD rows:', countError.message)
    process.exit(1)
  }

  console.log(`📊 Found ${totalUsdRows} rows with currency=USD`)

  if (totalUsdRows === 0) {
    console.log('✅ No rows to convert. All prices are already in target currency.')
    return
  }

  console.log()
  console.log('⚠️  This will convert all USD prices to GBP using rate:', FX_RATE)
  console.log('   Continue? (Ctrl+C to cancel, or wait 5 seconds to proceed)')
  console.log()

  await sleep(5000)

  // 2. Fetch all USD rows in batches
  let converted = 0
  let errors = 0
  const batchSize = 100
  let offset = 0

  while (offset < totalUsdRows) {
    console.log(`\n📦 Processing batch ${Math.floor(offset / batchSize) + 1}...`)

    const { data: usdRows, error: fetchError } = await supabase
      .from('stockx_market_prices')
      .select('*')
      .eq('currency', 'USD')
      .range(offset, offset + batchSize - 1)

    if (fetchError) {
      console.error('❌ Failed to fetch batch:', fetchError.message)
      errors += batchSize
      offset += batchSize
      continue
    }

    // 3. Convert each row
    for (const row of usdRows) {
      try {
        // Preserve original USD values in meta
        const originalMeta = row.meta || {}
        const updatedMeta = {
          ...originalMeta,
          original_usd_values: {
            currency: 'USD',
            lowest_ask: row.lowest_ask,
            highest_bid: row.highest_bid,
            last_sale: row.last_sale,
            converted_at: new Date().toISOString(),
            fx_rate: FX_RATE,
          },
        }

        // Convert prices
        const convertedData = {
          currency: TARGET_CURRENCY,
          lowest_ask: row.lowest_ask ? row.lowest_ask * FX_RATE : null,
          highest_bid: row.highest_bid ? row.highest_bid * FX_RATE : null,
          last_sale: row.last_sale ? row.last_sale * FX_RATE : null,
          meta: updatedMeta,
        }

        // Update row
        const { error: updateError } = await supabase
          .from('stockx_market_prices')
          .update(convertedData)
          .eq('id', row.id)

        if (updateError) {
          console.error(`  ❌ Failed to update row ${row.id}:`, updateError.message)
          errors++
        } else {
          converted++

          // Log sample conversions
          if (converted <= 5 || converted % 50 === 0) {
            console.log(`  ✓ ${row.sku}${row.size ? ':' + row.size : ''}`)
            console.log(`    USD: last_sale=$${row.last_sale || 'N/A'}, lowest_ask=$${row.lowest_ask || 'N/A'}`)
            console.log(`    GBP: last_sale=£${convertedData.last_sale?.toFixed(2) || 'N/A'}, lowest_ask=£${convertedData.lowest_ask?.toFixed(2) || 'N/A'}`)
          }
        }
      } catch (error) {
        console.error(`  ❌ Error converting row ${row.id}:`, error.message)
        errors++
      }
    }

    offset += batchSize

    // Progress
    const progress = Math.min(offset, totalUsdRows)
    console.log(`  Progress: ${progress}/${totalUsdRows} (${Math.round((progress / totalUsdRows) * 100)}%)`)

    // Rate limit
    if (offset < totalUsdRows) {
      await sleep(100)
    }
  }

  // 4. Summary
  console.log()
  console.log('═'.repeat(60))
  console.log('✅ Conversion complete!')
  console.log()
  console.log(`  Converted: ${converted} rows`)
  console.log(`  Errors: ${errors} rows`)
  console.log(`  FX Rate: USD→${TARGET_CURRENCY} @ ${FX_RATE}`)
  console.log()
  console.log('  Original USD values preserved in meta.original_usd_values')
  console.log('═'.repeat(60))

  // 5. Verify
  const { count: remainingUsd } = await supabase
    .from('stockx_market_prices')
    .select('*', { count: 'exact', head: true })
    .eq('currency', 'USD')

  if (remainingUsd > 0) {
    console.log()
    console.log(`⚠️  Warning: ${remainingUsd} rows still have currency=USD`)
    console.log('   This may be due to errors during conversion.')
  } else {
    console.log()
    console.log('✅ All USD prices successfully converted to', TARGET_CURRENCY)
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Run
normalizeMarketCurrency()
  .then(() => {
    console.log()
    console.log('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error()
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
