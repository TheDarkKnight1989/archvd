// Price Refresh Worker - Fetches per-size market prices from StockX and Laced
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface PriceData {
  size: string
  price: number
  currency: string
  meta?: Record<string, any>
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    })

    if (res.status === 429) {
      const delay = Math.pow(2, i) * 1000 // 1s, 2s, 4s
      console.log(`[Price Worker] Rate limited, retrying in ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
      continue
    }

    return res
  }
  throw new Error('Rate limited after retries')
}

async function fetchStockXPrices(sku: string): Promise<PriceData[]> {
  try {
    // TODO: Implement StockX API integration
    // This is a placeholder - requires actual StockX API or scraping logic
    console.log(`[StockX] Fetching prices for ${sku}...`)

    // Mock implementation for testing
    return []
  } catch (error: any) {
    console.error(`[StockX] Failed to fetch ${sku}:`, error.message)
    return []
  }
}

async function fetchLacedPrices(sku: string): Promise<PriceData[]> {
  try {
    // TODO: Implement Laced API integration
    // This is a placeholder - requires actual Laced API or scraping logic
    console.log(`[Laced] Fetching prices for ${sku}...`)

    // Mock implementation for testing
    return []
  } catch (error: any) {
    console.error(`[Laced] Failed to fetch ${sku}:`, error.message)
    return []
  }
}

async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  supabase: any
): Promise<number> {
  if (fromCurrency === toCurrency) return amount

  // Fetch latest FX rate
  const { data: fxRate } = await supabase
    .from('fx_rates')
    .select('rate')
    .eq('from_currency', fromCurrency)
    .eq('to_currency', toCurrency)
    .order('as_of', { ascending: false })
    .limit(1)
    .single()

  if (!fxRate) {
    console.warn(`[FX] No rate found for ${fromCurrency} -> ${toCurrency}, using 1:1`)
    return amount
  }

  return amount * fxRate.rate
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const metrics = {
    started_at: new Date().toISOString(),
    skus_processed: 0,
    prices_inserted: 0,
    prices_failed: 0,
    errors: [] as string[]
  }

  try {
    // Fetch all catalog SKUs (limit to batch for performance)
    const batchSize = parseInt(request.nextUrl.searchParams.get('limit') || '100')
    const { data: products, error: productsError } = await supabase
      .from('product_catalog')
      .select('sku')
      .limit(batchSize)

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`)
    }

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No products to process',
        metrics
      })
    }

    console.log(`[Price Worker] Processing ${products.length} SKUs...`)

    for (const { sku } of products) {
      try {
        console.log(`[Price Worker] Processing ${sku}...`)

        // 1. Fetch prices from StockX (primary source)
        let prices = await fetchStockXPrices(sku)

        // 2. Fallback to Laced if StockX fails
        if (prices.length === 0) {
          console.log(`[Price Worker] StockX returned no prices, trying Laced...`)
          prices = await fetchLacedPrices(sku)
        }

        if (prices.length === 0) {
          console.log(`[Price Worker] No prices found for ${sku}`)
          metrics.prices_failed++
          metrics.skus_processed++
          continue
        }

        // 3. Convert to GBP and insert
        for (const priceData of prices) {
          try {
            const gbpPrice = await convertCurrency(
              priceData.price,
              priceData.currency,
              'GBP',
              supabase
            )

            const source = priceData.meta?.source || 'stockx'

            const { error: insertError } = await supabase
              .from('product_market_prices')
              .insert({
                sku: sku.toUpperCase(),
                size: priceData.size,
                source,
                currency: 'GBP',
                price: gbpPrice,
                as_of: new Date().toISOString(),
                meta: priceData.meta || {}
              })

            if (insertError) {
              // Ignore duplicate constraint errors
              if (insertError.code !== '23505') {
                console.error(`[Price Worker] Insert error for ${sku} ${priceData.size}:`, insertError)
                metrics.errors.push(`${sku} ${priceData.size}: ${insertError.message}`)
              }
              continue
            }

            metrics.prices_inserted++
          } catch (conversionError: any) {
            console.error(`[Price Worker] Conversion error for ${sku}:`, conversionError)
            metrics.errors.push(`${sku}: ${conversionError.message}`)
          }
        }

        metrics.skus_processed++

        // Rate limit: 1 request per second for StockX
        await new Promise(r => setTimeout(r, 1000))

      } catch (skuError: any) {
        console.error(`[Price Worker] Failed to process ${sku}:`, skuError)
        metrics.errors.push(`${sku}: ${skuError.message}`)
        metrics.prices_failed++
      }
    }

    // Log metrics to worker_logs table
    try {
      await supabase.from('worker_logs').insert({
        worker_name: 'price_refresh_v2',
        started_at: metrics.started_at,
        completed_at: new Date().toISOString(),
        status: metrics.errors.length > 0 ? 'partial_success' : 'success',
        metrics
      })
    } catch (logError) {
      console.error('[Price Worker] Failed to log metrics:', logError)
    }

    return NextResponse.json({
      success: true,
      metrics
    })

  } catch (error: any) {
    console.error('[Price Worker] Fatal error:', error)

    // Log failure
    try {
      await supabase.from('worker_logs').insert({
        worker_name: 'price_refresh_v2',
        started_at: metrics.started_at,
        completed_at: new Date().toISOString(),
        status: 'failed',
        metrics: {
          ...metrics,
          fatal_error: error.message
        }
      })
    } catch (logError) {
      console.error('[Price Worker] Failed to log error:', logError)
    }

    return NextResponse.json(
      { error: 'Price refresh failed', details: error.message },
      { status: 500 }
    )
  }
}

// Allow POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}
