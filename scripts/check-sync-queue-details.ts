#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkDetails() {
  console.log('\n🔍 SYNC QUEUE JOB DETAILS\n')
  console.log('='.repeat(80))

  // Get all jobs
  const { data: jobs } = await supabase
    .from('inventory_v4_sync_queue')
    .select('*')
    .order('id', { ascending: false })
    .limit(10)

  if (!jobs || jobs.length === 0) {
    console.log('No jobs found\n')
    return
  }

  for (const job of jobs) {
    console.log(`\n[Job ${job.id}] ${job.provider.toUpperCase()} - ${job.style_id}`)
    console.log(`  Status: ${job.status}`)
    console.log(`  Attempts: ${job.attempts}/${job.max_attempts}`)

    if (job.last_error) {
      console.log(`  Error: ${job.last_error}`)
    }

    if (job.processed_at) {
      console.log(`  Processed: ${new Date(job.processed_at).toLocaleString()}`)
    }
  }

  console.log('\n' + '='.repeat(80))

  // Check if the style IDs have the required mappings
  console.log('\n🔍 STYLE CATALOG MAPPINGS\n')

  const styleIds = [...new Set(jobs.map(j => j.style_id))]

  for (const styleId of styleIds) {
    const { data: style } = await supabase
      .from('inventory_v4_style_catalog')
      .select('style_id, stockx_url_key, alias_catalog_id, brand, name')
      .eq('style_id', styleId)
      .single()

    if (style) {
      console.log(`\n${styleId}`)
      console.log(`  Brand: ${style.brand}`)
      console.log(`  Name: ${style.name}`)
      console.log(`  StockX URL Key: ${style.stockx_url_key || 'NOT SET'}`)
      console.log(`  Alias Catalog ID: ${style.alias_catalog_id || 'NOT SET'}`)
    } else {
      console.log(`\n${styleId}: NOT FOUND IN CATALOG`)
    }
  }

  console.log('\n')
}

checkDetails()
