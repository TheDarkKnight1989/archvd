#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Get one item to see schema
const { data, error } = await supabase
  .from('Inventory')
  .select('*')
  .limit(1)

if (error) {
  console.log('Error:', error)
} else if (data && data.length > 0) {
  console.log('Inventory columns:')
  console.log(Object.keys(data[0]))
} else {
  console.log('No data found')
}
