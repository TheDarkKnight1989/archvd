/**
 * eBay Metrics Computation Engine
 * Computes rolling medians, volatility, confidence scores from ebay_sold_transactions
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PHASE 1 - TIME-SERIES METRICS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PURPOSE:
 * Read ebay_sold_transactions WHERE included_in_metrics = TRUE
 * Compute rolling medians (72h, 7d, 30d, 90d) per (SKU, size_key, currency, marketplace)
 * Calculate confidence scores based on sample size, volatility, recency, outlier ratio
 *
 * METRICS COMPUTED:
 * - median_72h_cents: 72-hour rolling median (used as last_sale_price in master_market_data)
 * - median_7d_cents: 7-day rolling median
 * - median_30d_cents: 30-day rolling median
 * - median_90d_cents: 90-day rolling median
 * - sample_size_*: Number of sales in each window
 * - volatility_90d: Coefficient of variation (stddev / mean)
 * - liquidity_score: 0-100 score based on sales frequency and recency
 * - confidence_score: 0-100 score based on sample size, volatility, outlier ratio
 *
 * WINDOWS:
 * - 72h: Last 3 days
 * - 7d: Last 7 days
 * - 30d: Last 30 days
 * - 90d: Last 90 days (full eBay sold items window)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ComputeMetricsOptions {
  sku?: string // Compute for specific SKU only
  sizeKey?: string // Compute for specific size only
  marketplaceId?: string // Default: EBAY_GB
  dryRun?: boolean // If true, don't upsert, just return computed metrics
}

interface EbayComputedMetric {
  // Product identification
  sku: string
  size_key: string
  size_system: string | null
  currency_code: string
  marketplace_id: string

  // Rolling medians (cents)
  median_72h_cents: number | null
  median_7d_cents: number | null
  median_30d_cents: number | null
  median_90d_cents: number | null

  // Sample sizes
  sample_size_72h: number
  sample_size_7d: number
  sample_size_30d: number
  sample_size_90d: number

  // Price ranges
  min_price_90d_cents: number | null
  max_price_90d_cents: number | null

  // Volatility
  volatility_90d: number | null

  // Scores
  liquidity_score: number | null
  confidence_score: number | null

  // Outlier stats
  total_sales_90d: number
  outlier_count_90d: number
  outlier_ratio_90d: number | null

  // Metadata
  computed_at: string
  last_sale_at: string | null
}

interface TransactionRow {
  sku: string
  size_key: string
  size_system: string
  currency_code: string
  marketplace_id: string
  sale_price_cents: number
  sold_at: string
  is_outlier: boolean
  included_in_metrics: boolean
}

// ============================================================================
// STATISTICS HELPERS
// ============================================================================

/**
 * Calculate median from array of numbers
 */
function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  } else {
    return sorted[mid]
  }
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number | null {
  if (values.length < 2) return null

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length

  return Math.sqrt(variance)
}

/**
 * Calculate coefficient of variation (volatility)
 * CV = (stddev / mean) * 100
 */
function calculateVolatility(values: number[]): number | null {
  if (values.length < 2) return null

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  if (mean === 0) return null

  const stdDev = calculateStdDev(values)
  if (!stdDev) return null

  return (stdDev / mean) * 100
}

// ============================================================================
// SCORE CALCULATIONS
// ============================================================================

/**
 * Calculate liquidity score (0-100)
 * Based on:
 * - Sales frequency (how many sales in recent windows)
 * - Recency (how recent is the last sale)
 */
function calculateLiquidityScore(
  sampleSize72h: number,
  sampleSize7d: number,
  sampleSize30d: number,
  lastSaleAt: Date | null
): number {
  let score = 0

  // Component 1: 72h volume (40 points max)
  // 5+ sales in 72h = full points
  score += Math.min(40, (sampleSize72h / 5) * 40)

  // Component 2: 7d volume (30 points max)
  // 10+ sales in 7d = full points
  score += Math.min(30, (sampleSize7d / 10) * 30)

  // Component 3: 30d volume (20 points max)
  // 20+ sales in 30d = full points
  score += Math.min(20, (sampleSize30d / 20) * 20)

  // Component 4: Recency (10 points max)
  if (lastSaleAt) {
    const hoursSinceLastSale = (Date.now() - lastSaleAt.getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastSale <= 24) {
      score += 10
    } else if (hoursSinceLastSale <= 72) {
      score += 7
    } else if (hoursSinceLastSale <= 168) {
      score += 5
    } else {
      score += 2
    }
  }

  return Math.min(100, Math.round(score))
}

