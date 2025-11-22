'use client'

import { useState, useEffect } from 'react'
import type { Currency } from './useCurrency'

export interface DateRange {
  from: string
  to: string
}

export interface ReportMetrics {
  // Sales metrics (from sold items)
  salesIncome: number
  netProfitFromSold: number
  itemsSold: number

  // Purchase metrics
  itemSpend: number
  itemsPurchased: number

  // Expense metrics
  subscriptionSpend: number
  expenseSpend: number

  // Calculated totals
  totalSpend: number
  netProfit: number

  // Additional metrics
  avgProfitPerSale?: number
  conversionRate?: number
  totalFees?: number
  avgHoldingPeriod?: number

  // Period info
  dateRange: { from: string; to: string }
  currency: Currency
}

export function useDashboardReports(dateRange: DateRange, currency: Currency) {
  const [data, setData] = useState<ReportMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchReports() {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          currency,
          from: dateRange.from,
          to: dateRange.to,
        })

        const response = await fetch(`/api/portfolio/reports?${params.toString()}`)

        if (!response.ok) {
          throw new Error('Failed to fetch reports')
        }

        const result = await response.json()
        setData(result)
      } catch (err: any) {
        console.error('[useDashboardReports] Error:', err)
        setError(err.message || 'Failed to load reports')
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [dateRange.from, dateRange.to, currency])

  return { data, loading, error }
}
