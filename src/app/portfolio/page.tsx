'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { supabase } from '@/lib/supabase/client'
import { useCurrency } from '@/hooks/useCurrency'
import { useDashboardReports, type DateRange } from '@/hooks/useDashboardReports'
import { useDashboardMovers } from '@/hooks/useDashboardMovers'

// V2 Components
import { TabBar, type DashboardView } from './components/TabBar'
import { DashboardHero } from './components/v2/DashboardHero'
import { DashboardChart, type Timeframe } from './components/v2/DashboardChart'
import { DashboardReports } from './components/v2/DashboardReports'
import { DashboardMovers } from './components/v2/DashboardMovers'
import { PortfolioInsights } from './components/v2/PortfolioInsights'
import { PortfolioComposition } from './components/v2/PortfolioComposition'
import { ReportsView } from './components/v2/ReportsView'
import { BreakdownView } from './components/v2/BreakdownView'

// UI Components
import { CurrencySwitcher } from '@/components/CurrencySwitcher'

// Helper to get date range from timeframe
function getDateRangeFromTimeframe(timeframe: Timeframe): DateRange {
  const today = new Date()
  const to = today.toISOString().split('T')[0]

  let from: string
  switch (timeframe) {
    case '24h':
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)
      from = yesterday.toISOString().split('T')[0]
      break
    case '1w':
      const lastWeek = new Date(today)
      lastWeek.setDate(today.getDate() - 7)
      from = lastWeek.toISOString().split('T')[0]
      break
    case '1m':
      const lastMonth = new Date(today)
      lastMonth.setMonth(today.getMonth() - 1)
      from = lastMonth.toISOString().split('T')[0]
      break
    case 'ytd':
      from = `${today.getFullYear()}-01-01`
      break
    case 'all':
      from = '2020-01-01' // Arbitrary start date for "all time"
      break
    case 'custom':
      // TODO: Implement custom date picker
      from = new Date(today.setMonth(today.getMonth() - 3)).toISOString().split('T')[0]
      break
  }

  return { from, to }
}

// Helper to filter series by timeframe
function filterSeriesByTimeframe(
  series: Array<{ date: string; value: number | null }>,
  timeframe: Timeframe
): Array<{ date: string; value: number | null }> {
  const dateRange = getDateRangeFromTimeframe(timeframe)
  return series.filter((point) => point.date >= dateRange.from && point.date <= dateRange.to)
}

