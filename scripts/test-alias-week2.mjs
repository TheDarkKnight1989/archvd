#!/usr/bin/env node
/**
 * Test Alias Week 2 Implementation
 * Tests all API routes and services
 */

import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

async function testSearchAPI() {
  console.log('\n1️⃣  Testing Catalog Search API...')

  try {
    const response = await fetch(`${BASE_URL}/api/alias/search?query=Air+Jordan+5+Grape`)

    if (!response.ok) {
      console.log(`   ❌ Search API failed: ${response.status} ${response.statusText}`)
      return false
    }

    const data = await response.json()

    if (data.success && data.items && data.items.length > 0) {
      console.log(`   ✅ Search API working`)
      console.log(`      Found ${data.count} items`)
      console.log(`      First result: ${data.items[0].name}`)
      console.log(`      Catalog ID: ${data.items[0].catalog_id}`)
      return data.items[0].catalog_id // Return for next tests
    } else {
      console.log('   ⚠️  Search API returned no results')
      return null
    }
  } catch (error) {
    console.log(`   ❌ Search API error: ${error.message}`)
    return null
  }
}

async function testGetCatalogAPI(catalogId) {
  console.log('\n2️⃣  Testing Get Catalog Item API...')

  if (!catalogId) {
    console.log('   ⏭️  Skipping (no catalog ID from search)')
    return false
  }

  try {
    const response = await fetch(`${BASE_URL}/api/alias/catalog/${catalogId}`)

    if (!response.ok) {
      console.log(`   ❌ Get Catalog API failed: ${response.status} ${response.statusText}`)
      return false
    }

    const data = await response.json()

    if (data.success && data.item) {
      console.log(`   ✅ Get Catalog API working`)
      console.log(`      Item: ${data.item.name}`)
      console.log(`      SKU: ${data.item.sku}`)
      console.log(`      Brand: ${data.item.brand}`)
      console.log(`      Sizes available: ${data.item.allowed_sizes?.length || 0}`)
      return true
    } else {
      console.log('   ❌ Get Catalog API returned invalid data')
      return false
    }
  } catch (error) {
    console.log(`   ❌ Get Catalog API error: ${error.message}`)
    return false
  }
}

async function testPricingAPI(catalogId) {
  console.log('\n3️⃣  Testing Pricing Insights API...')

  if (!catalogId) {
    console.log('   ⏭️  Skipping (no catalog ID from search)')
    return false
  }

  try {
    const response = await fetch(`${BASE_URL}/api/alias/pricing/${catalogId}?save_snapshot=true`)

    if (!response.ok) {
      console.log(`   ❌ Pricing API failed: ${response.status} ${response.statusText}`)
      return false
    }

    const data = await response.json()

    if (data.success && data.variants && data.variants.length > 0) {
      console.log(`   ✅ Pricing API working`)
      console.log(`      Variants found: ${data.count}`)
      console.log(`      Snapshot saved: ${data.snapshotSaved}`)

      // Show first variant pricing
      const firstVariant = data.variants[0]
      if (firstVariant.availability) {
        console.log(`      Example (Size ${firstVariant.size}):`)
        if (firstVariant.availability.lowest_listing_price_cents) {
          const lowestAsk = parseInt(firstVariant.availability.lowest_listing_price_cents) / 100
          console.log(`        Lowest Ask: $${lowestAsk.toFixed(2)}`)
        }
        if (firstVariant.availability.highest_offer_price_cents) {
          const highestBid = parseInt(firstVariant.availability.highest_offer_price_cents) / 100
          console.log(`        Highest Bid: $${highestBid.toFixed(2)}`)
        }
      }
      return true
    } else {
      console.log('   ⚠️  Pricing API returned no variants')
      return false
    }
  } catch (error) {
    console.log(`   ❌ Pricing API error: ${error.message}`)
    return false
  }
}

