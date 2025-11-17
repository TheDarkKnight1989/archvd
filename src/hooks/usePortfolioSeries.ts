import { useState, useEffect } from 'react'
import { useCurrency } from './useCurrency'

export type Timeframe = '24h' | '1w' | 'mtd' | '1m' | '3m' | '1y' | 'all'

export type MetricKey =
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

export interface SeriesPoint {
  date: string
  value: number
}

interface SeriesData {
  metric: string
  timeframe: string
  currency: string
  points: SeriesPoint[]
}

/**
 * Fetch time-series data for a specific metric
 */
async function fetchMetricSeries(
  metric: MetricKey,
  timeframe: Timeframe,
  currency: string
): Promise<SeriesPoint[]> {
  try {
    const params = new URLSearchParams({
      metric,
      timeframe,
      currency,
    })

    const response = await fetch(`/api/portfolio/reports/series?${params}`)

    if (!response.ok) {
      console.error(`[usePortfolioSeries] Failed to fetch ${metric}:`, response.statusText)
      return []
    }

    const data: SeriesData = await response.json()
    return data.points || []
  } catch (error) {
    console.error(`[usePortfolioSeries] Error fetching ${metric}:`, error)
    return []
  }
}

/**
 * Hook to fetch time-series data for multiple metrics
 */
export function usePortfolioSeries(timeframe: Timeframe) {
  const { currency } = useCurrency()

  const [data, setData] = useState<Record<MetricKey, SeriesPoint[]>>({
    net_profit: [],
    sales_income: [],
    item_spend: [],
    items_purchased: [],
    items_sold: [],
    subscription_spend: [],
    expense_spend: [],
    total_spend: [],
    portfolio_value: [],
    unrealised_pl: [],
  })

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSeries() {
      setLoading(true)

      // Fetch all metrics in parallel
      const [
        netProfit,
        salesIncome,
        itemSpend,
        itemsPurchased,
        itemsSold,
        subscriptionSpend,
        expenseSpend,
        totalSpend,
        portfolioValue,
        unrealisedPL,
      ] = await Promise.all([
        fetchMetricSeries('net_profit', timeframe, currency),
        fetchMetricSeries('sales_income', timeframe, currency),
        fetchMetricSeries('item_spend', timeframe, currency),
        fetchMetricSeries('items_purchased', timeframe, currency),
        fetchMetricSeries('items_sold', timeframe, currency),
        fetchMetricSeries('subscription_spend', timeframe, currency),
        fetchMetricSeries('expense_spend', timeframe, currency),
        fetchMetricSeries('total_spend', timeframe, currency),
        fetchMetricSeries('portfolio_value', timeframe, currency),
        fetchMetricSeries('unrealised_pl', timeframe, currency),
      ])

      setData({
        net_profit: netProfit,
        sales_income: salesIncome,
        item_spend: itemSpend,
        items_purchased: itemsPurchased,
        items_sold: itemsSold,
        subscription_spend: subscriptionSpend,
        expense_spend: expenseSpend,
        total_spend: totalSpend,
        portfolio_value: portfolioValue,
        unrealised_pl: unrealisedPL,
      })

      setLoading(false)
    }

    loadSeries()
  }, [timeframe, currency])

  return { data, loading }
}