/**
 * Calculate confidence score (0-100)
 * Based on:
 * - Sample size (larger = more confident)
 * - Volatility (lower = more confident)
 * - Outlier ratio (lower = more confident)
 */
function calculateConfidenceScore(
  sampleSize90d: number,
  volatility: number | null,
  outlierRatio: number | null
): number {
  let score = 0

  // Component 1: Sample size (50 points max)
  // 30+ sales in 90d = full points
  score += Math.min(50, (sampleSize90d / 30) * 50)

  // Component 2: Low volatility (30 points max)
  if (volatility !== null) {
    // CV < 10% = full points, CV > 50% = 0 points
    const volatilityScore = Math.max(0, 30 - (volatility / 50) * 30)
    score += volatilityScore
  } else {
    // No volatility data (single data point) = penalty
    score += 10
  }

  // Component 3: Low outlier ratio (20 points max)
  if (outlierRatio !== null) {
    // Outlier ratio < 5% = full points, > 20% = 0 points
    const outlierScore = Math.max(0, 20 - (outlierRatio / 0.2) * 20)
    score += outlierScore
  } else {
    // No outliers = full points
    score += 20
  }

  return Math.min(100, Math.round(score))
}

// ============================================================================
// METRICS COMPUTATION
// ============================================================================

/**
 * Compute metrics for a specific (SKU, size, currency, marketplace) combination
 */
