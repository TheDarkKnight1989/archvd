#!/usr/bin/env node
/**
 * Check specific job details
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const jobId = '99474d9e-2126-4f99-8192-15f818e4bb12'

  console.log('\n🔍 Job Details\n')
  console.log('=' .repeat(80))

  const { data: job, error } = await supabase
    .from('market_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (error) {
    console.error('❌ Error fetching job:', error)
    return
  }

  console.log(JSON.stringify(job, null, 2))

  // Check if user_id exists in the schema
  console.log('\n📋 Job Fields:')
  Object.keys(job).forEach(key => {
    console.log(`  ${key}: ${job[key]}`)
  })
}

main().catch(console.error)
