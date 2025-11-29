/**
 * P&L Period Comparison Utilities
 * Calculate period-over-period changes (MoM, YoY)
 */

import type { DateRange } from '@/lib/date/range'

export interface PeriodComparison {
  current: number
  previous: number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'neutral'
}

export interface ComparisonMetrics {
  revenue: PeriodComparison
  cogs: PeriodComparison
  grossProfit: PeriodComparison
  expenses: PeriodComparison
  netProfit: PeriodComparison
  numSales: PeriodComparison
  avgOrderValue: PeriodComparison
  grossMargin: PeriodComparison
}

/**
 * Calculate the previous period range based on current range
 */
export function getPreviousPeriodRange(currentRange: DateRange): DateRange {
  const fromDate = new Date(currentRange.from)
  const toDate = new Date(currentRange.to)

  // Calculate period length in days
  const periodLength = Math.floor(
    (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Previous period = same length, immediately before current period
  const prevTo = new Date(fromDate)
  prevTo.setDate(prevTo.getDate() - 1)

  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - periodLength)

  return {
    from: formatDate(prevFrom),
    to: formatDate(prevTo)
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Calculate comparison for a single metric
 */
export function calculateComparison(
  current: number,
  previous: number
): PeriodComparison {
  const change = current - previous
  const changePercent = previous !== 0 ? (change / previous) * 100 : current > 0 ? 100 : 0

  let trend: 'up' | 'down' | 'neutral' = 'neutral'
  if (Math.abs(changePercent) >= 1) {
    trend = changePercent > 0 ? 'up' : 'down'
  }

  return {
    current,
    previous,
    change,
    changePercent,
    trend
  }
}

/**
 * Calculate all comparison metrics
 */
export function calculateComparisonMetrics(
  currentKPIs: {
    revenue: number
    cogs: number
    grossProfit: number
    expenses: number
    netProfit: number
    numSales: number
  },
  previousKPIs: {
    revenue: number
    cogs: number
    grossProfit: number
    expenses: number
    netProfit: number
    numSales: number
  }
): ComparisonMetrics {
  const currentAvgOrderValue = currentKPIs.numSales > 0 ? currentKPIs.revenue / currentKPIs.numSales : 0
  const previousAvgOrderValue = previousKPIs.numSales > 0 ? previousKPIs.revenue / previousKPIs.numSales : 0

  const currentGrossMargin = currentKPIs.revenue > 0 ? (currentKPIs.grossProfit / currentKPIs.revenue) * 100 : 0
  const previousGrossMargin = previousKPIs.revenue > 0 ? (previousKPIs.grossProfit / previousKPIs.revenue) * 100 : 0

  return {
    revenue: calculateComparison(currentKPIs.revenue, previousKPIs.revenue),
    cogs: calculateComparison(currentKPIs.cogs, previousKPIs.cogs),
    grossProfit: calculateComparison(currentKPIs.grossProfit, previousKPIs.grossProfit),
    expenses: calculateComparison(currentKPIs.expenses, previousKPIs.expenses),
    netProfit: calculateComparison(currentKPIs.netProfit, previousKPIs.netProfit),
    numSales: calculateComparison(currentKPIs.numSales, previousKPIs.numSales),
    avgOrderValue: calculateComparison(currentAvgOrderValue, previousAvgOrderValue),
    grossMargin: calculateComparison(currentGrossMargin, previousGrossMargin)
  }
}

/**
 * Get comparison label (e.g., "vs Last Month", "vs Last Period")
 */
export function getComparisonLabel(periodLength: number): string {
  if (periodLength <= 31) return 'vs Last Month'
  if (periodLength <= 92) return 'vs Last Quarter'
  if (periodLength <= 366) return 'vs Last Year'
  return 'vs Previous Period'
}