async function computeMetricsForGroup(
  transactions: TransactionRow[]
): Promise<EbayComputedMetric | null> {
  if (transactions.length === 0) return null

  // All transactions should have same grouping keys
  const first = transactions[0]
  const sku = first.sku
  const sizeKey = first.size_key
  const sizeSystem = first.size_system
  const currencyCode = first.currency_code
  const marketplaceId = first.marketplace_id

  // Filter to only included transactions for price calculations
  const included = transactions.filter((t) => t.included_in_metrics)

  // Calculate time windows
  const now = new Date()
  const cutoff72h = new Date(now.getTime() - 72 * 60 * 60 * 1000)
  const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const cutoff90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // Filter transactions by time window
  const tx72h = included.filter((t) => new Date(t.sold_at) >= cutoff72h)
  const tx7d = included.filter((t) => new Date(t.sold_at) >= cutoff7d)
  const tx30d = included.filter((t) => new Date(t.sold_at) >= cutoff30d)
  const tx90d = included.filter((t) => new Date(t.sold_at) >= cutoff90d)

  // Extract prices
  const prices72h = tx72h.map((t) => t.sale_price_cents)
  const prices7d = tx7d.map((t) => t.sale_price_cents)
  const prices30d = tx30d.map((t) => t.sale_price_cents)
  const prices90d = tx90d.map((t) => t.sale_price_cents)

  // Calculate rolling medians
  const median72h = calculateMedian(prices72h)
  const median7d = calculateMedian(prices7d)
  const median30d = calculateMedian(prices30d)
  const median90d = calculateMedian(prices90d)

  // Price ranges
  const minPrice90d = prices90d.length > 0 ? Math.min(...prices90d) : null
  const maxPrice90d = prices90d.length > 0 ? Math.max(...prices90d) : null

  // Volatility
  const volatility90d = calculateVolatility(prices90d)

  // Outlier statistics (from all transactions in 90d window, not just included)
  const allTx90d = transactions.filter((t) => new Date(t.sold_at) >= cutoff90d)
  const totalSales90d = allTx90d.length
  const outlierCount90d = allTx90d.filter((t) => t.is_outlier).length
  const outlierRatio90d = totalSales90d > 0 ? outlierCount90d / totalSales90d : null

  // Last sale timestamp
  const sortedByDate = [...included].sort(
    (a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime()
  )
  const lastSaleAt = sortedByDate.length > 0 ? sortedByDate[0].sold_at : null

  // Calculate scores
  const liquidityScore = calculateLiquidityScore(
    tx72h.length,
    tx7d.length,
    tx30d.length,
    lastSaleAt ? new Date(lastSaleAt) : null
  )

  const confidenceScore = calculateConfidenceScore(tx90d.length, volatility90d, outlierRatio90d)

  return {
    // Product identification
    sku,
    size_key: sizeKey,
    size_system: sizeSystem,
    currency_code: currencyCode,
    marketplace_id: marketplaceId,

    // Rolling medians
    median_72h_cents: median72h !== null ? Math.round(median72h) : null,
    median_7d_cents: median7d !== null ? Math.round(median7d) : null,
    median_30d_cents: median30d !== null ? Math.round(median30d) : null,
    median_90d_cents: median90d !== null ? Math.round(median90d) : null,

    // Sample sizes
    sample_size_72h: tx72h.length,
    sample_size_7d: tx7d.length,
    sample_size_30d: tx30d.length,
    sample_size_90d: tx90d.length,

    // Price ranges
    min_price_90d_cents: minPrice90d,
    max_price_90d_cents: maxPrice90d,

    // Volatility
    volatility_90d: volatility90d,

    // Scores
    liquidity_score: liquidityScore,
    confidence_score: confidenceScore,

    // Outlier stats
    total_sales_90d: totalSales90d,
    outlier_count_90d: outlierCount90d,
    outlier_ratio_90d: outlierRatio90d,

    // Metadata
    computed_at: new Date().toISOString(),
    last_sale_at: lastSaleAt,
  }
}

// ============================================================================
// MAIN COMPUTE FUNCTION
// ============================================================================

/**
 * Compute metrics for all (or filtered) SKUs from ebay_sold_transactions
 * Stores results in ebay_computed_metrics table
 */
export async function computeEbayMetrics(
  options: ComputeMetricsOptions = {}
): Promise<EbayComputedMetric[]> {
  const { sku, sizeKey, marketplaceId = 'EBAY_GB', dryRun = false } = options

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Build query
  let query = supabase
    .from('ebay_sold_transactions')
    .select('sku, size_key, size_system, currency_code, marketplace_id, sale_price_cents, sold_at, is_outlier, included_in_metrics')
    .eq('marketplace_id', marketplaceId)

  if (sku) {
    query = query.eq('sku', sku)
  }

  if (sizeKey) {
    query = query.eq('size_key', sizeKey)
  }

  const { data: transactions, error } = await query

  if (error) {
    console.error('[eBay Metrics Computation] Query failed:', error)
    throw error
  }

  if (!transactions || transactions.length === 0) {
    console.log('[eBay Metrics Computation] No transactions found', { sku, sizeKey, marketplaceId })
    return []
  }

  // Group transactions by (sku, size_key, currency_code, marketplace_id)
  const groups = new Map<string, TransactionRow[]>()

  for (const tx of transactions as TransactionRow[]) {
    const key = `${tx.sku}|${tx.size_key}|${tx.currency_code}|${tx.marketplace_id}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(tx)
  }

  console.log('[eBay Metrics Computation] Found groups:', {
    totalTransactions: transactions.length,
    uniqueGroups: groups.size,
  })

  // Compute metrics for each group
  const metrics: EbayComputedMetric[] = []

  for (const [key, groupTransactions] of groups.entries()) {
    const metric = await computeMetricsForGroup(groupTransactions)
    if (metric) {
      metrics.push(metric)
    }
  }

  console.log('[eBay Metrics Computation] Computed metrics:', {
    totalMetrics: metrics.length,
    withData72h: metrics.filter((m) => m.median_72h_cents !== null).length,
    withData7d: metrics.filter((m) => m.median_7d_cents !== null).length,
    withData30d: metrics.filter((m) => m.median_30d_cents !== null).length,
    withData90d: metrics.filter((m) => m.median_90d_cents !== null).length,
  })

  // If dry run, return without upserting
  if (dryRun) {
    console.log('[eBay Metrics Computation] DRY RUN - Not upserting metrics')
    return metrics
  }

  // Upsert into ebay_computed_metrics
  const { data, error: upsertError } = await supabase
    .from('ebay_computed_metrics')
    .upsert(metrics, {
      onConflict: 'sku,size_key,currency_code,marketplace_id',
      ignoreDuplicates: false,
    })
    .select()

  if (upsertError) {
    console.error('[eBay Metrics Computation] Upsert failed:', upsertError)
    throw upsertError
  }

  console.log('[eBay Metrics Computation] Successfully upserted:', {
    metricsCount: data?.length || metrics.length,
  })

  return data || metrics
}
