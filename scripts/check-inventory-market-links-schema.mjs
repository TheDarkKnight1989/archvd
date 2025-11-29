#!/usr/bin/env node
/**
 * Check inventory_market_links table schema
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkSchema() {
  console.log('Checking inventory_market_links schema...\n')

  // Fetch one row to see all columns
  const { data, error } = await supabase
    .from('inventory_market_links')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error:', error)
    return
  }

  if (data && data.length > 0) {
    console.log('Columns in inventory_market_links:')
    console.log(Object.keys(data[0]).join(', '))
    console.log('\nSample row:')
    console.log(JSON.stringify(data[0], null, 2))
  } else {
    console.log('No data found in inventory_market_links')
  }
}

checkSchema()
