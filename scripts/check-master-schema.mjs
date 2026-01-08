#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Get a sample row to see all fields
const { data: sample } = await supabase
  .from('master_market_data')
  .select('*')
  .limit(1)

if (sample && sample.length > 0) {
  console.log('📋 master_market_data schema (all fields):\n')
  
  const row = sample[0]
  const fields = Object.keys(row).sort()
  
  fields.forEach(field => {
    const value = row[field]
    const type = value === null ? 'null' : typeof value
    console.log(`  ${field.padEnd(30)} ${type.padEnd(10)} ${value !== null ? `(example: ${String(value).substring(0, 40)})` : ''}`)
  })
}
