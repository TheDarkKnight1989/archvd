#!/usr/bin/env tsx

/**
 * Sneaker Market Mock Seed Script
 *
 * Seeds mock sneaker market data for development:
 * - 10-15 popular sneaker SKUs in product_catalog
 * - 7-30 days of mock price history per SKU/size
 * - Refreshes sneaker_price_daily_medians materialized view
 *
 * Usage: npm run seed:sneakers
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
 * Popular sneakers for mock data
 */
const POPULAR_SNEAKERS = [
  {
    sku: 'DZ5485-410',
    brand: 'Nike',
    model: 'Dunk Low Retro',
    colorway: 'University Blue',
    retail_price: 100,
    retail_currency: 'GBP',
    image_url: null,
  },
  {
    sku: 'DD1391-100',
    brand: 'Nike',
    model: 'Dunk Low Retro',
    colorway: 'Panda',
    retail_price: 95,
    retail_currency: 'GBP',
    image_url: null,
  },
  {
    sku: 'M990GL6',
    brand: 'New Balance',
    model: '990v6',
    colorway: 'Grey',
    retail_price: 180,
    retail_currency: 'GBP',
    image_url: null,
  },
  {
    sku: 'GW3773',
    brand: 'Adidas',
    model: 'Yeezy Boost 350 V2',
    colorway: 'Bone',
    retail_price: 190,
    retail_currency: 'GBP',
    image_url: null,
  },
  {
    sku: '555088-134',
    brand: 'Nike',
    model: 'Air Jordan 1 Retro High OG',
    colorway: 'University Blue',
    retail_price: 160,
    retail_currency: 'GBP',
    image_url: null,
  },
  {
    sku: '1201A789-250',
    brand: 'Asics',
    model: 'Gel-Kayano 14',
    colorway: 'Cream/Pure Silver',
    retail_price: 130,
    retail_currency: 'GBP',
    image_url: null,
  },
  {
    sku: 'DN8014-100',
    brand: 'Nike',
    model: 'Air Max 1',
    colorway: 'White/University Red',
    retail_price: 115,
    retail_currency: 'GBP',
    image_url: null,
  },
  {
    sku: 'M2002RDA',
    brand: 'New Balance',
    model: '2002R',
    colorway: 'Rain Cloud',
    retail_price: 140,
    retail_currency: 'GBP',
    image_url: null,
  },
  {
    sku: 'L47452100',
    brand: 'Salomon',
    model: 'XT-6',
    colorway: 'Vanilla Ice/Lunar Rock',
    retail_price: 165,
    retail_currency: 'GBP',
    image_url: null,
  },
  {
    sku: '1123202-BWHT',
    brand: 'Hoka',
    model: 'Clifton 9',
    colorway: 'Black/White',
    retail_price: 140,
    retail_currency: 'GBP',
    image_url: null,
  },
  {
    sku: 'FZ5897-100',
    brand: 'Nike',
    model: 'Air Jordan 4 Retro',
    colorway: 'Military Black',
    retail_price: 170,
    retail_currency: 'GBP',
    image_url: null,
  },
  {
    sku: 'FB2207-200',
    brand: 'Nike',
    model: 'Air Jordan 1 Low',
    colorway: 'Mocha',
    retail_price: 105,
    retail_currency: 'GBP',
    image_url: null,
  },
  {
    sku: 'ML574EVG',
    brand: 'New Balance',
    model: '574',
    colorway: 'Grey/Green',
    retail_price: 85,
    retail_currency: 'GBP',
    image_url: null,
  },
  {
    sku: 'IE3012',
    brand: 'Adidas',
    model: 'Samba OG',
    colorway: 'Cloud White/Core Black',
    retail_price: 90,
    retail_currency: 'GBP',
    image_url: null,
  },
  {
    sku: 'A06525C',
    brand: 'Converse',
    model: 'Chuck Taylor All Star Low',
    colorway: 'Black',
    retail_price: 55,
    retail_currency: 'GBP',
    image_url: null,
  },
]

/**
 * Common UK sneaker sizes
 */
const UK_SIZES = ['UK6', 'UK7', 'UK8', 'UK8.5', 'UK9', 'UK9.5', 'UK10', 'UK10.5', 'UK11', 'UK12']

/**
 * Generate mock price series with realistic variance
 */
function generatePriceSeries(
  basePrice: number,
  days: number = 30,
  trend: 'up' | 'down' | 'flat' = 'up',
  variance = 0.05
) {
  const prices: { date: Date; price: number }[] = []
  const today = new Date()
  let currentPrice = basePrice

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)

    // Apply trend
    if (trend === 'up') {
      currentPrice *= 1 + Math.random() * 0.015 // Slight upward drift
    } else if (trend === 'down') {
      currentPrice *= 1 - Math.random() * 0.015 // Slight downward drift
    }

    // Add random variance
    const randomFactor = 1 + (Math.random() * variance * 2 - variance)
    const price = Math.round(currentPrice * randomFactor * 100) / 100

    prices.push({
      date,
      price: Math.max(price, basePrice * 0.7), // Floor at 70% of base
    })
  }

  return prices
}

/**
 * Determine market multiplier based on brand/model hype
 */
