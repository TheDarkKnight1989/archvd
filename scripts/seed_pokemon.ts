#!/usr/bin/env tsx
/**
 * Pokémon Sealed Products Seed Script
 *
 * Seeds trading_card_catalog and generates mock daily snapshots
 * for the last 14 days across multiple sources (tcgplayer, ebay).
 *
 * Usage: npm run seed:pokemon
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface CatalogProduct {
  sku: string
  language: string
  set_code: string
  set_name: string
  sealed_type: string
  name: string
  image_url: string
  retail_price: number
  currency: string
}

/**
 * Calculate quartiles and IQR for outlier detection
 */
function calculateQuartiles(values: number[]): { q1: number; q3: number; iqr: number } {
  const sorted = [...values].sort((a, b) => a - b)
  const q1Index = Math.floor(sorted.length * 0.25)
  const q3Index = Math.floor(sorted.length * 0.75)
  const q1 = sorted[q1Index]
  const q3 = sorted[q3Index]
  const iqr = q3 - q1
  return { q1, q3, iqr }
}

/**
 * Remove outliers using IQR method
 */
function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values
  const { q1, q3, iqr } = calculateQuartiles(values)
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr
  return values.filter(v => v >= lowerBound && v <= upperBound)
}

/**
 * Calculate median of an array
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

/**
 * Calculate 75th percentile
 */
function calculateP75(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil(sorted.length * 0.75) - 1
  return sorted[index]
}

/**
 * Generate realistic mock prices with variation
 */
function generateMockPrices(
  basePrice: number,
  source: string,
  count: number = 20
): number[] {
  const prices: number[] = []

  // Source-specific multipliers
  const sourceMultipliers: Record<string, { min: number; max: number }> = {
    tcgplayer: { min: 0.95, max: 1.15 },  // TCGPlayer tends to be competitive
    ebay: { min: 1.0, max: 1.3 },         // eBay can have higher variance
  }

  const multiplier = sourceMultipliers[source] || { min: 0.9, max: 1.2 }

  // Generate prices with realistic distribution
  for (let i = 0; i < count; i++) {
    const variance = multiplier.min + Math.random() * (multiplier.max - multiplier.min)
    const randomAdjustment = 0.95 + Math.random() * 0.1 // ±5% random variation
    let price = basePrice * variance * randomAdjustment

    // Add some outliers (10% chance)
    if (Math.random() < 0.1) {
      price *= Math.random() < 0.5 ? 0.7 : 1.4 // Extreme outlier
    }

    prices.push(Math.round(price * 100) / 100) // Round to 2 decimals
  }

  return prices
}

/**
 * Generate snapshot stats from mock prices
 */
function generateSnapshotStats(
  prices: number[]
): {
  min_price: number
  median_price: number
  p75_price: number
  max_price: number
  listing_count: number
  metadata: any
} {
  const rawCount = prices.length
  const cleanPrices = removeOutliers(prices)
  const outliersRemoved = rawCount - cleanPrices.length

  return {
    min_price: Math.min(...cleanPrices),
    median_price: calculateMedian(cleanPrices),
    p75_price: calculateP75(cleanPrices),
    max_price: Math.max(...cleanPrices),
    listing_count: cleanPrices.length,
    metadata: {
      outliers_removed: outliersRemoved,
      raw_count: rawCount,
      iqr_method: 'applied',
    },
  }
}

/**
 * Seed catalog from JSON
 */
async function seedCatalog() {
  console.log('\n📦 Seeding trading card catalog...')

  const seedPath = path.join(process.cwd(), 'seed', 'pokemon_sealed_seed.json')
  const catalogData: CatalogProduct[] = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))

  console.log(`   Found ${catalogData.length} products in seed file`)

  // Upsert catalog entries
  const { data, error } = await supabase
    .from('trading_card_catalog')
    .upsert(
      catalogData.map(p => ({
        sku: p.sku,
        language: p.language,
        set_code: p.set_code,
        set_name: p.set_name,
        sealed_type: p.sealed_type,
        name: p.name,
        image_url: p.image_url,
        retail_price: p.retail_price,
        currency: p.currency,
      })),
      { onConflict: 'sku' }
    )
    .select()

  if (error) {
    console.error('❌ Error seeding catalog:', error)
    throw error
  }

  console.log(`✅ Upserted ${data?.length || 0} catalog entries`)
  return catalogData
}

/**
 * Generate mock snapshots for last N days
 */
async function seedSnapshots(catalogData: CatalogProduct[], days: number = 14) {
  console.log(`\n📊 Generating mock snapshots for last ${days} days...`)

  const sources = ['tcgplayer', 'ebay']
  const snapshots: any[] = []

  // Generate dates for last N days
  const dates: Date[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    dates.push(date)
  }

  // Generate snapshots for each product, source, and date
  for (const product of catalogData) {
    for (const source of sources) {
      for (const date of dates) {
        // Generate mock prices with daily variation
        const dayVariation = 0.95 + Math.random() * 0.1 // ±5% daily price fluctuation
        const basePrice = product.retail_price * dayVariation
        const mockPrices = generateMockPrices(basePrice, source, 15 + Math.floor(Math.random() * 10))
        const stats = generateSnapshotStats(mockPrices)

        snapshots.push({
          sku: product.sku,
          source,
          snapshot_date: date.toISOString().split('T')[0],
          ...stats,
          currency: product.currency,
        })
      }
    }
  }

  console.log(`   Generated ${snapshots.length} snapshot records`)

  // Insert snapshots in batches (Supabase has a limit)
  const batchSize = 500
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const batch = snapshots.slice(i, i + batchSize)
    const { error } = await supabase
      .from('trading_card_market_snapshots')
      .upsert(batch, { onConflict: 'sku,source,snapshot_date' })

    if (error) {
      console.error(`❌ Error seeding snapshots batch ${i / batchSize + 1}:`, error)
      throw error
    }

    console.log(`   ✓ Batch ${i / batchSize + 1}/${Math.ceil(snapshots.length / batchSize)}`)
  }

  console.log(`✅ Seeded ${snapshots.length} snapshot records`)
}

/**
 * Main seeding function
 */
async function main() {
  console.log('🌱 Pokémon Sealed Products Seeder')
  console.log('=' .repeat(50))

  try {
    // 1. Seed catalog
    const catalogData = await seedCatalog()

    // 2. Generate mock snapshots
    await seedSnapshots(catalogData, 14)

    console.log('\n✨ Seeding complete!')
    console.log('=' .repeat(50))
    console.log('Next steps:')
    console.log('  • Navigate to Market → Pokémon (sealed)')
    console.log('  • Search for a SKU (e.g., PKMN-SV06-ETB-EN)')
    console.log('  • View snapshot stats per source')
    console.log('  • Add items to watchlist or inventory')

  } catch (error) {
    console.error('\n❌ Seeding failed:', error)
    process.exit(1)
  }
}

main()
