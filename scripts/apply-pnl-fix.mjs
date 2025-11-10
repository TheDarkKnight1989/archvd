#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cjoucwhhwhpippksytoi.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const sql = readFileSync('supabase/migrations/20250109_fix_pnl_view_columns.sql', 'utf-8')

console.log('Applying P&L view column fix migration...')

const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

if (error) {
  console.error('❌ Migration failed:', error.message)
  process.exit(1)
}

console.log('✅ Migration applied successfully')