function getMarketMultiplier(brand: string, model: string): number {
  // Jordan and Yeezy typically trade above retail
  if (model.includes('Jordan') || model.includes('Yeezy')) {
    return 1.2 + Math.random() * 0.5 // 1.2x - 1.7x retail
  }
  // New Balance and Asics have moderate resale
  if (brand === 'New Balance' || brand === 'Asics' || brand === 'Salomon') {
    return 1.0 + Math.random() * 0.3 // 1.0x - 1.3x retail
  }
  // Dunks have high demand
  if (model.includes('Dunk')) {
    return 1.3 + Math.random() * 0.4 // 1.3x - 1.7x retail
  }
  // Others trade around retail
  return 0.9 + Math.random() * 0.3 // 0.9x - 1.2x retail
}

/**
 * Main seeding function
 */
async function seed() {
  console.log('🌱 Starting Sneaker Market Mock seed...\n')

  try {
    // 1. Seed sneaker catalog
    console.log('👟 Seeding sneaker catalog...')
    const { data: catalogData, error: catalogError } = await supabase
      .from('product_catalog')
      .upsert(POPULAR_SNEAKERS, { onConflict: 'sku' })
      .select()

    if (catalogError) {
      console.error('❌ Error seeding catalog:', catalogError.message)
      throw catalogError
    }
    console.log(`✅ Seeded ${catalogData.length} sneakers to product_catalog\n`)

    // 2. Seed market prices (30 days, multiple sizes)
    console.log('💰 Seeding mock market prices (30 days × sizes × SKUs)...')
    const marketPrices: any[] = []
    let priceCount = 0

    for (const sneaker of POPULAR_SNEAKERS) {
      const multiplier = getMarketMultiplier(sneaker.brand, sneaker.model)
      const baseMarketPrice = sneaker.retail_price * multiplier

      // Determine trend based on hype
      let trend: 'up' | 'down' | 'flat' = 'flat'
      if (multiplier > 1.4) trend = 'up' // High demand → upward trend
      else if (multiplier < 1.0) trend = 'down' // Low demand → downward trend

      // Generate prices for popular sizes (not all sizes to save space)
      const popularSizes = ['UK8', 'UK9', 'UK10', 'UK11']

      for (const size of popularSizes) {
        // Size-specific variance (smaller/larger sizes can have different prices)
        const sizeAdjustment = size === 'UK8' || size === 'UK11' ? 0.95 : 1.0
        const sizePrice = baseMarketPrice * sizeAdjustment

        const priceSeries = generatePriceSeries(sizePrice, 30, trend, 0.06)

        priceSeries.forEach(({ date, price }) => {
          marketPrices.push({
            sku: sneaker.sku,
            size,
            source: 'mock-stockx',
            snapshot_date: date.toISOString(),
            min_price: (price * 0.85).toFixed(2),
            median_price: price.toFixed(2),
            p75_price: (price * 1.15).toFixed(2),
            max_price: (price * 1.3).toFixed(2),
            listing_count: Math.floor(Math.random() * 80) + 20, // 20-100 listings
            currency: 'GBP',
            metadata: { trend, multiplier: multiplier.toFixed(2) },
          })
          priceCount++
        })
      }
    }

    // Batch insert prices
    const BATCH_SIZE = 500
    for (let i = 0; i < marketPrices.length; i += BATCH_SIZE) {
      const batch = marketPrices.slice(i, i + BATCH_SIZE)
      const { error: pricesError } = await supabase
        .from('sneaker_market_prices')
        .upsert(batch, { onConflict: 'sku,size,source,snapshot_date' })

      if (pricesError) {
        console.error(`❌ Error seeding prices batch ${i / BATCH_SIZE + 1}:`, pricesError.message)
        throw pricesError
      }

      process.stdout.write(`   Progress: ${Math.min(i + BATCH_SIZE, marketPrices.length)}/${marketPrices.length}\r`)
    }

    console.log(`\n✅ Seeded ${priceCount} market price snapshots\n`)

    // 3. Refresh materialized views
    console.log('🔄 Refreshing sneaker_price_daily_medians materialized view...')
    const { error: refreshError } = await supabase.rpc('refresh_sneaker_daily_medians')

    if (refreshError) {
      console.error('❌ Error refreshing MV:', refreshError.message)
      throw refreshError
    }
    console.log('✅ Materialized view refreshed\n')

    // 4. Summary
    console.log('✨ Sneaker Market Mock seed complete!\n')
    console.log('📊 Summary:')
    console.log(`   - Sneakers in catalog: ${POPULAR_SNEAKERS.length}`)
    console.log(`   - Market price snapshots: ${priceCount}`)
    console.log(`   - Size variants: ${['UK8', 'UK9', 'UK10', 'UK11'].length}`)
    console.log(`   - Days of history: 30`)
    console.log('\n🔍 Test the overlay by searching for:')
    console.log('   - "Dunk" (should show 2 results with sparklines)')
    console.log('   - "Jordan" (should show 2-3 results with upward trends)')
    console.log('   - "New Balance" (should show 3 results)')
    console.log('   - "Yeezy" (should show 1 result with high multiplier)')
    console.log('\n💡 Next: Run `npm run seed:portfolio` if needed, then test /api/market/search')

  } catch (error: any) {
    console.error('\n❌ Seeding failed:', error)
    process.exit(1)
  }
}

// Run seed
seed()
