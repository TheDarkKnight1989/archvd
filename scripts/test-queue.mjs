#!/usr/bin/env node
/**
 * Test Market Queue System
 * Enqueues jobs for existing inventory items and triggers scheduler
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })
dotenv.config({ path: join(__dirname, '..', '.env') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

console.log('🧪 TESTING MARKET QUEUE SYSTEM\n')

// Step 1: Get inventory items
console.log('1️⃣  Fetching inventory items...')
const { data: items, error: itemsError } = await supabase
  .from('Inventory')
  .select('id, sku, size, size_uk')
  .eq('user_id', userId)
  .in('status', ['active', 'listed', 'worn'])
  .limit(5)

if (itemsError) {
  console.error('❌ Failed to fetch inventory:', itemsError)
  process.exit(1)
}

console.log(`   Found ${items?.length || 0} items\n`)

// Step 2: Enqueue jobs
console.log('2️⃣  Enqueuing jobs...')
let enqueued = 0

for (const item of items || []) {
  const job = {
    provider: 'stockx',
    sku: item.sku,
    size: item.size_uk || item.size,
    priority: 200, // High priority for testing
    user_id: userId,
  }

  const { data, error } = await supabase
    .from('market_jobs')
    .insert(job)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      console.log(`   ⊘ ${item.sku}:${job.size} - already queued`)
    } else {
      console.error(`   ❌ ${item.sku}:${job.size} - ${error.message}`)
    }
  } else {
    console.log(`   ✓ ${item.sku}:${job.size} - job ${data.id.substring(0, 8)}`)
    enqueued++
  }
}

console.log(`\n   Enqueued ${enqueued} new jobs\n`)

// Step 3: Check queue status
console.log('3️⃣  Queue status:')
const { data: pendingJobs } = await supabase
  .from('market_jobs')
  .select('id, provider, sku, size, priority, status')
  .in('status', ['pending', 'running'])
  .order('priority', { ascending: false })

console.log(`   ${pendingJobs?.length || 0} jobs pending/running\n`)

// Step 4: Show next steps
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✅ Jobs enqueued successfully!')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

console.log('Next steps:')
console.log('1. Trigger scheduler:')
console.log(`   curl -X POST http://localhost:3000/api/market/scheduler/run \\`)
console.log(`     -H "x-cron-secret: ${process.env.CRON_SECRET}"\n`)
console.log('2. View admin UI:')
console.log('   http://localhost:3000/portfolio/admin/market-jobs\n')
console.log('3. Check results in ~1 minute')
