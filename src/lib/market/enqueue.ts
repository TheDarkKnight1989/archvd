/**
 * Market job enqueue helpers
 */

import { createClient } from '@/lib/supabase/service'
import { jobExists } from './guards'
import { nowUtc } from '@/lib/time'

interface EnqueueJobParams {
  provider: string
  sku: string
  size?: string | null
  priority?: number
  userId?: string | null
  notBefore?: Date | null
}

/**
 * Enqueue a single market data fetch job
 * Deduplicates by (provider, sku, size) - won't create if already pending/running
 */
export async function enqueueJob(params: EnqueueJobParams): Promise<{ id: string } | null> {
  const { provider, sku, size, priority = 100, userId, notBefore } = params

  // Check if job already exists
  if (await jobExists(provider, sku, size)) {
    return null // Already queued
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from('market_jobs')
    .insert({
      user_id: userId || null,
      provider,
      sku,
      size: size || null,
      priority,
      not_before: notBefore ? notBefore.toISOString() : null,
      status: 'pending',
      attempts: 0,
      created_at: nowUtc(),
      updated_at: nowUtc(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to enqueue job:', error)
    return null
  }

  return data
}

/**
 * Enqueue multiple jobs for inventory items
 * Priority 150 for hot items (user-owned)
 */
export async function enqueueForItems(
  items: Array<{ sku: string; size?: string | null }>,
  options: {
    provider?: string
    priority?: number
    userId?: string | null
  } = {}
): Promise<number> {
  const { provider = 'stockx', priority = 150, userId } = options

  let enqueued = 0

  for (const item of items) {
    const result = await enqueueJob({
      provider,
      sku: item.sku,
      size: item.size,
      priority,
      userId,
    })

    if (result) {
      enqueued++
    }
  }

  return enqueued
}

/**
 * Enqueue refresh for specific SKUs (manual refresh)
 * Priority 200 for user-initiated refreshes
 */
export async function enqueueRefresh(
  skus: Array<{ sku: string; size?: string | null }>,
  userId?: string
): Promise<number> {
  return enqueueForItems(skus, {
    provider: 'stockx',
    priority: 200,
    userId: userId || null,
  })
}
