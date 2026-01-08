/**
 * Validate Master Market Data
 * Tests master_market_data with sample SKUs to ensure data quality
 *
 * This script:
 * 1. Queries master_market_latest for test SKUs
 * 2. Validates data quality (no nulls, correct units, recent timestamps)
 * 3. Compares prices across providers
 * 4. Reports any issues
 *
 * Usage:
 *   npx tsx scripts/validate-master-market-data.ts
 */

import { createClient } from '@supabase/supabase-js'

// ============================================================================
// CONFIGURATION
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Test SKUs (popular items that should have data)
const TEST_SKUS = [
  {
    sku: 'DD1391-100',
    size: '10.5',
    name: 'Jordan 1 Low Panda (2021)',
    expectedProviders: ['stockx', 'alias'],
  },
  {
    sku: 'DH6927-111',
    size: '10',
    name: 'Jordan 4 Military Blue (2024)',
    expectedProviders: ['stockx', 'alias'],
  },
  {
    sku: 'ID4133',
    size: '10',
    name: 'Yeezy Slide Bone',
    expectedProviders: ['stockx', 'alias'],
  },
  {
    sku: 'M990GL6',
    size: '10',
    name: 'New Balance 990v6 Grey',
    expectedProviders: ['stockx', 'alias'],
  },
]

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🔍 Master Market Data Validation')
  console.log('=================================')
  console.log('')

  let totalTests = 0
  let passedTests = 0
  let failedTests = 0

  for (const test of TEST_SKUS) {
    console.log(`\n📦 Testing: ${test.name}`)
    console.log(`   SKU: ${test.sku}, Size: ${test.size}`)
    console.log('   ' + '─'.repeat(60))

    try {
      const result = await validateSKU(test)
      totalTests++

      if (result.passed) {
        passedTests++
        console.log(`   ✅ PASSED`)
      } else {
        failedTests++
        console.log(`   ❌ FAILED`)
        console.log(`   Issues:`)
        result.issues.forEach((issue) => console.log(`      - ${issue}`))
      }

      // Display price data
      if (result.data.length > 0) {
        console.log(`   \n   Price Data:`)
        result.data.forEach((row) => {
          console.log(`      ${row.provider.toUpperCase()}: $${row.lowest_ask || 'N/A'}`)
          console.log(`         Snapshot: ${new Date(row.snapshot_at).toLocaleString()}`)
          console.log(`         Freshness: ${row.data_freshness}`)
        })
      }
    } catch (error) {
      totalTests++
      failedTests++
      console.log(`   ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Summary
  console.log('\n\n📊 Validation Summary')
  console.log('=====================')
  console.log(`Total tests: ${totalTests}`)
  console.log(`Passed: ${passedTests} ✅`)
  console.log(`Failed: ${failedTests} ❌`)
  console.log(`Success rate: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0}%`)

  if (failedTests > 0) {
    console.log('\n⚠️  Some tests failed. Review issues above.')
    process.exit(1)
  } else {
    console.log('\n✨ All tests passed!')
    process.exit(0)
  }
}

// ============================================================================
// VALIDATION LOGIC
// ============================================================================

interface ValidationResult {
  passed: boolean
  issues: string[]
  data: any[]
}

async function validateSKU(test: {
  sku: string
  size: string
  name: string
  expectedProviders: string[]
}): Promise<ValidationResult> {
  const issues: string[] = []

  // Query master_market_latest
  const { data, error } = await supabase
    .from('master_market_latest')
    .select('*')
    .eq('sku', test.sku)
    .eq('size_key', test.size)
    .order('snapshot_at', { ascending: false })

  if (error) {
    throw new Error(`Database query failed: ${error.message}`)
  }

  if (!data || data.length === 0) {
    issues.push('No data found in master_market_latest')
    return { passed: false, issues, data: [] }
  }

  // Check 1: Expected providers present
  const foundProviders = [...new Set(data.map((row) => row.provider))]
  const missingProviders = test.expectedProviders.filter((p) => !foundProviders.includes(p))

  if (missingProviders.length > 0) {
    issues.push(`Missing provider data: ${missingProviders.join(', ')}`)
  }

  // Check 2: Prices are in major units (not cents)
  for (const row of data) {
    if (row.lowest_ask && row.lowest_ask > 10000) {
      issues.push(`${row.provider}: lowest_ask looks like cents (${row.lowest_ask}) - should be major units`)
    }

    if (row.highest_bid && row.highest_bid > 10000) {
      issues.push(`${row.provider}: highest_bid looks like cents (${row.highest_bid}) - should be major units`)
    }

    // Check 3: Prices are reasonable (sneakers typically $50-$5000)
    if (row.lowest_ask && (row.lowest_ask < 10 || row.lowest_ask > 10000)) {
      issues.push(`${row.provider}: lowest_ask out of reasonable range ($${row.lowest_ask})`)
    }
  }

  // Check 4: Currency codes present
  for (const row of data) {
    if (!row.currency_code) {
      issues.push(`${row.provider}: missing currency_code`)
    }
  }

  // Check 5: Timestamps are recent (< 7 days old)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  for (const row of data) {
    const snapshotDate = new Date(row.snapshot_at)
    if (snapshotDate < sevenDaysAgo) {
      issues.push(`${row.provider}: snapshot is > 7 days old (${snapshotDate.toLocaleDateString()})`)
    }
  }

  // Check 6: Critical fields not null
  const criticalFields = ['provider', 'size_key', 'currency_code', 'snapshot_at']
  for (const row of data) {
    for (const field of criticalFields) {
      if (row[field] === null || row[field] === undefined) {
        issues.push(`${row.provider}: missing critical field '${field}'`)
      }
    }
  }

  // Check 7: At least one price field populated
  for (const row of data) {
    if (!row.lowest_ask && !row.highest_bid && !row.last_sale_price) {
      issues.push(`${row.provider}: no price data (lowest_ask, highest_bid, last_sale_price all null)`)
    }
  }

  // Check 8: Size numeric matches size key
  for (const row of data) {
    if (row.size_numeric !== null) {
      const expectedNumeric = parseFloat(test.size)
      if (!isNaN(expectedNumeric) && Math.abs(row.size_numeric - expectedNumeric) > 0.1) {
        issues.push(`${row.provider}: size_numeric (${row.size_numeric}) doesn't match size_key (${test.size})`)
      }
    }
  }

  // Check 9: Provider-specific validations
  for (const row of data) {
    if (row.provider === 'stockx') {
      // StockX should have variant_id
      if (!row.provider_variant_id) {
        issues.push('stockx: missing provider_variant_id')
      }
    }

    if (row.provider === 'alias') {
      // Alias should always be USD
      if (row.currency_code !== 'USD') {
        issues.push(`alias: unexpected currency (${row.currency_code}) - should be USD`)
      }
    }
  }

  // Check 10: Alias volume data from recent_sales endpoint
  for (const row of data) {
    if (row.provider === 'alias') {
      // After recent_sales implementation, Alias should have volume metrics
      if (row.sales_last_72h === null || row.sales_last_72h === undefined) {
        issues.push('alias: missing sales_last_72h (recent_sales endpoint not called?)')
      }

      if (row.sales_last_30d === null || row.sales_last_30d === undefined) {
        issues.push('alias: missing sales_last_30d (recent_sales endpoint not called?)')
      }

      if (row.last_sale_price === null || row.last_sale_price === undefined) {
        issues.push('alias: missing last_sale_price (recent_sales endpoint not called?)')
      }

      // Volume should be reasonable (0-1000 sales per month for most items)
      if (row.sales_last_30d !== null && row.sales_last_30d > 10000) {
        issues.push(`alias: sales_last_30d suspiciously high (${row.sales_last_30d})`)
      }

      // 72h sales should be less than 30d sales
      if (
        row.sales_last_72h !== null &&
        row.sales_last_30d !== null &&
        row.sales_last_72h > row.sales_last_30d
      ) {
        issues.push(
          `alias: sales_last_72h (${row.sales_last_72h}) > sales_last_30d (${row.sales_last_30d}) - logic error`
        )
      }
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    data,
  }
}

// ============================================================================
// RUN
// ============================================================================

main().catch((err) => {
  console.error('❌ Validation script failed:', err)
  process.exit(1)
})
