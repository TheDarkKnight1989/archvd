#!/usr/bin/env node
/**
 * StockX Batch Sync Script
 * Fetches market data + sales history for all owned sneakers
 * Usage: npm run sync:stockx
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

// ============================================================================
// Config
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STOCKX_ENABLED = process.env.NEXT_PUBLIC_STOCKX_ENABLE === 'true'
const STOCKX_MOCK_MODE = process.env.NEXT_PUBLIC_STOCKX_MOCK === 'true'

const BATCH_SIZE = 100
const RATE_LIMIT_DELAY_MS = 1000 // 1 second between batches
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!STOCKX_ENABLED) {
  console.log('⚠️  StockX is not enabled (NEXT_PUBLIC_STOCKX_ENABLE=false)')
  console.log('✓  Script completed (no-op)')
  process.exit(0)
}

// ============================================================================
// Supabase Client
// ============================================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// ============================================================================
// Mock Data Generator
// ============================================================================

function generateMockMarketData(sku, size) {
  const basePrice = 150 + Math.random() * 200

  return {
    sku,
    size,
    currency: 'USD',
    lowest_ask: basePrice + 20 + Math.random() * 10,
    highest_bid: basePrice - 10 - Math.random() * 5,
    last_sale: basePrice + Math.random() * 10 - 5,
    average_price: basePrice,
    volatility: Math.random() * 0.2,
    sales_last_72h: Math.floor(Math.random() * 50),
    as_of: new Date().toISOString(),
    source: 'stockx',
  }
}

function generateMockSalesHistory(sku, size, days = 7) {
  const basePrice = 150 + Math.random() * 200
  const sales = []

  for (let i = 0; i < days; i++) {
    const daysAgo = i
    const salePrice = basePrice + (Math.random() - 0.5) * 50

    sales.push({
      sku,
      size,
      currency: 'USD',
      sale_price: salePrice,
      sold_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    })
  }

  return sales.reverse()
}

// ============================================================================
// Fetch StockX Data (with retries)
// ============================================================================

async function fetchStockXMarketData(sku, size) {
  // Mock mode - return mock data
  if (STOCKX_MOCK_MODE) {
    return {
      market: generateMockMarketData(sku, size),
      sales: generateMockSalesHistory(sku, size, 7),
    }
  }

  // Real mode - call our API endpoints
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Fetch market data
      const marketRes = await fetch(
        `${SUPABASE_URL}/api/stockx/products/${encodeURIComponent(sku)}/market?currency=USD`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!marketRes.ok) {
        if (marketRes.status === 404) {
          // Product not found - skip
          return null
        }
        throw new Error(`Market fetch failed: ${marketRes.status}`)
      }

      const marketData = await marketRes.json()

      // Find the variant for this size
      const variant = marketData.variants?.find((v) => v.size === size)
      if (!variant) {
        return null
      }

      return {
        market: {
          sku,
          size,
          currency: marketData.currency || 'USD',
          lowest_ask: variant.lowestAsk,
          highest_bid: variant.highestBid,
          last_sale: variant.lastSale,
          as_of: marketData.asOf,
          source: 'stockx',
        },
        sales: [], // Sales history not included in market endpoint
      }
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES - 1
      if (isLastAttempt) {
        console.error(`❌ Failed to fetch ${sku} size ${size} after ${MAX_RETRIES} attempts:`, error.message)
        return null
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt)))
    }
  }

  return null
}

// ============================================================================
// Main Sync Logic
// ============================================================================

async function main() {
  const startTime = Date.now()
  console.log('🚀 StockX Sync Started')
  console.log(`📍 Mode: ${STOCKX_MOCK_MODE ? 'MOCK' : 'LIVE'}`)
  console.log('')

  // Step 1: Fetch all distinct (SKU, size) pairs from inventory
  console.log('📦 Fetching owned sneakers from inventory...')
  const { data: inventoryItems, error: inventoryError } = await supabase
    .from('Inventory')
    .select('sku, size, category')
    .eq('category', 'sneaker')
    .in('status', ['active', 'listed', 'worn'])

  if (inventoryError) {
    console.error('❌ Failed to fetch inventory:', inventoryError)
    process.exit(1)
  }

  // Get unique (sku, size) combinations
  const uniquePairs = new Map()
  inventoryItems?.forEach((item) => {
    const key = `${item.sku}:${item.size}`
    if (!uniquePairs.has(key)) {
      uniquePairs.set(key, { sku: item.sku, size: item.size })
    }
  })

  const totalPairs = uniquePairs.size
  console.log(`✓ Found ${totalPairs} unique (SKU, size) pairs`)
  console.log('')

  if (totalPairs === 0) {
    console.log('✓ No sneakers to sync')
    process.exit(0)
  }

  // Step 2: Process in batches
  const pairs = Array.from(uniquePairs.values())
  let processedCount = 0
  let fetchedCount = 0
  let skippedCount = 0
  let upsertedPrices = 0
  let upsertedSales = 0

  console.log(`📊 Processing ${totalPairs} items in batches of ${BATCH_SIZE}...`)
  console.log('')

  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    const batch = pairs.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(pairs.length / BATCH_SIZE)

    console.log(`🔄 Batch ${batchNum}/${totalBatches} (${batch.length} items)`)

    // Fetch data for all items in batch (parallel)
    const results = await Promise.all(
      batch.map(async ({ sku, size }) => {
        const data = await fetchStockXMarketData(sku, size)
        return { sku, size, data }
      })
    )

    // Upsert market prices
    const priceRecords = []
    const salesRecords = []

    results.forEach(({ sku, size, data }) => {
      processedCount++

      if (!data) {
        skippedCount++
        return
      }

      fetchedCount++

      if (data.market) {
        priceRecords.push(data.market)
      }

      if (data.sales && data.sales.length > 0) {
        salesRecords.push(...data.sales)
      }
    })

    // Insert market prices
    if (priceRecords.length > 0) {
      const { error: priceError } = await supabase
        .from('stockx_market_prices')
        .insert(priceRecords)

      if (priceError) {
        console.error('⚠️  Error inserting prices:', priceError.message)
      } else {
        upsertedPrices += priceRecords.length
      }
    }

    // Insert sales history
    if (salesRecords.length > 0) {
      const { error: salesError } = await supabase
        .from('stockx_sales')
        .insert(salesRecords)

      if (salesError) {
        console.error('⚠️  Error inserting sales:', salesError.message)
      } else {
        upsertedSales += salesRecords.length
      }
    }

    console.log(`  ✓ Processed: ${processedCount}/${totalPairs} | Fetched: ${fetchedCount} | Skipped: ${skippedCount}`)
    console.log('')

    // Rate limit delay between batches
    if (i + BATCH_SIZE < pairs.length) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS))
    }
  }

  const duration = Date.now() - startTime

  // Step 3: Summary
  console.log('📈 Sync Summary')
  console.log('─'.repeat(60))
  console.log(`  Total pairs:       ${totalPairs}`)
  console.log(`  Processed:         ${processedCount}`)
  console.log(`  Fetched:           ${fetchedCount}`)
  console.log(`  Skipped:           ${skippedCount}`)
  console.log(`  Prices upserted:   ${upsertedPrices}`)
  console.log(`  Sales upserted:    ${upsertedSales}`)
  console.log(`  Duration:          ${(duration / 1000).toFixed(2)}s`)
  console.log('─'.repeat(60))
  console.log('')

  console.log('✅ StockX Sync Complete')
}

// ============================================================================
// Run
// ============================================================================

main().catch((error) => {
  console.error('❌ Sync failed:', error)
  process.exit(1)
})
