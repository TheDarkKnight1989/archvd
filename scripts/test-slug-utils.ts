#!/usr/bin/env node
/**
 * Test slug utility functions
 */

import {
  generateProductSlug,
  parseSkuFromSlug,
  validateSlug,
  getProductNameFromSlug,
} from '../src/lib/utils/slug'

console.log('🧪 Testing Slug Utilities\n')

// Test Case 1: Air Jordan with complex name
const testCases = [
  {
    name: "Air Jordan 1 Retro High OG 'Chicago Lost & Found'",
    sku: 'DZ5485-612',
    expectedSlug: 'air-jordan-1-retro-high-og-chicago-lost-and-found-dz5485-612',
  },
  {
    name: 'New Balance 990v6 Grey',
    sku: 'M990GL6',
    expectedSlug: 'new-balance-990v6-grey-m990gl6',
  },
  {
    name: 'Nike Dunk Low "Panda"',
    sku: 'DD1391-100',
    expectedSlug: 'nike-dunk-low-panda-dd1391-100',
  },
  {
    name: 'Adidas Yeezy Boost 350 V2',
    sku: 'HQ3816',
    expectedSlug: 'adidas-yeezy-boost-350-v2-hq3816',
  },
]

let passed = 0
let failed = 0

testCases.forEach((testCase, index) => {
  console.log(`\n📝 Test Case ${index + 1}: ${testCase.name}`)
  console.log(`   SKU: ${testCase.sku}`)

  // Test generateProductSlug
  const generatedSlug = generateProductSlug(testCase.name, testCase.sku)
  console.log(`   Generated Slug: ${generatedSlug}`)

  if (generatedSlug === testCase.expectedSlug) {
    console.log(`   ✅ Slug generation: PASS`)
    passed++
  } else {
    console.log(`   ❌ Slug generation: FAIL`)
    console.log(`   Expected: ${testCase.expectedSlug}`)
    failed++
  }

  // Test parseSkuFromSlug
  const parsedSku = parseSkuFromSlug(generatedSlug)
  const expectedParsedSku = testCase.sku.toLowerCase()
  console.log(`   Parsed SKU: ${parsedSku}`)

  if (parsedSku === expectedParsedSku) {
    console.log(`   ✅ SKU parsing: PASS`)
    passed++
  } else {
    console.log(`   ❌ SKU parsing: FAIL`)
    console.log(`   Expected: ${expectedParsedSku}`)
    failed++
  }

  // Test validateSlug
  const isValid = validateSlug(generatedSlug)
  console.log(`   Valid Slug: ${isValid}`)

  if (isValid) {
    console.log(`   ✅ Slug validation: PASS`)
    passed++
  } else {
    console.log(`   ❌ Slug validation: FAIL`)
    failed++
  }

  // Test getProductNameFromSlug
  const productName = getProductNameFromSlug(generatedSlug)
  console.log(`   Product Name: ${productName}`)

  if (productName) {
    console.log(`   ✅ Product name extraction: PASS`)
    passed++
  } else {
    console.log(`   ❌ Product name extraction: FAIL`)
    failed++
  }
})

// Test invalid slugs
console.log('\n\n🔍 Testing Invalid Slugs\n')

const invalidSlugs = [
  'invalid slug with spaces',
  'no-sku-here-just-words',
  '-starts-with-hyphen',
  'ends-with-hyphen-',
  'UPPERCASE-NOT-ALLOWED',
  '',
  'a', // too short
]

invalidSlugs.forEach((slug) => {
  const isValid = validateSlug(slug)
  if (!isValid) {
    console.log(`✅ "${slug}" correctly identified as invalid`)
    passed++
  } else {
    console.log(`❌ "${slug}" incorrectly validated as valid`)
    failed++
  }
})

// Summary
console.log('\n\n📊 Test Summary')
console.log('━'.repeat(40))
console.log(`✅ Passed: ${passed}`)
console.log(`❌ Failed: ${failed}`)
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`)

if (failed === 0) {
  console.log('\n🎉 All tests passed!')
} else {
  console.log('\n⚠️  Some tests failed')
  process.exit(1)
}