async function testTypeScript() {
  console.log('\n4️⃣  Testing TypeScript Compilation...')

  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)

  try {
    await execAsync('npx tsc --noEmit')
    console.log('   ✅ TypeScript compilation successful')
    return true
  } catch (error) {
    console.log('   ❌ TypeScript compilation failed')
    console.log('      Run `npm run typecheck` for details')
    return false
  }
}

async function checkDatabaseSnapshots(catalogId) {
  console.log('\n5️⃣  Checking Database Snapshots...')

  if (!catalogId) {
    console.log('   ⏭️  Skipping (no catalog ID)')
    return false
  }

  try {
    const { createClient } = await import('@supabase/supabase-js')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data, error } = await supabase
      .from('alias_market_snapshots')
      .select('*')
      .eq('catalog_id', catalogId)
      .order('snapshot_at', { ascending: false })
      .limit(1)

    if (error) {
      console.log(`   ❌ Database query failed: ${error.message}`)
      return false
    }

    if (data && data.length > 0) {
      console.log('   ✅ Market snapshots saved to database')
      console.log(`      Latest snapshot: ${data[0].snapshot_at}`)
      console.log(`      Size: ${data[0].size}`)
      console.log(`      Lowest ask: ${data[0].lowest_ask_cents ? '$' + (data[0].lowest_ask_cents / 100).toFixed(2) : 'N/A'}`)
      return true
    } else {
      console.log('   ⚠️  No snapshots found in database')
      console.log('      (Pricing API may not have saved data)')
      return false
    }
  } catch (error) {
    console.log(`   ❌ Database check error: ${error.message}`)
    return false
  }
}

async function runTests() {
  console.log('🧪 Testing Alias Week 2 Implementation')
  console.log('='.repeat(70))

  const tests = []

  // Test 1: Search API
  const catalogId = await testSearchAPI()
  tests.push(catalogId !== null)

  // Test 2: Get Catalog API
  const getCatalogResult = await testGetCatalogAPI(catalogId)
  tests.push(getCatalogResult)

  // Test 3: Pricing API
  const pricingResult = await testPricingAPI(catalogId)
  tests.push(pricingResult)

  // Test 4: TypeScript
  const tsResult = await testTypeScript()
  tests.push(tsResult)

  // Test 5: Database
  const dbResult = await checkDatabaseSnapshots(catalogId)
  tests.push(dbResult)

  // Summary
  console.log('\n' + '='.repeat(70))
  const passedTests = tests.filter(Boolean).length
  const totalTests = tests.length

  if (passedTests === totalTests) {
    console.log('✅ ALL TESTS PASSED')
    console.log('='.repeat(70))
    console.log('\n📋 Summary:')
    console.log('   ✅ Catalog search working')
    console.log('   ✅ Get catalog item working')
    console.log('   ✅ Pricing insights working')
    console.log('   ✅ TypeScript compilation successful')
    console.log('   ✅ Database snapshots saved')
    console.log('\n🚀 Phase 1, Week 2 Complete!')
    console.log('\nNext steps:')
    console.log('   1. Week 3: Listing creation and management')
    console.log('   2. Week 4: Order tracking and payouts')
    console.log('   3. Week 5: Background jobs and webhooks\n')
  } else {
    console.log(`⚠️  ${passedTests}/${totalTests} TESTS PASSED`)
    console.log('='.repeat(70))
    console.log('\nPlease fix failing tests before proceeding.\n')
    process.exit(1)
  }
}

// Check if dev server is running
console.log('Checking dev server status...')
try {
  const response = await fetch(`${BASE_URL}/api/alias/test`)
  if (!response.ok) {
    console.log('⚠️  Dev server may not be running properly')
    console.log('   Please ensure `npm run dev` is running\n')
  }
} catch (error) {
  console.log('❌ Cannot connect to dev server')
  console.log(`   Please start the dev server with: npm run dev`)
  console.log(`   Expected URL: ${BASE_URL}\n`)
  process.exit(1)
}

runTests().catch(console.error)
