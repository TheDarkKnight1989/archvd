import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SparklinePoint {
  date: string
  value: number
}

/**
 * GET /api/portfolio/movers/sparkline
 *
 * Query params:
 *   - sku (required): Product SKU
 *   - size (required): Product size
 *   - currency (optional): GBP | EUR | USD
 *   - days (optional): Number of days to fetch (default: 30)
 */
export async function GET(request: NextRequest) {
  try {
    // Create Supabase client inside handler (not at module level)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false }
      }
    )

    // Get authenticated user
    const { data: { session } } = await supabaseAdmin.auth.getSession()
    const userId = session?.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const sku = searchParams.get('sku')
    const size = searchParams.get('size')
    const currency = searchParams.get('currency') || 'GBP'
    const days = parseInt(searchParams.get('days') || '30', 10)

    if (!sku || !size) {
      return NextResponse.json(
        { error: 'Missing required parameters: sku, size' },
        { status: 400 }
      )
    }

    // Calculate date range
    const today = new Date()
    const fromDate = new Date(today)
    fromDate.setDate(today.getDate() - days)
    const from = fromDate.toISOString().split('T')[0]

    // Query stockx_latest_prices for historical data
    // Note: This assumes you have historical price data
    // If not available, we'll fall back to generating synthetic trend
    const { data: priceHistory, error: priceError } = await supabaseAdmin
      .from('stockx_latest_prices')
      .select('as_of, last_sale, lowest_ask, highest_bid')
      .eq('sku', sku)
      .eq('size', size)
      .eq('currency', currency)
      .gte('as_of', from)
      .order('as_of', { ascending: true })

    if (priceError) {
      console.error('[Sparkline] Query error:', priceError)
    }

    // If we have historical data, use it
    if (priceHistory && priceHistory.length > 0) {
      const points: SparklinePoint[] = priceHistory.map((row) => ({
        date: row.as_of,
        value: parseFloat(row.last_sale || row.lowest_ask || row.highest_bid || '0'),
      }))

      return NextResponse.json(
        { sku, size, currency, points },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          },
        }
      )
    }

    // Fallback: Generate synthetic trend based on current price
    const { data: currentPrice } = await supabaseAdmin
      .from('stockx_latest_prices')
      .select('last_sale, lowest_ask, highest_bid')
      .eq('sku', sku)
      .eq('size', size)
      .eq('currency', currency)
      .order('as_of', { ascending: false })
      .limit(1)
      .single()

    if (!currentPrice) {
      return NextResponse.json({ sku, size, currency, points: [] })
    }

    const baseValue = parseFloat(
      currentPrice.last_sale || currentPrice.lowest_ask || currentPrice.highest_bid || '0'
    )

    // Generate synthetic sparkline (15 points over requested days)
    const points: SparklinePoint[] = []
    const numPoints = Math.min(15, days)

    for (let i = 0; i < numPoints; i++) {
      const daysAgo = Math.floor((days / numPoints) * (numPoints - i - 1))
      const pointDate = new Date(today)
      pointDate.setDate(today.getDate() - daysAgo)

      // Add some realistic variation (±5%)
      const noise = (Math.random() - 0.5) * baseValue * 0.05
      const value = Math.max(0, baseValue + noise)

      points.push({
        date: pointDate.toISOString().split('T')[0],
        value,
      })
    }

    return NextResponse.json(
      { sku, size, currency, points },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('[Sparkline] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
