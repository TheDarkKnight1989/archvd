/**
 * StockX Mappers Unit Tests
 *
 * Tests that raw API responses are correctly mapped to domain types
 * Run with: npx tsx tests/unit/stockx-mappers.test.ts
 */

import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  mapSearchResponse,
  mapRawProductToDomain,
  mapRawMarketDataToDomain,
  findProductByStyleId,
} from '../../src/lib/stockx/mappers'
import type {
  StockxRawSearchResponse,
  StockxRawProduct,
  StockxRawMarketDataItem,
} from '../../src/lib/stockx/types'

// Load fixtures
const fixturesDir = join(__dirname, '../fixtures/stockx')
const searchFixture: StockxRawSearchResponse = JSON.parse(
  readFileSync(join(fixturesDir, 'search-response.json'), 'utf-8')
)
const marketDataFixture: StockxRawMarketDataItem[] = JSON.parse(
  readFileSync(join(fixturesDir, 'market-data-response.json'), 'utf-8')
)

console.log('🧪 Testing StockX Mappers\n')

// ============================================================================
// Search Response Mapping
// ============================================================================

console.log('Testing mapSearchResponse...')
const searchResult = mapSearchResponse(searchFixture)

assert.equal(searchResult.products.length, 1, 'Should have 1 product')
assert.equal(searchResult.totalResults, 5, 'Should have totalResults = 5')
assert.equal(searchResult.page, 1, 'Should have page = 1')
assert.equal(searchResult.pageSize, 5, 'Should have pageSize = 5')
console.log('✅ mapSearchResponse passed\n')

// ============================================================================
// Product Mapping
// ============================================================================

console.log('Testing mapRawProductToDomain...')
const rawProduct: StockxRawProduct = searchFixture.products[0]
const product = mapRawProductToDomain(rawProduct)

// Key field mappings
assert.equal(product.productId, '5616213f-a646-49ec-8e4d-884c2c0b619e', 'productId should be UUID')
assert.equal(product.styleId, 'DC0350-100', 'styleId should be SKU')
assert.equal(product.brand, 'Jordan', 'brand should be Jordan')
assert.equal(product.title, 'Jordan 1 Mid Dia de los Muertos', 'title should match')

// Nested fields
assert.equal(product.colorway, 'White/Multi-Color', 'colorway should be extracted')
assert.equal(product.retailPrice, 115, 'retailPrice should be extracted')
assert.equal(product.releaseDate, '2020-10-28', 'releaseDate should be extracted')
assert.equal(product.gender, 'men', 'gender should be extracted')
assert.equal(product.category, 'sneakers', 'category should be extracted')

// Media fields
assert.ok(product.imageUrl, 'imageUrl should be set')
assert.ok(product.thumbUrl, 'thumbUrl should be set')

console.log('✅ mapRawProductToDomain passed')
console.log(`   styleId (SKU): ${product.styleId}`)
console.log(`   productId: ${product.productId}`)
console.log(`   title: ${product.title}\n`)

// ============================================================================
// Market Data Mapping
// ============================================================================

console.log('Testing mapRawMarketDataToDomain...')
const rawMarketData = marketDataFixture[0]
const marketData = mapRawMarketDataToDomain(rawMarketData, 'GBP')

// Price fields
assert.equal(marketData.lastSalePrice, 150.0, 'lastSalePrice should be 150')
assert.equal(marketData.lowestAsk, 175.0, 'lowestAsk should be 175')
assert.equal(marketData.highestBid, 145.0, 'highestBid should be 145')
assert.equal(marketData.currencyCode, 'GBP', 'currencyCode should be GBP')

// Volume fields
assert.equal(marketData.salesLast72Hours, 5, 'salesLast72Hours should be 5')
assert.equal(marketData.totalSalesVolume, 1250, 'totalSalesVolume should be 1250')

// Statistical fields
assert.equal(marketData.averageDeadstockPrice, 160.0, 'averageDeadstockPrice should be 160')
assert.equal(marketData.volatility, 0.15, 'volatility should be 0.15')
assert.equal(marketData.pricePremium, 0.25, 'pricePremium should be 0.25')

console.log('✅ mapRawMarketDataToDomain passed')
console.log(`   lastSalePrice: £${marketData.lastSalePrice}`)
console.log(`   lowestAsk: £${marketData.lowestAsk}`)
console.log(`   highestBid: £${marketData.highestBid}\n`)

// ============================================================================
// Helper Functions
// ============================================================================

console.log('Testing findProductByStyleId...')
const foundProduct = findProductByStyleId(searchFixture, 'DC0350-100')
assert.ok(foundProduct, 'Should find product by styleId')
assert.equal(foundProduct?.styleId, 'DC0350-100', 'Found product should have correct styleId')

const notFoundProduct = findProductByStyleId(searchFixture, 'INVALID-SKU')
assert.equal(notFoundProduct, null, 'Should return null for non-existent styleId')

console.log('✅ findProductByStyleId passed\n')

// ============================================================================
// Summary
// ============================================================================

console.log('═'.repeat(50))
console.log('✅ All tests passed!')
console.log('═'.repeat(50))
console.log('\nKey field mappings verified:')
console.log('  • styleId → styleId (SKU)')
console.log('  • productId → productId (UUID)')
console.log('  • lastSaleAmount → lastSalePrice')
console.log('  • lowestAskAmount → lowestAsk')
console.log('  • highestBidAmount → highestBid')
console.log('  • productAttributes.* → top-level fields')
console.log('  • media.* → imageUrl, thumbUrl')
