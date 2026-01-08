/**
 * Enqueue daily sync jobs for ALL styles in inventory_v4_style_catalog
 *
 * For each style:
 * - If has alias_catalog_id → enqueue ALIAS job
 * - If has stockx_url_key → enqueue STOCKX job
 * - Skip if missing both mappings
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔄 DAILY SYNC - ENQUEUE ALL STYLES')
  console.log('================================================================================')
  console.log('')

  // 1. Get all styles from catalog
  const { data: styles, error: stylesError } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, stockx_product_id, stockx_url_key, alias_catalog_id')

  if (stylesError) {
    console.error('❌ Error fetching styles:', stylesError)
    process.exit(1)
  }

  console.log(`📋 Found ${styles.length} styles in catalog`)
  console.log('')

  // 2. Clear ALL existing jobs (fresh start for daily sync)
  const { error: clearError } = await supabase
    .from('inventory_v4_sync_queue')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

  if (clearError) {
    console.warn('⚠️  Could not clear old jobs:', clearError.message)
  } else {
    console.log('🧹 Cleared ALL existing jobs (fresh queue)')
  }

  // 3. Prepare jobs to enqueue
  const aliasJobs = []
  const stockxJobs = []
  const skipped = []

  for (const style of styles) {
    const hasAlias = !!style.alias_catalog_id
    const hasStockx = !!style.stockx_url_key

    if (!hasAlias && !hasStockx) {
      skipped.push(style.style_id)
      continue
    }

    if (hasAlias) {
      aliasJobs.push({
        style_id: style.style_id,
        provider: 'alias',
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        created_at: new Date().toISOString()
      })
    }

    if (hasStockx) {
      stockxJobs.push({
        style_id: style.style_id,
        provider: 'stockx',
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        created_at: new Date().toISOString()
      })
    }
  }

  console.log(`📊 Jobs to enqueue:`)
  console.log(`   - Alias:  ${aliasJobs.length}`)
  console.log(`   - StockX: ${stockxJobs.length}`)
  console.log(`   - Skipped (no mappings): ${skipped.length}`)

  if (skipped.length > 0) {
    console.log('')
    console.log('⏭️  Skipped styles:')
    skipped.forEach(s => console.log(`     - ${s}`))
  }

  // 4. Insert all jobs
  const allJobs = [...aliasJobs, ...stockxJobs]

  if (allJobs.length === 0) {
    console.log('')
    console.log('⚠️  No jobs to enqueue')
    return
  }

  console.log('')
  console.log(`📤 Inserting ${allJobs.length} jobs...`)

  // Insert in batches of 100
  const batchSize = 100
  let inserted = 0
  let errors = 0

  for (let i = 0; i < allJobs.length; i += batchSize) {
    const batch = allJobs.slice(i, i + batchSize)
    const { error: insertError } = await supabase
      .from('inventory_v4_sync_queue')
      .insert(batch)

    if (insertError) {
      console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} error:`, insertError.message)
      errors += batch.length
    } else {
      inserted += batch.length
    }
  }

  console.log('')
  console.log('================================================================================')
  console.log('📊 ENQUEUE SUMMARY')
  console.log('================================================================================')
  console.log(`   ✅ Inserted: ${inserted}`)
  console.log(`   ❌ Errors:   ${errors}`)
  console.log(`   ⏭️  Skipped:  ${skipped.length}`)
  console.log('')

  // 5. Show queue status
  const { data: queueStatus } = await supabase
    .from('inventory_v4_sync_queue')
    .select('status, provider')

  if (queueStatus) {
    const pending = queueStatus.filter(j => j.status === 'pending').length
    const processing = queueStatus.filter(j => j.status === 'processing').length
    const aliasCount = queueStatus.filter(j => j.provider === 'alias' && j.status === 'pending').length
    const stockxCount = queueStatus.filter(j => j.provider === 'stockx' && j.status === 'pending').length

    console.log('📊 Queue Status:')
    console.log(`   Pending:    ${pending} (Alias: ${aliasCount}, StockX: ${stockxCount})`)
    console.log(`   Processing: ${processing}`)
  }

  console.log('')
  console.log('✅ Done! Run worker to process: npx tsx scripts/inventory-v4-sync-worker.ts --batch=20')
}

main().catch(console.error)
