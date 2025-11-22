import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Timeframe = '24h' | '1w' | 'mtd' | '1m' | '3m' | '1y' | 'all'

type MetricKey =
  | 'net_profit'
  | 'sales_income'
  | 'item_spend'
  | 'items_purchased'
  | 'items_sold'
  | 'subscription_spend'
  | 'expense_spend'
  | 'total_spend'
  | 'portfolio_value'
  | 'unrealised_pl'

interface SeriesPoint {
  date: string // YYYY-MM-DD
  value: number
}

interface SeriesResponse {
  metric: string
  timeframe: string
  currency: string
  points: SeriesPoint[]
}

/**
 * Map timeframe to date range
 */
function getDateRange(timeframe: Timeframe): { from: string; to: string } {
  const today = new Date()
  const to = today.toISOString().split('T')[0]

  let from: string

  switch (timeframe) {
    case '24h':
      // Last 2 days (snapshots are daily)
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 2)
      from = yesterday.toISOString().split('T')[0]
      break

    case '1w':
      const lastWeek = new Date(today)
      lastWeek.setDate(today.getDate() - 7)
      from = lastWeek.toISOString().split('T')[0]
      break

    case 'mtd':
      // Month to date
      from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
      break

    case '1m':
      const lastMonth = new Date(today)
      lastMonth.setMonth(today.getMonth() - 1)
      from = lastMonth.toISOString().split('T')[0]
      break

    case '3m':
      const last3Months = new Date(today)
      last3Months.setMonth(today.getMonth() - 3)
      from = last3Months.toISOString().split('T')[0]
      break

    case '1y':
      const lastYear = new Date(today)
      lastYear.setFullYear(today.getFullYear() - 1)
      from = lastYear.toISOString().split('T')[0]
      break

    case 'all':
      from = '2020-01-01' // Arbitrary start date
      break

    default:
      from = new Date(today.setMonth(today.getMonth() - 1)).toISOString().split('T')[0]
  }

  return { from, to }
}

/**
 * Map metric name to column name
 */
function getColumnName(metric: MetricKey): string {
  switch (metric) {
    case 'portfolio_value':
      return 'total_value'
    case 'unrealised_pl':
      return 'unrealised_pl'
    case 'net_profit':
      return 'net_profit'
    case 'sales_income':
      return 'sales_income'
    case 'item_spend':
      return 'item_spend'
    case 'subscription_spend':
      return 'subscription_spend'
    case 'expense_spend':
      return 'expense_spend'
    case 'total_spend':
      return 'total_spend'
    case 'items_purchased':
      return 'items_purchased'
    case 'items_sold':
      return 'items_sold'
    default:
      return 'total_value'
  }
}

/**
 * GET /api/portfolio/reports/series
 *
 * Query params:
 *   - metric (required): net_profit | sales_income | item_spend | etc.
 *   - timeframe (required): 24h | 1w | mtd | 1m | 3m | 1y | all
 *   - currency (optional): GBP | EUR | USD
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from cookies
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const metric = searchParams.get('metric') as MetricKey | null
    const timeframe = searchParams.get('timeframe') as Timeframe | null
    const currency = searchParams.get('currency') || 'GBP'

    if (!metric || !timeframe) {
      return NextResponse.json(
        { error: 'Missing required parameters: metric, timeframe' },
        { status: 400 }
      )
    }

    // Get date range
    const { from, to } = getDateRange(timeframe)

    // Get column name
    const columnName = getColumnName(metric)

    // Query portfolio_snapshots
    const { data: snapshots, error } = await supabase
      .from('portfolio_snapshots')
      .select(`date, ${columnName}`)
      .eq('user_id', user.id)
      .eq('currency', currency)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })

    if (error) {
      console.error('[Portfolio Series] Query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch time series data' },
        { status: 500 }
      )
    }

    // Transform to SeriesPoint[]
    const points: SeriesPoint[] = (snapshots || []).map((snapshot: any) => ({
      date: snapshot.date,
      value: parseFloat(snapshot[columnName] as string) || 0,
    }))

    const response: SeriesResponse = {
      metric,
      timeframe,
      currency,
      points,
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('[Portfolio Series] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
