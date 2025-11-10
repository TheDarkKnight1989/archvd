#!/usr/bin/env tsx

/**
 * Portfolio Demo Seed Script
 *
 * Seeds a user's portfolio with ~20 demo items (10 sneakers + 10 Pokémon)
 * and generates 30-day price history for realistic Overview charts.
 *
 * Usage: npm run seed:portfolio
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface DemoItem {
  sku: string
  title: string
  category: 'sneaker' | 'pokemon'
  size_uk: string | null
  purchase_price: number
  tax: number
  shipping: number
  purchase_date: string
  image_url: string | null
}

/**
 * Generate 30-day price series with realistic variance
 */
function generate30DayPrices(basePrice: number, trend: 'up' | 'down' | 'flat' = 'up', variance = 0.03) {
  const prices: { date: string; price: number }[] = []
  const today = new Date()

  let currentPrice = basePrice

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)

    // Apply trend
    if (trend === 'up') {
      currentPrice *= 1 + Math.random() * 0.01 // Slight upward drift
    } else if (trend === 'down') {
      currentPrice *= 1 - Math.random() * 0.01 // Slight downward drift
    }

    // Add random variance
    const randomFactor = 1 + (Math.random() * variance * 2 - variance)
    const price = Math.round(currentPrice * randomFactor * 100) / 100

    prices.push({
      date: date.toISOString().split('T')[0],
      price: Math.max(price, basePrice * 0.8), // Floor at 80% of base
    })
  }

  return prices
}

/**
 * Get current authenticated user
 */
async function getCurrentUser() {
  // Try to get user from session (if running with user token)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    console.error('❌ No authenticated user found.')
    console.error('💡 Make sure you are logged in or set SUPABASE_USER_ID env var.')
    process.exit(1)
  }

  return user
}

/**
 * Main seeding function
 */
async function seed() {
  console.log('🌱 Starting Portfolio Demo seed...\n')

  try {
    // 1. Get current user
    const user = await getCurrentUser()
    console.log(`👤 Seeding for user: ${user.email} (${user.id})\n`)

    // 2. Load demo items
    const demoDataPath = join(process.cwd(), 'seed', 'portfolio_demo.json')
    const demoData = JSON.parse(readFileSync(demoDataPath, 'utf-8'))
    const items: DemoItem[] = demoData.items

    console.log(`📦 Loaded ${items.length} demo items from seed/portfolio_demo.json\n`)

    // 3. Insert portfolio items
    console.log('💼 Inserting portfolio items...')
    const portfolioItems = items.map(item => ({
      user_id: user.id,
      sku: item.sku,
      brand: item.title.split(' ')[0], // Extract brand from title
      model: item.title.substring(item.title.indexOf(' ') + 1), // Rest is model
      category: item.category,
      size_uk: item.size_uk,
      purchase_price: item.purchase_price,
      purchase_currency: 'GBP',
      tax: item.tax,
      shipping: item.shipping,
      purchase_date: item.purchase_date,
      status: 'active',
      location: 'Home',
    }))

    const { data: insertedItems, error: itemsError } = await supabase
      .from('portfolio_items')
      .insert(portfolioItems)
      .select()

    if (itemsError) {
      console.error('❌ Error inserting items:', itemsError.message)
      throw itemsError
    }

    console.log(`✅ Inserted ${insertedItems.length} portfolio items\n`)

    // 4. Seed 30-day price history for Pokémon products
    console.log('💎 Seeding 30-day Pokémon price history...')
    const pokemonItems = items.filter(item => item.category === 'pokemon')
    const pokemonPrices: any[] = []

    pokemonItems.forEach(item => {
      // Base market price (typically 1.1-1.4x purchase price for sealed Pokémon)
      const purchaseTotal = item.purchase_price + item.tax + item.shipping
      const marketPrice = purchaseTotal * (1.1 + Math.random() * 0.3)

      // Determine trend based on product
      const trend = item.sku.includes('BB') ? 'up' : 'flat' // Booster boxes trend up
      const priceHistory = generate30DayPrices(marketPrice, trend, 0.04)

      priceHistory.forEach(({ date, price }) => {
        pokemonPrices.push({
          sku: item.sku,
          snapshot_date: new Date(date).toISOString(),
          source: 'ebay',
          min_price: (price * 0.85).toFixed(2),
          median_price: price.toFixed(2),
          p75_price: (price * 1.15).toFixed(2),
          max_price: (price * 1.3).toFixed(2),
          listing_count: Math.floor(Math.random() * 40) + 15,
          currency: 'GBP',
        })
      })
    })

    const { error: pokemonPriceError } = await supabase
      .from('trading_card_market_snapshots')
      .upsert(pokemonPrices, { onConflict: 'sku,snapshot_date,source' })

    if (pokemonPriceError) {
      console.error('❌ Error seeding Pokémon prices:', pokemonPriceError.message)
      throw pokemonPriceError
    }

    console.log(`✅ Seeded ${pokemonPrices.length} Pokémon price snapshots (30 days)\n`)

    // 5. Seed 30-day price history for sneakers (if table exists)
    // Note: Skipping sneaker prices for now as table doesn't exist yet
    console.log('⏭️  Skipping sneaker prices (table not yet created)\n')

    // 6. Summary
    console.log('✨ Portfolio Demo seed complete!\n')
    console.log('📊 Summary:')
    console.log(`   - User: ${user.email}`)
    console.log(`   - Portfolio items: ${insertedItems.length}`)
    console.log(`   - Pokémon price snapshots: ${pokemonPrices.length}`)
    console.log(`   - Sneakers: ${items.filter(i => i.category === 'sneaker').length} (prices skipped)`)
    console.log(`   - Pokémon: ${pokemonItems.length} (with 30-day history)`)
    console.log('\n🔍 View your portfolio at /portfolio')
    console.log('📈 Portfolio Overview should now show KPIs and 30-day sparkline!')

  } catch (error: any) {
    console.error('\n❌ Seeding failed:', error)
    process.exit(1)
  }
}

// Run seed
seed()
