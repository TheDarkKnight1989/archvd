/**
 * StockX Worker - Batch processor for StockX market data jobs
 * WHY: Fetch market data with proper rate limiting and error handling
 */

import { createClient } from '@/lib/supabase/service'
import { sleep } from '@/lib/sleep'
import { upsertMarketPriceIfStale, upsertProductCatalog } from '@/lib/market/upsert'
import { nowUtc } from '@/lib/time'

export interface StockXJob {
  id: string
  sku: string
  size: string | null
  user_id?: string | null  // For fetching user's currency preference
}

export interface StockXWorkerResult {
  succeeded: number
  failed: number
  deferred: number
  details: Array<{
    jobId: string
    status: 'done' | 'failed' | 'deferred'
    message?: string
  }>
}

// Rate limiting: 600ms between requests (100/hour with buffer)
const DELAY_MS = 600

/**
 * Process a batch of StockX jobs
 */
export async function processStockXBatch(
  jobs: StockXJob[],
  runId: string
): Promise<StockXWorkerResult> {
  const supabase = createClient()
  const result: StockXWorkerResult = {
    succeeded: 0,
    failed: 0,
    deferred: 0,
    details: [],
  }

  console.log(`[StockX Worker ${runId}] Processing ${jobs.length} jobs`)

  // Get StockX credentials (use first user's account for now)
  // TODO: Support multi-user accounts
  const { data: account } = await supabase
    .from('stockx_accounts')
    .select('access_token')
    .limit(1)
    .single()

  if (!account?.access_token) {
    console.error(`[StockX Worker ${runId}] No StockX account found`)

    // Mark all jobs as failed
    for (const job of jobs) {
      await supabase
        .from('market_jobs')
        .update({
          status: 'failed',
          completed_at: nowUtc(),
          error_message: 'No StockX account configured',
        })
        .eq('id', job.id)

      result.failed++
      result.details.push({ jobId: job.id, status: 'failed', message: 'No StockX account' })
    }

    return result
  }

  const accessToken = account.access_token
  const apiKey = process.env.STOCKX_API_KEY

  if (!apiKey) {
    console.error(`[StockX Worker ${runId}] No STOCKX_API_KEY configured`)

    // Mark all jobs as failed
    for (const job of jobs) {
      await supabase
        .from('market_jobs')
        .update({
          status: 'failed',
          completed_at: nowUtc(),
          error_message: 'No API key configured',
        })
        .eq('id', job.id)

      result.failed++
      result.details.push({ jobId: job.id, status: 'failed', message: 'No API key' })
    }

    return result
  }

  // Get user's base currency (defaults to GBP if not set or no user)
  const getUserCurrency = async (userId: string | null): Promise<string> => {
    if (!userId) return 'GBP'

    const { data: profile } = await supabase
      .from('profiles')
      .select('base_currency')
      .eq('id', userId)
      .single()

    return profile?.base_currency || 'GBP'
  }

  // Process each job with rate limiting
  for (const job of jobs) {
    try {
      console.log(`[StockX Worker ${runId}] Processing ${job.sku}${job.size ? `:${job.size}` : ''}`)

      // Get user's currency preference
      const currencyCode = await getUserCurrency(job.user_id || null)
      console.log(`[StockX Worker ${runId}] Using currency: ${currencyCode}`)

      // 1. Search for product
      const searchUrl = `https://api.stockx.com/v2/catalog/search?query=${encodeURIComponent(job.sku)}`
      const searchRes = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': apiKey,
          'Accept': 'application/json',
        },
      })

      if (searchRes.status === 429) {
        console.log(`[StockX Worker ${runId}] Rate limited, deferring remaining jobs`)

        // Defer this job and all remaining
        await supabase
          .from('market_jobs')
          .update({
            status: 'deferred',
            completed_at: nowUtc(),
          })
          .eq('id', job.id)

        result.deferred++
        result.details.push({ jobId: job.id, status: 'deferred', message: 'Rate limited' })

        // Defer remaining jobs
        const remaining = jobs.slice(jobs.indexOf(job) + 1)
        for (const remainingJob of remaining) {
          await supabase
            .from('market_jobs')
            .update({ status: 'pending', started_at: null })
            .eq('id', remainingJob.id)

          result.deferred++
          result.details.push({ jobId: remainingJob.id, status: 'deferred', message: 'Batch rate limited' })
        }

        break
      }

      if (!searchRes.ok) {
        throw new Error(`Search failed: ${searchRes.status}`)
      }

      const searchData = await searchRes.json()

      if (!searchData.products || searchData.products.length === 0) {
        throw new Error('Product not found')
      }

      const product = searchData.products[0]
      const productId = product.id

      // WHY: Cache product metadata (brand, model, colorway) to ensure UI always has fallback data
      // Extract from StockX product data structure
      const brand = product.brand || product.traits?.brand || extractBrandFromTitle(product.title || product.name)
      const model = product.name || product.title || job.sku
      const colorway = product.colorway || product.traits?.colorway || null

      // Upsert product catalog data with metadata
      await upsertProductCatalog({
        sku: job.sku,
        brand: brand || 'Unknown',
        model: model,
        colorway: colorway,
        image_url: product.media?.imageUrl || constructImageUrl(product.urlKey),
        provider: 'stockx',
      })

      // If job has size, fetch variant market data
      if (job.size) {
        await sleep(DELAY_MS)

        // 2. Get variants to find variantId for this size
        const variantsUrl = `https://api.stockx.com/v2/catalog/products/${productId}/variants`
        const variantsRes = await fetch(variantsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-api-key': apiKey,
            'Accept': 'application/json',
          },
        })

        if (variantsRes.status === 429) {
          await supabase
            .from('market_jobs')
            .update({ status: 'deferred', completed_at: nowUtc() })
            .eq('id', job.id)

          result.deferred++
          result.details.push({ jobId: job.id, status: 'deferred', message: 'Rate limited on variants' })
          continue
        }

        if (!variantsRes.ok) {
          throw new Error(`Variants failed: ${variantsRes.status}`)
        }

        const variantsData = await variantsRes.json()
        const variant = variantsData.variants?.find((v: any) =>
          String(v.sizeAllTypes?.us) === job.size ||
          String(v.sizeAllTypes?.uk) === job.size ||
          String(v.sizeAllTypes?.eu) === job.size
        )

        if (!variant) {
          throw new Error(`Size ${job.size} not found`)
        }

        const variantId = variant.id

        await sleep(DELAY_MS)

        // 3. Get market data for variant with user's currency
        const marketUrl = `https://api.stockx.com/v2/catalog/products/${productId}/variants/${variantId}/market-data?currencyCode=${currencyCode}`
        const marketRes = await fetch(marketUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-api-key': apiKey,
            'Accept': 'application/json',
          },
        })

        if (marketRes.status === 429) {
          await supabase
            .from('market_jobs')
            .update({ status: 'deferred', completed_at: nowUtc() })
            .eq('id', job.id)

          result.deferred++
          result.details.push({ jobId: job.id, status: 'deferred', message: 'Rate limited on market data' })
          continue
        }

        if (!marketRes.ok) {
          throw new Error(`Market data failed: ${marketRes.status}`)
        }

        const marketData = await marketRes.json()

        // Upsert market price with user's currency
        await upsertMarketPriceIfStale({
          provider: 'stockx',
          sku: job.sku, // Fixed: use 'sku' not 'product_sku'
          size: job.size,
          lowest_ask: marketData.lowestAskAmount ? parseFloat(marketData.lowestAskAmount) : undefined,
          highest_bid: marketData.highestBidAmount ? parseFloat(marketData.highestBidAmount) : undefined,
          last_sale: marketData.lastSaleAmount ? parseFloat(marketData.lastSaleAmount) : undefined,
          currency: currencyCode,
          as_of: nowUtc(), // Fixed: add required as_of timestamp
        })

        const symbol = currencyCode === 'GBP' ? '£' : currencyCode === 'EUR' ? '€' : '$'
        console.log(`[StockX Worker ${runId}] ✓ ${job.sku}:${job.size} - ${symbol}${marketData.lastSaleAmount || marketData.lowestAskAmount} (${currencyCode})`)
      }

      // Mark job as done
      await supabase
        .from('market_jobs')
        .update({
          status: 'done',
          completed_at: nowUtc(),
        })
        .eq('id', job.id)

      result.succeeded++
      result.details.push({ jobId: job.id, status: 'done' })

      // Rate limit between jobs
      if (jobs.indexOf(job) < jobs.length - 1) {
        await sleep(DELAY_MS)
      }

    } catch (error) {
      console.error(`[StockX Worker ${runId}] ✗ ${job.sku}:`, error)

      // Mark job as failed
      await supabase
        .from('market_jobs')
        .update({
          status: 'failed',
          completed_at: nowUtc(),
          error_message: String(error),
          retry_count: supabase.rpc('increment', { row_id: job.id }),
        })
        .eq('id', job.id)

      result.failed++
      result.details.push({ jobId: job.id, status: 'failed', message: String(error) })
    }
  }

  console.log(`[StockX Worker ${runId}] Completed: ${result.succeeded} succeeded, ${result.failed} failed, ${result.deferred} deferred`)

  return result
}

/**
 * Construct StockX CDN image URL from urlKey
 * e.g. "nike-dunk-low-retro-white-black-2021" → "Nike-Dunk-Low-Retro-White-Black-2021"
 */
function constructImageUrl(urlKey: string | null): string | null {
  if (!urlKey) return null

  const imageUrlKey = urlKey
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-')

  return `https://images.stockx.com/images/${imageUrlKey}.jpg`
}

/**
 * Extract brand from product title as fallback
 * e.g. "Nike Dunk Low White Black" → "Nike"
 */
function extractBrandFromTitle(title?: string): string | null {
  if (!title) return null

  const knownBrands = ['Nike', 'Adidas', 'Jordan', 'Yeezy', 'New Balance', 'Asics', 'Puma', 'Reebok', 'Vans', 'Converse']
  const firstWord = title.split(' ')[0]

  // Check if first word matches a known brand (case-insensitive)
  const matchedBrand = knownBrands.find(brand => brand.toLowerCase() === firstWord.toLowerCase())

  return matchedBrand || firstWord
}
