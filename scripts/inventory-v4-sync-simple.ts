#!/usr/bin/env node

/**
 * Simple Sync Worker - No RPC Function Required
 *
 * This is a simplified version of the sync worker that doesn't require
 * the fetch_sync_jobs() database function. It queries pending jobs directly.
 *
 * Usage:
 *   npx tsx scripts/inventory-v4-sync-simple.ts
 *   npx tsx scripts/inventory-v4-sync-simple.ts --batch 20
 */

import { createClient } from '@supabase/supabase-js'
import { syncStockxProductBySku } from '@/lib/services/stockx-v4/sync'
import { syncAliasProductByCatalogId } from '@/lib/services/alias-v4/sync'

// ============================================================================
// TYPES
// ============================================================================

interface SyncJob {
  id: string
  style_id: string
  provider: 'stockx' | 'alias'
  status: string
  attempts: number
  max_attempts: number
}

interface StyleCatalogRow {
  style_id: string
  stockx_url_key: string | null
  stockx_product_id: string | null
  alias_catalog_id: string | null
  brand: string | null
  name: string | null
}

// ============================================================================
// CONFIG
// ============================================================================

const args = process.argv.slice(2)
const BATCH_SIZE = parseInt(args.find((a) => a.startsWith('--batch='))?.split('=')[1] || '10', 10)

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ============================================================================
// FUNCTIONS
// ============================================================================

async function fetchPendingJobs(limit: number): Promise<SyncJob[]> {
  // Simple query - no RPC needed
  const { data, error } = await supabase
    .from('inventory_v4_sync_queue')
    .select('id, style_id, provider, status, attempts, max_attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Failed to fetch jobs: ${error.message}`)
  return (data || []) as SyncJob[]
}

async function getStyleCatalog(styleId: string): Promise<StyleCatalogRow | null> {
  const { data, error } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, stockx_url_key, stockx_product_id, alias_catalog_id, brand, name')
    .eq('style_id', styleId)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw new Error(`Failed to fetch style: ${error.message}`)
  return data as StyleCatalogRow
}

async function updateJobStatus(jobId: string, status: string, error?: string) {
  const updates: Record<string, unknown> = { status }
  if (status === 'processing') {
    // Increment attempts when starting
  }
  if (error) {
    updates.last_error = error.substring(0, 1000)
  }
  if (status === 'success' || status === 'failed') {
    updates.processed_at = new Date().toISOString()
  }

  await supabase
    .from('inventory_v4_sync_queue')
    .update(updates)
    .eq('id', jobId)
}

async function backfillMetadata(styleId: string, provider: 'stockx' | 'alias') {
  if (provider === 'stockx') {
    const { data: stockx } = await supabase
      .from('inventory_v4_stockx_products')
      .select('brand, title, colorway')
      .eq('style_id', styleId)
      .maybeSingle()

    if (!stockx) return

    const { data: current } = await supabase
      .from('inventory_v4_style_catalog')
      .select('brand, name, colorway')
      .eq('style_id', styleId)
      .single()

    if (!current) return

    const updates: Record<string, string> = {}
    if (!current.brand && stockx.brand) updates.brand = stockx.brand
    if (!current.name && stockx.title) updates.name = stockx.title
    if (!current.colorway && stockx.colorway) updates.colorway = stockx.colorway

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('inventory_v4_style_catalog')
        .update(updates)
        .eq('style_id', styleId)
      console.log(`     📝 Backfilled: ${Object.keys(updates).join(', ')}`)
    }
  }
}

async function processJob(job: SyncJob): Promise<boolean> {
  console.log(`  📋 [${job.provider.toUpperCase()}] ${job.style_id}`)

  try {
    // Mark as processing
    await updateJobStatus(job.id, 'processing')

    const style = await getStyleCatalog(job.style_id)
    if (!style) {
      throw new Error(`Style ${job.style_id} not found in catalog`)
    }

    if (job.provider === 'stockx') {
      if (!style.stockx_url_key && !style.stockx_product_id) {
        throw new Error(`No stockx_url_key or stockx_product_id for ${job.style_id}`)
      }

      console.log(`     🔄 Syncing StockX...`)
      const result = await syncStockxProductBySku(job.style_id)

      if (!result.success) {
        throw new Error(result.errors?.[0]?.error || 'StockX sync failed')
      }

      console.log(`     ✅ ${result.counts.variantsSynced} variants, ${result.counts.marketDataRefreshed} prices`)
      await backfillMetadata(job.style_id, 'stockx')

    } else if (job.provider === 'alias') {
      if (!style.alias_catalog_id) {
        throw new Error(`No alias_catalog_id for ${job.style_id}`)
      }

      console.log(`     🔄 Syncing Alias: ${style.alias_catalog_id}`)
      const result = await syncAliasProductByCatalogId(style.alias_catalog_id)

      if (!result.success) {
        throw new Error(result.errors?.[0]?.error || 'Alias sync failed')
      }

      console.log(`     ✅ ${result.counts.variantsSynced} variants, ${result.counts.marketDataRefreshed} prices`)
    }

    await updateJobStatus(job.id, 'success')
    return true

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`     ❌ ${msg}`)

    const newAttempts = job.attempts + 1
    const finalStatus = newAttempts >= job.max_attempts ? 'failed' : 'pending'

    await supabase
      .from('inventory_v4_sync_queue')
      .update({
        status: finalStatus,
        attempts: newAttempts,
        last_error: msg.substring(0, 1000),
        processed_at: finalStatus === 'failed' ? new Date().toISOString() : null,
      })
      .eq('id', job.id)

    if (finalStatus === 'failed') {
      console.error(`     💀 Max attempts reached`)
    } else {
      console.log(`     🔄 Will retry (${newAttempts}/${job.max_attempts})`)
    }

    return false
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n🔄 INVENTORY V4 - SIMPLE SYNC WORKER')
  console.log('='.repeat(60))

  // Check queue status
  const { count: pending } = await supabase
    .from('inventory_v4_sync_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  console.log(`\n📊 Pending jobs: ${pending ?? 0}`)

  if (!pending) {
    console.log('✅ Nothing to process\n')
    return
  }

  // Fetch and process jobs
  const jobs = await fetchPendingJobs(BATCH_SIZE)
  console.log(`\n📦 Processing ${jobs.length} jobs...\n`)

  let success = 0
  let failed = 0

  for (const job of jobs) {
    const ok = await processJob(job)
    if (ok) success++
    else failed++

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500))
  }

  console.log('\n' + '='.repeat(60))
  console.log(`📊 Results: ${success} success ✅, ${failed} failed ❌`)
  console.log('='.repeat(60) + '\n')
}

main().catch(err => {
  console.error('❌ Fatal:', err)
  process.exit(1)
})