export default function DashboardPage() {
  useRequireAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currency } = useCurrency()

  // URL state management for active view
  const viewParam = (searchParams?.get('view') || 'portfolio') as DashboardView
  const [activeView, setActiveView] = useState<DashboardView>(viewParam)

  // Update URL when view changes
  const handleViewChange = (view: DashboardView) => {
    setActiveView(view)
    const url = new URL(window.location.href)
    url.searchParams.set('view', view)
    router.push(url.pathname + url.search, { scroll: false })
  }

  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [timeframe, setTimeframe] = useState<Timeframe>('1m')
  const [moversSortBy, setMoversSortBy] = useState<'performance' | 'market_value'>('performance')

  // Get date range for reports based on timeframe
  const dateRange = useMemo(() => getDateRangeFromTimeframe(timeframe), [timeframe])

  // Fetch user ID
  useEffect(() => {
    const getUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      setUserId(sessionData.session?.user?.id)
    }
    getUser()
  }, [])

  // Fetch portfolio overview (for hero + chart)
  const [overviewData, setOverviewData] = useState<any>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)

  useEffect(() => {
    async function fetchOverview() {
      setOverviewLoading(true)
      try {
        const res = await fetch(`/api/portfolio/overview?currency=${currency}`, {
          signal: AbortSignal.timeout(8000) // 8 second timeout
        })
        if (!res.ok) throw new Error('Failed to fetch overview')
        const data = await res.json()
        setOverviewData(data)
      } catch (error) {
        console.error('[Dashboard] Error fetching overview:', error)
        // Set empty data so page doesn't stay loading forever
        setOverviewData({
          totalValue: 0,
          totalInvested: 0,
          totalProfit: 0,
          roi: 0,
          itemCount: 0,
          categoryBreakdown: [],
          missingPrices: []
        })
      } finally {
        setOverviewLoading(false)
      }
    }

    fetchOverview()
  }, [currency])

  // Fetch reports data
  const { data: reportsData, loading: reportsLoading } = useDashboardReports(dateRange, currency)

  // Fetch movers data
  const { movers, loading: moversLoading } = useDashboardMovers(moversSortBy)

  // Get item count from inventory
  const [itemCount, setItemCount] = useState(0)
  useEffect(() => {
    async function fetchItemCount() {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const userId = sessionData.session?.user?.id
        if (!userId) return

        const { count } = await supabase
          .from('Inventory')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'active')

        setItemCount(count || 0)
      } catch (error) {
        console.error('[Dashboard] Error fetching item count:', error)
      }
    }

    fetchItemCount()
  }, [])

  // Prepare hero metrics
  const heroMetrics = useMemo(() => {
    if (!overviewData || overviewData.isEmpty || !overviewData.kpis || !overviewData.meta) {
      return {
        estimatedValue: 0,
        invested: 0,
        unrealisedPL: 0,
        unrealisedPLDelta7d: null,
        roi: 0,
        itemCount: 0,
        pricesAsOf: new Date().toISOString(),
      }
    }

    return {
      estimatedValue: overviewData.kpis.estimatedValue ?? 0,
      invested: overviewData.kpis.invested ?? 0,
      unrealisedPL: overviewData.kpis.unrealisedPL ?? 0,
      unrealisedPLDelta7d: overviewData.kpis.unrealisedPLDelta7d ?? null,
      roi: overviewData.kpis.roi ?? 0,
      itemCount,
      pricesAsOf: overviewData.meta.pricesAsOf ?? new Date().toISOString(),
    }
  }, [overviewData, itemCount])

  // Prepare chart series (filtered by timeframe)
  const chartSeries = useMemo(() => {
    if (!overviewData || !overviewData.series30d) return []
    // If timeframe is longer than 30 days, we'd need to fetch more data from API
    // For now, just filter the 30-day series
    return filterSeriesByTimeframe(overviewData.series30d, timeframe)
  }, [overviewData, timeframe])

  // Prepare breakdown metrics
  const breakdownMetrics = useMemo(() => {
    if (!reportsData || !overviewData) {
      return {
        totalSales: 0,
        totalPurchases: 0,
        totalProfit: 0,
        itemCount: 0,
        retailValue: 0,
        marketValue: 0,
        unrealisedProfit: 0,
      }
    }

    return {
      totalSales: reportsData.salesIncome,
      totalPurchases: reportsData.totalSpend,
      totalProfit: reportsData.netProfit,
      itemCount: itemCount,
      retailValue: overviewData.kpis.invested,
      marketValue: overviewData.kpis.estimatedValue,
      unrealisedProfit: overviewData.kpis.unrealisedPL,
    }
  }, [reportsData, overviewData, itemCount])

  return (
    <>
      {/* Header - Hero Style */}
      <header
        className="relative px-4 sm:px-8 py-6 sm:py-8 md:py-12 border-b border-border/50 overflow-hidden sticky top-0 z-10"
        style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
      >
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-bg to-bg pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Backdrop blur for sticky effect */}
        <div className="absolute inset-0 bg-bg/80 backdrop-blur-md -z-10" />

        <div className="relative mx-auto max-w-[1440px]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-fg tracking-tight">
                  Dashboard
                </h1>
                <div className="px-2 sm:px-3 py-0.5 sm:py-1 bg-accent/10 border border-accent/20 rounded-full text-[10px] sm:text-xs font-semibold text-accent">
                  Live Data
                </div>
              </div>
              <p className="text-muted text-xs sm:text-sm md:text-base">
                Your Inventory & Profit Command Centre
              </p>
            </div>
            <CurrencySwitcher />
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="px-4 sm:px-8 py-4 sm:py-6">
        <div className="mx-auto max-w-[1440px] space-y-4 sm:space-y-5">
          {/* Tab Navigation */}
          <TabBar activeView={activeView} onViewChange={handleViewChange} />

          {/* Portfolio View (Original Dashboard) */}
          {activeView === 'portfolio' && (
            <>
              {/* Hero Section - 3 KPI Cards with Sparklines */}
              <DashboardHero metrics={heroMetrics} loading={overviewLoading} />

              {/* Portfolio Insights - AI-Powered Recommendations */}
              {!overviewLoading && movers.length > 0 && (
                <PortfolioInsights
                  movers={movers}
                  metrics={{
                    estimatedValue: heroMetrics.estimatedValue,
                    unrealisedPL: heroMetrics.unrealisedPL,
                    roi: heroMetrics.roi,
                    unrealisedPLDelta7d: heroMetrics.unrealisedPLDelta7d,
                  }}
                />
              )}

              {/* Portfolio Chart - Historical Performance */}
              <DashboardChart
                data={chartSeries}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                loading={overviewLoading}
              />

              {/* Composition + Movers (2-column layout) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                {/* Portfolio Composition (1/3 width) */}
                <div className="lg:col-span-1">
                  <PortfolioComposition movers={movers} loading={moversLoading} />
                </div>

                {/* Movers List (2/3 width - more prominent) */}
                <div className="lg:col-span-2">
                  <DashboardMovers
                    movers={movers}
                    loading={moversLoading}
                    sortBy={moversSortBy}
                    onSortChange={setMoversSortBy}
                  />
                </div>
              </div>

              {/* Reports Grid - Financial Metrics */}
              <DashboardReports data={reportsData} loading={reportsLoading} />
            </>
          )}

          {/* Reports View */}
          {activeView === 'reports' && (
            <ReportsView
              netProfit={reportsData?.netProfit ?? 0}
              salesIncome={reportsData?.salesIncome ?? 0}
              itemSpend={reportsData?.totalSpend ?? 0}
              netProfitFromSold={reportsData?.netProfitFromSold ?? 0}
              avgProfitPerSale={reportsData?.avgProfitPerSale ?? 0}
              conversionRate={reportsData?.conversionRate ?? 0}
              totalFees={reportsData?.totalFees ?? 0}
              avgHoldingPeriod={reportsData?.avgHoldingPeriod ?? 0}
            />
          )}

          {/* Breakdown View */}
          {activeView === 'breakdown' && (
            <BreakdownView metrics={breakdownMetrics} loading={overviewLoading || reportsLoading} />
          )}
        </div>
      </section>
    </>
  )
}
