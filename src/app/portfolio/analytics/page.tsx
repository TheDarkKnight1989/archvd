'use client'

import { useState } from 'react'
import { BarChart3, TrendingUp, DollarSign, Package, RefreshCw, Zap } from 'lucide-react'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useRepricingSuggestions, type RepricingSuggestion } from '@/hooks/useRepricingSuggestions'
import { useCurrency } from '@/hooks/useCurrency'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { InventoryAgingWidget } from './_components/InventoryAgingWidget'
import { DeadStockAlerts } from './_components/DeadStockAlerts'
import { TopPerformersTable } from './_components/TopPerformersTable'
import { RepricingSuggestionsWidget } from '@/components/repricing/RepricingSuggestionsWidget'
import { cn } from '@/lib/utils/cn'

/**
 * Analytics Page
 *
 * Comprehensive analytics and insights for portfolio performance including:
 * - Revenue & profit metrics
 * - Inventory health & aging analysis
 * - Top/worst performers
 * - Platform breakdown
 */
export default function AnalyticsPage() {
  const { user } = useRequireAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const { data: analytics, loading, error } = useAnalytics(user?.id, refreshKey)
  const { suggestions: repricingSuggestions, loading: repricingLoading } = useRepricingSuggestions(user?.id, {}, refreshKey)
  const { format } = useCurrency()

  // Handle repricing application
  const handleApplyRepricing = async (suggestion: RepricingSuggestion) => {
    try {
      const response = await fetch(`/api/items/${suggestion.itemId}/reprice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_price: suggestion.suggestedPrice,
          reason: suggestion.reason
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to apply repricing')
      }

      // Trigger data refresh
      setRefreshKey(prev => prev + 1)
    } catch (error) {
      console.error('[Analytics] Repricing error:', error)
      throw error
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400">Error loading analytics: {error.message}</p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-4"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return null
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-fg flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-accent" />
            Analytics
          </h1>
          <p className="text-muted mt-1">
            Comprehensive insights into your portfolio performance
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <StatCard
          title="Total Revenue"
          value={format(analytics.totalRevenue)}
          icon={DollarSign}
          trend="neutral"
          description="All-time sales revenue"
        />

        {/* Gross Profit */}
        <StatCard
          title="Gross Profit"
          value={format(analytics.grossProfit)}
          icon={TrendingUp}
          trend={analytics.grossProfit >= 0 ? 'up' : 'down'}
          description={`${analytics.grossMargin.toFixed(1)}% margin`}
        />

        {/* Active Inventory */}
        <StatCard
          title="Active Inventory"
          value={analytics.activeInventoryCount.toString()}
          icon={Package}
          trend="neutral"
          description={`${format(analytics.activeInventoryValue)} invested`}
        />

        {/* Avg Days to Sell */}
        <StatCard
          title="Avg Days to Sell"
          value={analytics.avgDaysToSell > 0 ? `${Math.round(analytics.avgDaysToSell)}d` : '—'}
          icon={BarChart3}
          trend={analytics.avgDaysToSell <= 60 ? 'up' : analytics.avgDaysToSell <= 120 ? 'neutral' : 'down'}
          description="Inventory turnover speed"
        />
      </div>

      {/* Inventory Health Section */}
      <div>
        <h2 className="text-xl font-semibold text-fg mb-4 flex items-center gap-2">
          <Package className="h-6 w-6 text-accent" />
          Inventory Health
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InventoryAgingWidget agingBuckets={analytics.agingBuckets} />
          <DeadStockAlerts
            deadStockItems={analytics.deadStockItems}
            deadStockValue={analytics.deadStockValue}
          />
        </div>
      </div>

      {/* Smart Repricing Section */}
      {!repricingLoading && repricingSuggestions.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-fg mb-4 flex items-center gap-2">
            <Zap className="h-6 w-6 text-accent" />
            Smart Repricing
          </h2>
          <RepricingSuggestionsWidget
            suggestions={repricingSuggestions}
            onApply={handleApplyRepricing}
          />
        </div>
      )}

      {/* Performance Analysis */}
      <div>
        <h2 className="text-xl font-semibold text-fg mb-4 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-accent" />
          Performance Analysis
        </h2>
        <TopPerformersTable
          topPerformers={analytics.topPerformers}
          worstPerformers={analytics.worstPerformers}
        />
      </div>

      {/* Platform Breakdown */}
      {analytics.platformBreakdown.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-fg mb-4 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-accent" />
            Platform Breakdown
          </h2>
          <div className="bg-elev-1 border border-border/40 rounded-xl p-5">
            <div className="space-y-3">
              {analytics.platformBreakdown.map((platform) => {
                const platformInfo = getPlatformInfo(platform.platform)

                return (
                  <div
                    key={platform.platform}
                    className="flex items-center justify-between p-4 bg-elev-0 rounded-lg border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold',
                        platformInfo.bg,
                        platformInfo.text
                      )}>
                        {platformInfo.icon}
                      </div>
                      <div>
                        <div className="font-semibold text-fg">{platformInfo.label}</div>
                        <div className="text-xs text-dim">{platform.sales} sales</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-xs text-dim">Revenue</div>
                        <div className="text-sm font-bold text-fg mono">{format(platform.revenue)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-dim">Profit</div>
                        <div className={cn(
                          'text-sm font-bold mono',
                          platform.profit >= 0 ? 'text-[#00FF94]' : 'text-red-400'
                        )}>
                          {format(platform.profit)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-dim">Margin</div>
                        <div className={cn(
                          'text-sm font-bold mono',
                          platform.margin >= 20 ? 'text-[#00FF94]' :
                          platform.margin >= 10 ? 'text-blue-400' :
                          platform.margin >= 0 ? 'text-amber-400' :
                          'text-red-400'
                        )}>
                          {platform.margin.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
}: {
  title: string
  value: string
  icon: any
  trend: 'up' | 'down' | 'neutral'
  description?: string
}) {
  return (
    <div className="bg-elev-1 border border-border/40 rounded-xl p-5 hover:border-accent/30 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-accent" />
        </div>
        {trend !== 'neutral' && (
          <div className={cn(
            'text-xs font-semibold px-2 py-1 rounded-full',
            trend === 'up' ? 'bg-[#00FF94]/10 text-[#00FF94]' : 'bg-red-500/10 text-red-400'
          )}>
            {trend === 'up' ? '↑' : '↓'}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-fg mono mb-1">{value}</div>
      <div className="text-sm text-dim font-medium">{title}</div>
      {description && (
        <div className="text-xs text-muted mt-1">{description}</div>
      )}
    </div>
  )
}

// Platform info helper
function getPlatformInfo(platform: string) {
  const platformLower = platform.toLowerCase()

  switch (platformLower) {
    case 'stockx':
      return {
        label: 'StockX',
        icon: 'Sx',
        bg: 'bg-[#00B050]/10',
        text: 'text-[#00B050]'
      }
    case 'alias':
    case 'goat':
      return {
        label: 'Alias',
        icon: 'AL',
        bg: 'bg-[#A855F7]/10',
        text: 'text-[#A855F7]'
      }
    case 'ebay':
      return {
        label: 'eBay',
        icon: 'eB',
        bg: 'bg-[#E53238]/10',
        text: 'text-[#E53238]'
      }
    case 'private':
      return {
        label: 'Private',
        icon: 'Pr',
        bg: 'bg-[#3B82F6]/10',
        text: 'text-[#3B82F6]'
      }
    default:
      return {
        label: platform.charAt(0).toUpperCase() + platform.slice(1),
        icon: platform.substring(0, 2).toUpperCase(),
        bg: 'bg-muted/10',
        text: 'text-muted'
      }
  }
}
