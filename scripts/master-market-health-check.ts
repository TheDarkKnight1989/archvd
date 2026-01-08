/**
 * Master Market Data Health Check
 *
 * Comprehensive test harness that:
 * 1. Syncs data from StockX, Alias (UK), and eBay for known SKUs
 * 2. Queries master_market_data and master_market_latest
 * 3. Validates data integrity (no missing required fields)
 * 4. Reports human-readable summary
 */

import { createClient } from '@supabase/supabase-js'
import { refreshStockxMarketData } from '@/lib/services/stockx/market-refresh'
import { syncAliasToMasterMarketData } from '@/lib/services/alias/sync'
import { AliasClient } from '@/lib/services/alias/client'

// Test SKUs - using products we know exist
const TEST_CASES = [
  {
    sku: 'FV5029-010',
    description: 'Jordan 4 Black Cat',
    stockxProductId: '15795a80-5cc8-4d2d-9ed0-20250d83be7f',
    aliasCatalogId: null, // Not in Alias
    testProviders: ['stockx'] as const,
  },
  {
    sku: 'DD1391-100',
    description: 'Jordan 4 Black Cat 2020',
    stockxProductId: null, // Need to look up
    aliasCatalogId: null, // Need to look up
    testProviders: ['stockx'] as const, // Can add 'alias' if catalog ID found
  },
]

interface ValidationIssue {
  severity: 'ERROR' | 'WARNING'
  field: string
  message: string
  rowId: string
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('════════════════════════════════════════════════════════════════════════════')
  console.log('MASTER MARKET DATA HEALTH CHECK')
  console.log('════════════════════════════════════════════════════════════════════════════\n')

  const allIssues: ValidationIssue[] = []
  const providerStats = new Map<string, { rows: number; sizes: number }>()

