#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const productId = '83c11c36-1e00-4831-85e5-6067abf2f18b'

const { data, error } = await supabase
  .from('stockx_products')
  .select('id, title, style_id, brand')
  .eq('id', productId)
  .single()

if (error) {
  console.log(`❌ Product not found in DB: ${error.message}`)
} else {
  console.log(`✅ Product in DB:`)
  console.log(`  Title: ${data.title}`)
  console.log(`  Style ID: ${data.style_id}`)
  console.log(`  Brand: ${data.brand}`)
}
