/**
 * Market data guards - prevent unnecessary provider calls
 */

import { createClient } from '@/lib/supabase/service'
import { isStale } from '@/lib/time'

const FRESHNESS_THRESHOLD_MINUTES = 10

/**
 * Check if we should skip fetching because we have fresh data
 * Returns true if we have recent data (< 10 min old)
 */
export async function shouldSkipRecentPrice(
  provider: string,
  sku: string,
  size?: string | null
): Promise<boolean> {
  const supabase = createClient()

  let query = supabase
    .from('stockx_market_prices')
    .select('as_of')
    .eq('sku', sku)
    .eq('source', provider)
    .order('as_of', { ascending: false })
    .limit(1)

  if (size) {
    query = query.eq('size', size)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return false // No data, need to fetch
  }

  // Check if data is fresh
  return !isStale(data.as_of, FRESHNESS_THRESHOLD_MINUTES)
}

/**
 * Check if a job already exists in the queue
 */
export async function jobExists(
  provider: string,
  sku: string,
  size?: string | null
): Promise<boolean> {
  const supabase = createClient()

  const dedupeKey = `${provider}|${sku}|${size || ''}`

  const { data, error } = await supabase
    .from('market_jobs')
    .select('id')
    .eq('dedupe_key', dedupeKey)
    .in('status', ['pending', 'running'])
    .limit(1)
    .single()

  return !error && !!data
}
