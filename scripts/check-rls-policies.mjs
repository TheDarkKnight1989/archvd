#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Query pg_policies to see current RLS policies on inventory_market_links
const { data, error } = await supabase
  .from('pg_policies')
  .select('*')
  .eq('tablename', 'inventory_market_links')

if (error) {
  console.error('Error:', error.message)
} else {
  console.log('\n📋 Current RLS Policies on inventory_market_links:\n')
  data.forEach(policy => {
    console.log(`Policy: ${policy.policyname}`)
    console.log(`  Cmd: ${policy.cmd}`)
    console.log(`  Roles: ${policy.roles}`)
    console.log(`  Qual: ${policy.qual}`)
    console.log(`  With Check: ${policy.with_check}`)
    console.log('')
  })
}
