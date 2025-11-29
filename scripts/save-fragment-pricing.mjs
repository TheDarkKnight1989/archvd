#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const ALIAS_PAT = process.env.ALIAS_PAT

if (!supabaseUrl || !supabaseServiceKey || !ALIAS_PAT) {
  console.error('Missing credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const catalogId = 'fragment-design-x-travis-scott-x-air-jordan-1-retro-high-dh3227-105'

console.log('📍 STEP 3: Save Pricing Data to Database\n')

// Fetch pricing from Alias API
const url = `https://api.alias.org/api/v1/pricing_insights/availabilities/${catalogId}`
const response = await fetch(url, {
  headers: { 'Authorization': `Bearer ${ALIAS_PAT}` }
})

const data = await response.json()

if (!response.ok || !data.variants?.length) {
  console.error('Failed to fetch pricing')
  process.exit(1)
}

console.log(`Fetched ${data.variants.length} variants`)

// Prepare snapshots (filter for NEW condition, GOOD packaging)
const snapshotTime = new Date().toISOString()
const currency = 'USD'

const snapshots = data.variants
  .filter(v =>
    v.product_condition === 'PRODUCT_CONDITION_NEW' &&
    v.packaging_condition === 'PACKAGING_CONDITION_GOOD_CONDITION' &&
    v.availability
  )
  .map(v => ({
    catalog_id: catalogId,
    size: v.size,
    currency,
    lowest_ask_cents: v.availability.lowest_listing_price_cents
      ? parseInt(v.availability.lowest_listing_price_cents, 10)
      : null,
    highest_bid_cents: v.availability.highest_offer_price_cents
      ? parseInt(v.availability.highest_offer_price_cents, 10)
      : null,
    last_sold_price_cents: v.availability.last_sold_listing_price_cents
      ? parseInt(v.availability.last_sold_listing_price_cents, 10)
      : null,
    global_indicator_price_cents: v.availability.global_indicator_price_cents
      ? parseInt(v.availability.global_indicator_price_cents, 10)
      : null,
    snapshot_at: snapshotTime,
  }))

console.log(`\nFiltered to ${snapshots.length} variants (NEW + GOOD condition)`)
console.log('\nSample data to insert:')
console.log(JSON.stringify(snapshots.slice(0, 2), null, 2))

// Insert into database
const { data: inserted, error } = await supabase
  .from('alias_market_snapshots')
  .upsert(snapshots, {
    onConflict: 'catalog_id,size,currency,snapshot_at',
  })
  .select()

if (error) {
  console.error('\n❌ Database error:', error)
  process.exit(1)
}

console.log(`\n✅ Saved ${snapshots.length} price snapshots to database`)

// Verify by reading back
const { data: verification } = await supabase
  .from('alias_market_snapshots')
  .select('size, lowest_ask_cents, highest_bid_cents')
  .eq('catalog_id', catalogId)
  .order('size')
  .limit(3)

console.log('\nVerification - First 3 sizes in database:')
verification?.forEach(row => {
  console.log(`  Size ${row.size}: Lowest Ask $${(row.lowest_ask_cents / 100).toFixed(2)}, Highest Bid $${(row.highest_bid_cents / 100).toFixed(2)}`)
})

console.log('\n✅ Step 3 complete - pricing data stored')
