#!/usr/bin/env node
/**
 * Diagnose catalog schema issues
 * Checks actual DB schema vs code expectations
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

async function diagnose() {
  console.log('🔍 Diagnosing catalog schema...\n')

  // Check product_catalog table
  console.log('📊 Checking product_catalog table...')
  const { data: catalogData, error: catalogError } = await supabase
    .from('product_catalog')
    .select('*')
    .limit(1)

  if (catalogError) {
    console.log('❌ Error querying product_catalog:', catalogError.message)
    console.log('\n💡 Table might not exist or have different structure')
  } else {
    console.log('✅ product_catalog table exists')
    if (catalogData && catalogData.length > 0) {
      console.log('📋 Current columns:', Object.keys(catalogData[0]).join(', '))
    } else {
      console.log('⚠️  Table is empty, checking schema differently...')
    }
  }

  // Check stockx_products table
  console.log('\n📊 Checking stockx_products table...')
  const { data: stockxData, error: stockxError } = await supabase
    .from('stockx_products')
    .select('*')
    .limit(1)

  if (stockxError) {
    console.log('❌ Error querying stockx_products:', stockxError.message)
  } else {
    console.log('✅ stockx_products table exists')
    if (stockxData && stockxData.length > 0) {
      console.log('📋 Current columns:', Object.keys(stockxData[0]).join(', '))
    } else {
      console.log('⚠️  Table is empty')
    }
  }

  // Check stockx_variants table
  console.log('\n📊 Checking stockx_variants table...')
  const { data: variantsData, error: variantsError } = await supabase
    .from('stockx_variants')
    .select('*')
    .limit(1)

  if (variantsError) {
    console.log('❌ Error querying stockx_variants:', variantsError.message)
  } else {
    console.log('✅ stockx_variants table exists')
    if (variantsData && variantsData.length > 0) {
      console.log('📋 Current columns:', Object.keys(variantsData[0]).join(', '))
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('📝 Expected Schema for product_catalog:')
  console.log('='.repeat(80))
  console.log(`
Required columns:
  - id (primary key, UUID)
  - sku (TEXT, unique)
  - brand (TEXT)
  - model (TEXT)
  - colorway (TEXT, nullable)
  - image_url (TEXT, nullable)
  - retail_price (NUMERIC, nullable)
  - retail_currency (TEXT, nullable)
  - release_date (DATE, nullable)
  - stockx_product_id (TEXT, nullable) - links to stockx_products
  - category (TEXT, nullable)
  - gender (TEXT, nullable)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
`)

  console.log('='.repeat(80))
  console.log('📝 Expected Schema for stockx_products:')
  console.log('='.repeat(80))
  console.log(`
Required columns:
  - stockx_product_id (TEXT, primary key)
  - brand (TEXT)
  - title (TEXT)
  - colorway (TEXT, nullable)
  - style_id (TEXT)
  - image_url (TEXT, nullable)
  - thumb_url (TEXT, nullable)
  - category (TEXT, nullable)
  - silhouette (TEXT, nullable)
  - gender (TEXT, nullable)
  - retail_price (NUMERIC, nullable)
  - release_date (DATE, nullable)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
`)

  console.log('\n' + '='.repeat(80))
  console.log('💡 Next Steps:')
  console.log('='.repeat(80))
  console.log(`
1. If tables don't exist: Create them from scratch
2. If columns are missing: Run migration to add them
3. If structure is wrong: Consider recreating tables

Run this diagnosis again after making changes to verify.
`)
}

diagnose()
