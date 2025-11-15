#!/usr/bin/env node

/**
 * Seed Market Bridge
 * Populates realistic 7-day price series for owned/watchlisted SKUs
 * Enables search and sparklines before live provider sync is running
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Generate random walk price series (7 days)
 * @param {number} basePrice - Starting price
 * @param {string} currency - Currency code
 * @returns {Array} Array of {day, price} objects
 */
function generatePriceSeries(basePrice, currency) {
  const series = []
  let currentPrice = basePrice

  // Generate 7 days of data (today going backwards)
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    date.setHours(12, 0, 0, 0) // Noon UTC

    // Random walk: ±1-3% with 30-60bp noise
    const percentChange = (Math.random() * 4 - 2) / 100 // ±2% range
    const noise = (Math.random() * 0.006 - 0.003) // ±0.3% noise
    const totalChange = percentChange + noise

    currentPrice = currentPrice * (1 + totalChange)

    series.push({
      day: date.toISOString(),
      price: Math.round(currentPrice * 100) / 100 // Round to 2 decimals
    })
  }

  return series
}

/**
 * Parse product info from SKU/item
 * @param {object} item - Inventory or watchlist item
 * @returns {object} Product metadata
 */
function extractProductInfo(item) {
  return {
    brand: item.brand || null,
    model: item.model || null,
    colorway: item.colorway || null,
    sku: item.sku,
    imageUrl: item.image_url || null
  }
}

async function seedMarketBridge() {
  console.log('🌱 Starting market data seed bridge...\n')

  let insertedProducts = 0
  let insertedPrices = 0
  let skippedRecent = 0
  let errors = 0

  try {
    // 1. Get unique SKUs from Inventory (active + sold)
    console.log('📦 Reading SKUs from Inventory...')
    const { data: inventoryItems, error: invError } = await supabase
      .from('Inventory')
      .select('sku, brand, model, colorway, size_uk, purchase_price, purchase_currency, image_url')
      .in('status', ['active', 'listed', 'sold'])
      .not('sku', 'is', null)

    if (invError) {
      console.error('❌ Error reading Inventory:', invError.message)
      throw invError
    }

    console.log(`   Found ${inventoryItems?.length || 0} inventory items`)

    // 2. Get unique SKUs from watchlist_items
    console.log('👁️  Reading SKUs from watchlists...')
    const { data: watchlistItems, error: watchError } = await supabase
      .from('watchlist_items')
      .select('sku, size')
      .not('sku', 'is', null)

    if (watchError) {
      console.error('❌ Error reading watchlists:', watchError.message)
      throw watchError
    }

    console.log(`   Found ${watchlistItems?.length || 0} watchlist items\n`)

    // 3. Combine and deduplicate by SKU
    const allItems = [...(inventoryItems || []), ...(watchlistItems || [])]
    const skuMap = new Map()

    allItems.forEach(item => {
      if (!skuMap.has(item.sku)) {
        skuMap.set(item.sku, item)
      }
    })

    console.log(`🎯 Processing ${skuMap.size} unique SKUs...\n`)

    // 4. Check for existing recent provider prices (≤ 3 days)
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const { data: recentPrices, error: recentError } = await supabase
      .from('market_prices')
      .select('sku, provider')
      .in('sku', Array.from(skuMap.keys()))
      .neq('provider', 'seed')
      .gte('as_of', threeDaysAgo.toISOString())

    if (recentError) {
      console.error('⚠️  Warning: Could not check recent prices:', recentError.message)
    }

    const recentSkus = new Set(recentPrices?.map(p => p.sku) || [])
    console.log(`   ${recentSkus.size} SKUs have recent provider data (will skip)\n`)

    // 5. Process each SKU
    for (const [sku, item] of skuMap.entries()) {
      try {
        // Skip if has recent provider data
        if (recentSkus.has(sku)) {
          skippedRecent++
          continue
        }

        const productInfo = extractProductInfo(item)

        // Determine base price and currency
        let basePrice = item.purchase_price || 100 // Default to 100 if no price
        let currency = item.purchase_currency || 'GBP'

        // For watchlist items, use a reasonable default
        if (!item.purchase_price) {
          basePrice = 150 // Default market price for seeded items
        }

        // 5a. Upsert to market_products
        const { data: existingProduct } = await supabase
          .from('market_products')
          .select('id')
          .eq('provider', 'seed')
          .eq('sku', sku)
          .single()

        if (!existingProduct) {
          const { error: productError } = await supabase
            .from('market_products')
            .insert({
              provider: 'seed',
              provider_product_id: `seed-${sku}`,
              brand: productInfo.brand,
              model: productInfo.model,
              colorway: productInfo.colorway,
              sku: sku,
              slug: sku.toLowerCase().replace(/\s+/g, '-'),
              image_url: productInfo.imageUrl,
              meta: { source: 'seed-bridge' }
            })

          if (productError) {
            console.error(`   ❌ Error inserting product ${sku}:`, productError.message)
            errors++
            continue
          }

          insertedProducts++
        }

        // 5b. Generate and insert 7-day price series
        const series = generatePriceSeries(basePrice, currency)
        const sizeUk = item.size_uk || null

        const priceRows = series.map(point => ({
          provider: 'seed',
          sku: sku,
          size_uk: sizeUk,
          currency: currency,
          last_sale: point.price,
          ask: point.price * 1.05, // Ask slightly higher
          bid: point.price * 0.95, // Bid slightly lower
          as_of: point.day,
          meta: { source: 'seed-bridge' }
        }))

        const { error: pricesError } = await supabase
          .from('market_prices')
          .insert(priceRows)

        if (pricesError) {
          console.error(`   ❌ Error inserting prices for ${sku}:`, pricesError.message)
          errors++
          continue
        }

        insertedPrices += priceRows.length

      } catch (err) {
        console.error(`   ❌ Error processing ${sku}:`, err.message)
        errors++
      }
    }

    // 6. Refresh materialized views
    console.log('\n🔄 Refreshing materialized views...')
    const { error: refreshError } = await supabase.rpc('refresh_all_market_mvs')

    if (refreshError) {
      console.error('⚠️  Warning: Could not refresh MVs:', refreshError.message)
      console.log('   Run manually: npm run refresh:mvs\n')
    } else {
      console.log('✅ Materialized views refreshed\n')
    }

    // 7. Summary
    console.log('═══════════════════════════════════════')
    console.log('📊 Seed Bridge Summary')
    console.log('═══════════════════════════════════════')
    console.log(`Total SKUs processed:      ${skuMap.size}`)
    console.log(`Products inserted:         ${insertedProducts}`)
    console.log(`Price points inserted:     ${insertedPrices}`)
    console.log(`Skipped (recent data):     ${skippedRecent}`)
    console.log(`Errors:                    ${errors}`)
    console.log('═══════════════════════════════════════\n')

    if (errors > 0) {
      console.log('⚠️  Completed with errors (see above)')
      process.exit(1)
    } else {
      console.log('✨ Seed bridge completed successfully!')
    }

  } catch (error) {
    console.error('\n❌ Seed bridge failed:', error)
    process.exit(1)
  }
}

seedMarketBridge()
