/**
 * Test eBay Market Prices
 *
 * Verifies the eBay integration can fetch sold listings per SKU with size extraction.
 * This data could feed into the ARCHVD Smart Price.
 */

import { searchAuthenticatedNewSneakers } from '../src/lib/services/ebay/sneakers'
import { ebayConfig } from '../src/lib/services/ebay/config'
import { enrichEbaySoldItem } from '../src/lib/services/ebay/extractors'

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  EBAY MARKET DATA - TEST')
  console.log('═══════════════════════════════════════════════════════════\n')

  // Check config
  console.log('📋 Configuration:')
  console.log(`   Environment: ${ebayConfig.env}`)
  console.log(`   Client ID: ${ebayConfig.clientId?.substring(0, 20)}...`)
  console.log(`   Market Data Enabled: ${ebayConfig.marketDataEnabled}`)
  console.log('')

  if (!ebayConfig.marketDataEnabled) {
    console.log('⚠️  eBay market data is disabled. Set EBAY_MARKET_DATA_ENABLED=true')
    process.exit(1)
  }

  // Test SKU - Nike Dunk Low Panda
  const testSKU = 'DD1391-100'

  console.log(`1️⃣  Searching eBay for SKU: ${testSKU} (with full details for size extraction)\n`)

  try {
    const result = await searchAuthenticatedNewSneakers(testSKU, {
      limit: 20, // Fewer items since we're fetching full details
      soldItemsOnly: true,
      fetchFullDetails: true, // Get localizedAspects for size extraction
    })

    // Enrich items with size extraction
    console.log('Enriching items with size extraction...')
    for (const item of result.items) {
      enrichEbaySoldItem(item)
    }

    console.log(`✅ Found ${result.items.length} items (total fetched: ${result.totalFetched})\n`)

    if (result.items.length === 0) {
      console.log('❌ No items found. This could mean:')
      console.log('   - API credentials issue')
      console.log('   - No recent sold listings for this SKU')
      process.exit(1)
    }

    // Group by size
    const bySize = new Map<string, Array<{ price: number; currency: string; title: string; soldAt?: string }>>()

    for (const item of result.items) {
      const sizeKey = item.sizeInfo
        ? `${item.sizeInfo.system} ${item.sizeInfo.size}`
        : 'Unknown'

      if (!bySize.has(sizeKey)) {
        bySize.set(sizeKey, [])
      }
      bySize.get(sizeKey)!.push({
        price: item.price,
        currency: item.currency,
        title: item.title.substring(0, 50),
        soldAt: item.soldAt,
      })
    }

    // Sort sizes
    const sortedSizes = [...bySize.entries()].sort((a, b) => {
      const sizeA = parseFloat(a[0].replace(/[^0-9.]/g, '')) || 999
      const sizeB = parseFloat(b[0].replace(/[^0-9.]/g, '')) || 999
      return sizeA - sizeB
    })

    console.log('📊 Prices by Size:')
    console.log('┌──────────────┬───────────┬───────────┬───────────┬───────────┐')
    console.log('│ Size         │ Count     │ Min       │ Max       │ Avg       │')
    console.log('├──────────────┼───────────┼───────────┼───────────┼───────────┤')

    for (const [size, items] of sortedSizes) {
      const prices = items.map(i => i.price)
      const min = Math.min(...prices)
      const max = Math.max(...prices)
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length
      const currency = items[0].currency

      console.log(
        `│ ${size.padEnd(12)} │ ${String(items.length).padEnd(9)} │ ${currency}${min.toFixed(0).padStart(6)} │ ${currency}${max.toFixed(0).padStart(6)} │ ${currency}${avg.toFixed(0).padStart(6)} │`
      )
    }

    console.log('└──────────────┴───────────┴───────────┴───────────┴───────────┘')

    // Show sample items
    console.log('\n📝 Sample Items:')
    for (const item of result.items.slice(0, 5)) {
      const sizeStr = item.sizeInfo ? `${item.sizeInfo.system} ${item.sizeInfo.size}` : '?'
      console.log(`   • ${item.currency}${item.price} | Size: ${sizeStr} | ${item.title.substring(0, 40)}...`)
    }

    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('  ✅ EBAY INTEGRATION WORKING')
    console.log('═══════════════════════════════════════════════════════════')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