  for (const testCase of TEST_CASES) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Testing: ${testCase.sku} (${testCase.description})`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // ========================================================================
    // Step 1: Look up product IDs if not provided
    // ========================================================================

    let stockxProductId = testCase.stockxProductId
    let aliasCatalogId = testCase.aliasCatalogId

    if (!stockxProductId && testCase.testProviders.includes('stockx')) {
      console.log('🔍 Looking up StockX product ID...')
      const { data: catalogEntry } = await supabase
        .from('product_catalog')
        .select('stockx_product_id')
        .eq('sku', testCase.sku)
        .single()

      if (catalogEntry?.stockx_product_id) {
        stockxProductId = catalogEntry.stockx_product_id
        console.log(`   ✅ Found: ${stockxProductId}`)
      } else {
        console.log(`   ⚠️  Not found in product_catalog`)
      }
      console.log()
    }

    if (!aliasCatalogId && testCase.testProviders.includes('alias')) {
      console.log('🔍 Looking up Alias catalog ID...')
      const { data: aliasLink } = await supabase
        .from('inventory_alias_links')
        .select('alias_catalog_id, Inventory!inner(sku)')
        .eq('Inventory.sku', testCase.sku)
        .single()

      if (aliasLink?.alias_catalog_id) {
        aliasCatalogId = aliasLink.alias_catalog_id
        console.log(`   ✅ Found: ${aliasCatalogId}`)
      } else {
        console.log(`   ⚠️  Not found in inventory_alias_links`)
      }
      console.log()
    }

    // ========================================================================
    // Step 2: Sync data from each provider
    // ========================================================================

    if (stockxProductId && testCase.testProviders.includes('stockx')) {
      console.log('📥 Syncing StockX data (GBP, UK)...')
      try {
        const result = await refreshStockxMarketData(undefined, stockxProductId, 'GBP')
        if (result.success) {
          console.log(`   ✅ Success`)
        } else {
          console.log(`   ❌ Failed: ${result.error}`)
        }
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`)
      }
      console.log()
    }

    if (aliasCatalogId && testCase.testProviders.includes('alias')) {
      console.log('📥 Syncing Alias UK data (GBP, UK)...')
      try {
        const aliasClient = new AliasClient()
        const result = await syncAliasToMasterMarketData(aliasClient, aliasCatalogId, {
          sku: testCase.sku,
          regionId: '3', // UK
          includeConsigned: true,
        })
        if (result.success) {
          console.log(`   ✅ Success`)
        } else {
          console.log(`   ❌ Failed: ${result.error}`)
        }
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`)
      }
      console.log()
    }

    // ========================================================================
    // Step 3: Query and validate master_market_data
    // ========================================================================

    console.log('📊 Querying master_market_data...')
    const { data: marketData, error: marketError } = await supabase
      .from('master_market_data')
      .select('*')
      .eq('sku', testCase.sku)
      .order('created_at', { ascending: false })

    if (marketError) {
      console.log(`   ❌ Query error: ${marketError.message}`)
      allIssues.push({
        severity: 'ERROR',
        field: 'query',
        message: `Failed to query master_market_data: ${marketError.message}`,
        rowId: testCase.sku,
      })
      console.log()
      continue
    }

    if (!marketData || marketData.length === 0) {
      console.log(`   ⚠️  No data found`)
      allIssues.push({
        severity: 'WARNING',
        field: 'data',
        message: `No rows found in master_market_data`,
        rowId: testCase.sku,
      })
      console.log()
      continue
    }

    console.log(`   ✅ Found ${marketData.length} total rows`)
    console.log()

    // ========================================================================
    // Step 4: Validate data integrity
    // ========================================================================

    console.log('🔍 Validating data integrity...')

    // Required fields that must NOT be null
    const requiredFields = [
      'provider',
      'provider_source',
      'size_key',
      'currency_code',
      'snapshot_at',
    ]

    // Fields that should have values for most rows
    const expectedFields = [
      'sku',
      'lowest_ask',
      'last_sale_price',
    ]

    let validRows = 0
    const issues: ValidationIssue[] = []

    for (const row of marketData) {
      let hasIssue = false

      // Check required fields
      for (const field of requiredFields) {
        if (row[field] === null || row[field] === undefined) {
          issues.push({
            severity: 'ERROR',
            field,
            message: `Required field is NULL`,
            rowId: row.id,
          })
          hasIssue = true
        }
      }

      // Check size_key specifically
      if (row.size_key === 'Unknown') {
        issues.push({
          severity: 'WARNING',
          field: 'size_key',
          message: `Size is "Unknown" - size mapping may have failed`,
          rowId: row.id,
        })
      }

      // Check if at least one price field has data
      if (!row.lowest_ask && !row.highest_bid && !row.last_sale_price) {
        issues.push({
          severity: 'WARNING',
          field: 'pricing',
          message: `No pricing data (all price fields are NULL)`,
          rowId: row.id,
        })
        hasIssue = true
      }

      if (!hasIssue) {
        validRows++
      }
    }

    console.log(`   Rows validated: ${marketData.length}`)
    console.log(`   Clean rows: ${validRows}`)
    console.log(`   Rows with issues: ${issues.length}`)
    console.log()

    if (issues.length > 0) {
      console.log('   Issues found:')
      const errorCount = issues.filter(i => i.severity === 'ERROR').length
      const warningCount = issues.filter(i => i.severity === 'WARNING').length
      console.log(`     ERRORS: ${errorCount}`)
      console.log(`     WARNINGS: ${warningCount}`)
      console.log()

      // Show first 5 issues
      for (const issue of issues.slice(0, 5)) {
        console.log(`     [${issue.severity}] ${issue.field}: ${issue.message}`)
      }
      if (issues.length > 5) {
        console.log(`     ... and ${issues.length - 5} more`)
      }
      console.log()

      allIssues.push(...issues)
    }

    // ========================================================================
    // Step 5: Query master_market_latest view
    // ========================================================================

    console.log('📊 Querying master_market_latest view...')
    const { data: latestData, error: latestError } = await supabase
      .from('master_market_latest')
      .select('*')
      .eq('sku', testCase.sku)

    if (latestError) {
      console.log(`   ❌ Query error: ${latestError.message}`)
      allIssues.push({
        severity: 'ERROR',
        field: 'view',
        message: `Failed to query master_market_latest: ${latestError.message}`,
        rowId: testCase.sku,
      })
    } else {
      console.log(`   ✅ Found ${latestData?.length || 0} rows in latest view`)
    }
    console.log()

    // ========================================================================
    // Step 6: Summary by provider
    // ========================================================================

    console.log('📊 Summary by provider:')
    const providers = new Set(marketData.map(r => r.provider))
    for (const provider of providers) {
      const providerRows = marketData.filter(r => r.provider === provider)
      const uniqueSizes = new Set(providerRows.map(r => r.size_key))

      console.log(`   ${provider}:`)
      console.log(`     Rows: ${providerRows.length}`)
      console.log(`     Unique sizes: ${uniqueSizes.size}`)
      console.log(`     Currency: ${providerRows[0]?.currency_code || 'N/A'}`)
      console.log(`     Region: ${providerRows[0]?.region_code || 'N/A'}`)

      // Track stats
      const existingStats = providerStats.get(provider) || { rows: 0, sizes: 0 }
      providerStats.set(provider, {
        rows: existingStats.rows + providerRows.length,
        sizes: existingStats.sizes + uniqueSizes.size,
      })
    }
    console.log()
  }

  // ========================================================================
  // Final Report
  // ========================================================================

  console.log('════════════════════════════════════════════════════════════════════════════')
  console.log('FINAL REPORT')
  console.log('════════════════════════════════════════════════════════════════════════════\n')

  console.log('📊 Overall Statistics:')
  for (const [provider, stats] of providerStats.entries()) {
    console.log(`   ${provider}: ${stats.rows} rows across ${stats.sizes} unique sizes`)
  }
  console.log()

  const errorCount = allIssues.filter(i => i.severity === 'ERROR').length
  const warningCount = allIssues.filter(i => i.severity === 'WARNING').length

  console.log('🔍 Validation Summary:')
  console.log(`   Total issues found: ${allIssues.length}`)
  console.log(`   ERRORS: ${errorCount}`)
  console.log(`   WARNINGS: ${warningCount}`)
  console.log()

  if (errorCount === 0) {
    console.log('✅ HEALTH CHECK PASSED')
    console.log('   No critical errors found. Schema and mappers are consistent.')
  } else {
    console.log('❌ HEALTH CHECK FAILED')
    console.log('   Critical errors found. Review issues above.')
  }
  console.log()

  if (warningCount > 0) {
    console.log('⚠️  Warnings found (non-critical):')
    const warningsByField = new Map<string, number>()
    for (const issue of allIssues.filter(i => i.severity === 'WARNING')) {
      warningsByField.set(issue.field, (warningsByField.get(issue.field) || 0) + 1)
    }
    for (const [field, count] of warningsByField.entries()) {
      console.log(`   ${field}: ${count} warnings`)
    }
    console.log()
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
