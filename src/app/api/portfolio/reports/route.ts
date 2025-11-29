import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Portfolio Reports API
 *
 * Returns aggregated metrics for a given date range:
 * - Sales metrics (income, profit from sold items, count sold)
 * - Purchase metrics (item spend, count purchased)
 * - Expense metrics (fees, taxes, shipping)
 * - Net profit calculations
 *
 * Performance: 60s server-side LRU cache by (userId, currency, dateRange)
 */

export interface ReportMetrics {
  // Sales metrics (from sold items)
  salesIncome: number // sum(sold_price)
  netProfitFromSold: number // sum(sold_price - purchase_total - sales_fee)
  itemsSold: number // count

  // Purchase metrics
  itemSpend: number // sum(purchase_total)
  itemsPurchased: number // count

  // Expense metrics
  subscriptionSpend: number // monthly subscription costs prorated for period
  expenseSpend: number // sum of tax, shipping, sales_fee

  // Calculated totals
  totalSpend: number // itemSpend + subscriptionSpend
  netProfit: number // salesIncome - totalSpend - expenseSpend

  // Period info
  dateRange: { from: string; to: string }
  currency: 'GBP' | 'EUR' | 'USD'
}

// Simple in-memory cache (60s TTL)
const cache = new Map<string, { data: ReportMetrics; expiresAt: number }>()

function getCacheKey(userId: string, currency: string, from: string, to: string): string {
  return `${userId}:${currency}:${from}:${to}`
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const searchParams = request.nextUrl.searchParams
    const currency = (searchParams.get('currency') || 'GBP') as 'GBP' | 'EUR' | 'USD'
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'Missing date range parameters (from, to)' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check cache
    const cacheKey = getCacheKey(user.id, currency, from, to)
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      logger.apiRequest(
        '/api/portfolio/reports',
        { currency, user_id: user.id, from, to, cached: true },
        Date.now() - startTime,
        {}
      )
      return NextResponse.json(cached.data)
    }

    // ==========================================
    // 1. FETCH SOLD ITEMS IN PERIOD
    // ==========================================
    const { data: soldItems, error: soldError } = await supabase
      .from('Inventory')
      .select('id, purchase_price, tax, shipping, purchase_total, sold_price, sales_fee, sold_date')
      .eq('user_id', user.id)
      .eq('status', 'sold')
      .gte('sold_date', from)
      .lte('sold_date', to)

    if (soldError) {
      throw soldError
    }

    // Calculate sales metrics
    let salesIncome = 0
    let salesFees = 0
    let costOfSoldItems = 0
    const itemsSold = soldItems?.length || 0

    soldItems?.forEach((item) => {
      const salePrice = item.sold_price || 0
      const saleFee = item.sales_fee || 0
      const cost = item.purchase_total || item.purchase_price + (item.tax || 0) + (item.shipping || 0)

      salesIncome += salePrice
      salesFees += saleFee
      costOfSoldItems += cost
    })

    const netProfitFromSold = salesIncome - costOfSoldItems - salesFees

    // ==========================================
    // 2. FETCH PURCHASED ITEMS IN PERIOD
    // ==========================================
    const { data: purchasedItems, error: purchaseError } = await supabase
      .from('Inventory')
      .select('id, purchase_price, tax, shipping, purchase_total, purchase_date, created_at')
      .eq('user_id', user.id)
      .gte('purchase_date', from)
      .lte('purchase_date', to)

    if (purchaseError) {
      throw purchaseError
    }

    let itemSpend = 0
    const itemsPurchased = purchasedItems?.length || 0

    purchasedItems?.forEach((item) => {
      const cost = item.purchase_total || item.purchase_price + (item.tax || 0) + (item.shipping || 0)
      itemSpend += cost
    })

    // ==========================================
    // 3. SUBSCRIPTION SPEND (REMOVED)
    // ==========================================
    // Note: Subscription tracking feature has been removed.
    // Keeping this field at 0 for backward compatibility with API consumers.
    const subscriptionSpend = 0

    // ==========================================
    // 4. CALCULATE EXPENSE SPEND (TAX + SHIPPING + FEES)
    // ==========================================
    // Note: We already counted sales fees above, so just include purchase expenses
    let purchaseExpenses = 0
    purchasedItems?.forEach((item) => {
      purchaseExpenses += (item.tax || 0) + (item.shipping || 0)
    })

    const expenseSpend = purchaseExpenses + salesFees

    // ==========================================
    // 5. CALCULATE TOTALS
    // ==========================================
    const totalSpend = itemSpend + subscriptionSpend
    const netProfit = salesIncome - totalSpend - salesFees // Total profit considering all expenses

    const response: ReportMetrics = {
      salesIncome,
      netProfitFromSold,
      itemsSold,
      itemSpend,
      itemsPurchased,
      subscriptionSpend,
      expenseSpend,
      totalSpend,
      netProfit,
      dateRange: { from, to },
      currency,
    }

    // Cache for 60s
    cache.set(cacheKey, {
      data: response,
      expiresAt: Date.now() + 60 * 1000,
    })

    logger.apiRequest(
      '/api/portfolio/reports',
      { currency, user_id: user.id, from, to },
      Date.now() - startTime,
      {
        itemsSold,
        itemsPurchased,
        salesIncome,
        netProfit,
      }
    )

    return NextResponse.json(response)
  } catch (error: any) {
    logger.error('[Portfolio Reports] Error', {
      message: error.message,
      stack: error.stack,
    })

    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
