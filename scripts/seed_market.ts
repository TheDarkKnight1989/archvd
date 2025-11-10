#!/usr/bin/env tsx

/**
 * Market Data Seeder
 *
 * Seeds the database with mock product catalog and market prices from seed/market_seed.json
 *
 * Usage:
 *   npm run seed:market
 *   or
 *   tsx scripts/seed_market.ts
 *
 * Requirements:
 *   - NEXT_PUBLIC_SUPABASE_URL environment variable
 *   - SUPABASE_SERVICE_ROLE_KEY environment variable (for bypassing RLS)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Types matching the seed data structure
interface CatalogItem {
  sku: string
  brand: string
  model: string
  colorway: string
  retail_price: number
  retail_currency: string
  release_date: string
  image_url: string
  slug: string
}

interface PriceSize {
  size: string
  price: number
  source: string
}

interface PriceData {
  sku: string
  sizes: PriceSize[]
}

interface SeedData {
  catalog: CatalogItem[]
  prices: PriceData[]
}

async function main() {
  console.log('🌱 Market Data Seeder')
  console.log('=' + '='.repeat(50))

  // 1. Load environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:')
    console.error('   - NEXT_PUBLIC_SUPABASE_URL')
    console.error('   - SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  // 2. Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  console.log('✅ Connected to Supabase')

  // 3. Load seed data
  const seedPath = join(process.cwd(), 'seed', 'market_seed.json')
  let seedData: SeedData

  try {
    const rawData = readFileSync(seedPath, 'utf-8')
    seedData = JSON.parse(rawData) as SeedData
    console.log(`✅ Loaded seed data: ${seedData.catalog.length} SKUs, ${seedData.prices.length} price sets`)
  } catch (err) {
    console.error('❌ Failed to load seed data:', err)
    process.exit(1)
  }

  // 4. Insert catalog items
  console.log('\n📦 Inserting product catalog...')
  let catalogInserted = 0
  let catalogSkipped = 0

  for (const item of seedData.catalog) {
    const { error } = await supabase
      .from('product_catalog')
      .upsert(item, { onConflict: 'sku' })

    if (error) {
      console.error(`   ❌ Failed to insert ${item.sku}:`, error.message)
    } else {
      catalogInserted++
      console.log(`   ✓ ${item.sku} - ${item.brand} ${item.model}`)
    }
  }

  console.log(`\n   Inserted: ${catalogInserted}/${seedData.catalog.length} catalog items`)

  // 5. Insert market prices
  console.log('\n💰 Inserting market prices...')
  let pricesInserted = 0
  let totalPrices = seedData.prices.reduce((sum, p) => sum + p.sizes.length, 0)

  for (const priceData of seedData.prices) {
    for (const sizePrice of priceData.sizes) {
      const priceRow = {
        sku: priceData.sku,
        size: sizePrice.size,
        source: sizePrice.source,
        currency: 'GBP',
        price: sizePrice.price,
        as_of: new Date().toISOString(),
        meta: {
          seeded_at: new Date().toISOString(),
          seeded_by: 'seed_market.ts',
        },
      }

      const { error } = await supabase
        .from('product_market_prices')
        .insert(priceRow)

      if (error) {
        // Skip if duplicate (same sku, size, source, as_of)
        if (error.code === '23505') {
          // Unique constraint violation
          continue
        }
        console.error(`   ❌ Failed to insert ${priceData.sku} ${sizePrice.size}:`, error.message)
      } else {
        pricesInserted++
      }
    }

    console.log(`   ✓ ${priceData.sku} - ${priceData.sizes.length} sizes`)
  }

  console.log(`\n   Inserted: ${pricesInserted}/${totalPrices} price entries`)

  // 6. Verify data
  console.log('\n🔍 Verifying seeded data...')

  const { count: catalogCount, error: catalogCountError } = await supabase
    .from('product_catalog')
    .select('*', { count: 'exact', head: true })

  const { count: pricesCount, error: pricesCountError } = await supabase
    .from('product_market_prices')
    .select('*', { count: 'exact', head: true })

  if (catalogCountError || pricesCountError) {
    console.error('❌ Failed to verify data:', catalogCountError || pricesCountError)
  } else {
    console.log(`   Total catalog items: ${catalogCount}`)
    console.log(`   Total market prices: ${pricesCount}`)
  }

  // 7. Test latest_market_prices view
  console.log('\n🔎 Testing latest_market_prices view...')
  const { data: latestPrices, error: viewError } = await supabase
    .from('latest_market_prices')
    .select('sku, size, price, source')
    .limit(5)

  if (viewError) {
    console.error('❌ Failed to query view:', viewError.message)
  } else {
    console.log(`   ✓ View working correctly (${latestPrices?.length || 0} sample rows)`)
    latestPrices?.forEach((p) => {
      console.log(`      ${p.sku} ${p.size}: £${p.price} (${p.source})`)
    })
  }

  console.log('\n' + '='.repeat(50))
  console.log('✅ Market data seeding complete!')
  console.log('\nNext steps:')
  console.log('  1. Visit /portfolio/market to search for SKUs')
  console.log('  2. Try searching for: DZ5485-612, FD0774-101, U990GL6')
  console.log('  3. Check latest_market_prices view in Supabase dashboard')
}

main().catch((err) => {
  console.error('💥 Unexpected error:', err)
  process.exit(1)
})
