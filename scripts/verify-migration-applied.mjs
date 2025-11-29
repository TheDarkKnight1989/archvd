#!/usr/bin/env node
/**
 * Verify that all schema migrations were applied successfully
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function verifyMigration() {
  console.log('🔍 Verifying migration was applied...\n')

  let allGood = true

  // Check product_catalog
  console.log('📦 Checking product_catalog table:')
  const { data: catalogSample, error: catalogError } = await supabase
    .from('product_catalog')
    .select('*')
    .limit(1)

  if (catalogError) {
    console.log('   ❌ Error querying product_catalog:', catalogError.message)
    allGood = false
  } else {
    const catalogColumns = catalogSample?.[0] ? Object.keys(catalogSample[0]) : []
    console.log(`   Columns found: ${catalogColumns.join(', ')}`)

    const requiredCols = ['id', 'sku', 'category', 'gender', 'stockx_product_id']
    requiredCols.forEach(col => {
      const exists = catalogColumns.includes(col)
      console.log(`   ${exists ? '✅' : '❌'} ${col}`)
      if (!exists) allGood = false
    })
  }

  // Check stockx_products
  console.log('\n📦 Checking stockx_products table:')
  const { data: productSample, error: productError } = await supabase
    .from('stockx_products')
    .select('*')
    .limit(1)

  if (productError) {
    console.log('   ❌ Error querying stockx_products:', productError.message)
    allGood = false
  } else {
    const productColumns = productSample?.[0] ? Object.keys(productSample[0]) : []
    console.log(`   Columns found: ${productColumns.join(', ')}`)

    const exists = productColumns.includes('silhouette')
    console.log(`   ${exists ? '✅' : '❌'} silhouette`)
    if (!exists) allGood = false
  }

  // Check stockx_variants
  console.log('\n📦 Checking stockx_variants table:')
  const { data: variantSample, error: variantError } = await supabase
    .from('stockx_variants')
    .select('*')
    .limit(1)

  if (variantError) {
    console.log('   ❌ Error querying stockx_variants:', variantError.message)
    allGood = false
  } else {
    const variantColumns = variantSample?.[0] ? Object.keys(variantSample[0]) : []
    console.log(`   Columns found: ${variantColumns.join(', ')}`)

    const requiredCols = ['size_display', 'size_chart']
    requiredCols.forEach(col => {
      const exists = variantColumns.includes(col)
      console.log(`   ${exists ? '✅' : '❌'} ${col}`)
      if (!exists) allGood = false
    })
  }

  console.log('\n' + '='.repeat(60))
  if (allGood) {
    console.log('✅ SUCCESS! All schema migrations applied correctly')
    console.log('='.repeat(60))
    console.log('\n📋 Next Steps:')
    console.log('1. Test adding an item via the Add Item modal')
    console.log('2. Check that images appear (from Alias)')
    console.log('3. Check that market data appears (prices)')
    console.log('\n💡 If you still see schema errors in the API logs, you may need')
    console.log('   to restart your Next.js dev server to clear the cache.')
  } else {
    console.log('❌ ISSUES DETECTED - Some columns are still missing!')
    console.log('='.repeat(60))
    console.log('\n💡 Try:')
    console.log('1. Run the migration again in Supabase Dashboard')
    console.log('2. Check for any errors in the SQL output')
    console.log('3. Restart your Next.js dev server')
  }
}

verifyMigration()
