/**
 * Smart Alerts & Anomaly Detection Component
 * Automatically detects unusual patterns and provides actionable insights
 */

'use client'

import { useMemo } from 'react'
import { AlertTriangle, TrendingDown, TrendingUp, Zap, DollarSign, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Alert {
  id: string
  type: 'warning' | 'danger' | 'info' | 'success'
  category: 'sales' | 'margin' | 'expense' | 'inventory' | 'performance'
  title: string
  message: string
  metric?: string
  action?: string
  severity: 'high' | 'medium' | 'low'
}

interface SmartAlertsProps {
  items: any[]
  expenses: number
  revenue: number
  profit: number
  previousRevenue: number
  previousProfit: number
  formatCurrency: (value: number) => string
  className?: string
}

export function SmartAlerts({
  items,
  expenses,
  revenue,
  profit,
  previousRevenue,
  previousProfit,
  formatCurrency,
  className
}: SmartAlertsProps) {
  const alerts = useMemo(() => {
    const detected: Alert[] = []

    // 1. Revenue decline detection
    if (previousRevenue > 0 && revenue < previousRevenue * 0.8) {
      const decline = ((previousRevenue - revenue) / previousRevenue) * 100
      detected.push({
        id: 'revenue-decline',
        type: 'danger',
        category: 'sales',
        title: 'Significant Revenue Decline',
        message: `Revenue is down ${decline.toFixed(0)}% from previous period. This requires immediate attention.`,
        metric: formatCurrency(previousRevenue - revenue),
        action: 'Review pricing strategy and marketing efforts',
        severity: 'high'
      })
    }

    // 2. Profit margin deterioration
    const currentMargin = revenue > 0 ? (profit / revenue) * 100 : 0
    const previousMargin = previousRevenue > 0 ? (previousProfit / previousRevenue) * 100 : 0

    if (previousMargin > 0 && currentMargin < previousMargin - 5) {
      detected.push({
        id: 'margin-decline',
        type: 'warning',
        category: 'margin',
        title: 'Profit Margin Compression',
        message: `Margin dropped from ${previousMargin.toFixed(1)}% to ${currentMargin.toFixed(1)}%. Check pricing and costs.`,
        metric: `${(previousMargin - currentMargin).toFixed(1)}% decrease`,
        action: 'Analyze cost structure and consider repricing',
        severity: 'high'
      })
    }

    // 3. Low margin items detection
    const lowMarginItems = items.filter(item => {
      const itemMargin = item.salePrice > 0 ? ((item.margin || 0) / item.salePrice) * 100 : 0
      return itemMargin < 10 && itemMargin >= 0
    })

    if (lowMarginItems.length >= 3 || (items.length > 0 && lowMarginItems.length / items.length > 0.3)) {
      detected.push({
        id: 'low-margin-items',
        type: 'warning',
        category: 'margin',
        title: 'Multiple Low-Margin Sales',
        message: `${lowMarginItems.length} items sold with <10% margin. Consider focusing on higher-margin inventory.`,
        metric: `${((lowMarginItems.length / items.length) * 100).toFixed(0)}% of sales`,
        action: 'Review pricing strategy for these items',
        severity: 'medium'
      })
    }

    // 4. Loss-making sales
    const lossSales = items.filter(item => (item.margin || 0) < 0)
    if (lossSales.length > 0) {
      const totalLoss = lossSales.reduce((sum, item) => sum + Math.abs(item.margin || 0), 0)
      detected.push({
        id: 'loss-sales',
        type: 'danger',
        category: 'margin',
        title: 'Loss-Making Sales Detected',
        message: `${lossSales.length} items sold at a loss, totaling ${formatCurrency(totalLoss)}.`,
        metric: formatCurrency(totalLoss),
        action: 'Review pricing floor to prevent selling below cost',
        severity: 'high'
      })
    }

    // 5. Inventory aging (if items have purchase dates)
    const now = new Date()
    const oldItems = items.filter(item => {
      if (!item.purchase_date && !item.created_at) return false
      const purchaseDate = new Date(item.purchase_date || item.created_at)
      const daysOld = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
      return daysOld > 90
    })

    if (oldItems.length >= 3) {
      detected.push({
        id: 'aging-inventory',
        type: 'warning',
        category: 'inventory',
        title: 'Slow-Moving Inventory',
        message: `${oldItems.length} items have been in inventory for over 90 days. Consider repricing or promotions.`,
        metric: `${oldItems.length} items`,
        action: 'Review and potentially discount aged inventory',
        severity: 'medium'
      })
    }

    // 6. High expense ratio
    const expenseRatio = revenue > 0 ? (expenses / revenue) * 100 : 0
    if (expenseRatio > 30) {
      detected.push({
        id: 'high-expenses',
        type: 'warning',
        category: 'expense',
        title: 'High Expense Ratio',
        message: `Expenses are ${expenseRatio.toFixed(0)}% of revenue. Industry best practice is <20%.`,
        metric: `${expenseRatio.toFixed(0)}%`,
        action: 'Review and optimize operational expenses',
        severity: 'medium'
      })
    }

    // 7. Sales velocity decline
    if (items.length < 3 && previousRevenue > 0) {
      detected.push({
        id: 'low-sales-volume',
        type: 'warning',
        category: 'sales',
        title: 'Low Sales Volume',
        message: `Only ${items.length} sales this period. Consider increasing marketing efforts.`,
        metric: `${items.length} sales`,
        action: 'Boost marketing and listing visibility',
        severity: 'medium'
      })
    }

    // 8. Strong performance (positive alert)
    if (previousRevenue > 0 && revenue > previousRevenue * 1.2) {
      const growth = ((revenue - previousRevenue) / previousRevenue) * 100
      detected.push({
        id: 'revenue-growth',
        type: 'success',
        category: 'performance',
        title: 'Strong Revenue Growth',
        message: `Revenue increased ${growth.toFixed(0)}% from previous period. Keep up the great work!`,
        metric: formatCurrency(revenue - previousRevenue),
        action: 'Scale successful strategies',
        severity: 'low'
      })
    }

    // 9. Excellent margins
    if (currentMargin > 25 && items.length >= 3) {
      detected.push({
        id: 'excellent-margins',
        type: 'success',
        category: 'margin',
        title: 'Excellent Profit Margins',
        message: `Maintaining a ${currentMargin.toFixed(1)}% profit margin. Your pricing strategy is working well.`,
        metric: `${currentMargin.toFixed(1)}%`,
        action: 'Continue current pricing strategy',
        severity: 'low'
      })
    }

    // 10. Concentration risk - single platform
    const platformCounts = items.reduce((acc, item) => {
      const platform = item.platform || 'Unknown'
      acc[platform] = (acc[platform] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const platforms = Object.keys(platformCounts)
    if (platforms.length > 0) {
      const topPlatform = platforms.reduce((a, b) =>
        platformCounts[a] > platformCounts[b] ? a : b
      )
      const topPlatformPct = (platformCounts[topPlatform] / items.length) * 100

      if (topPlatformPct > 70 && items.length >= 5) {
        detected.push({
          id: 'platform-concentration',
          type: 'info',
          category: 'performance',
          title: 'Platform Concentration Risk',
          message: `${topPlatformPct.toFixed(0)}% of sales are on ${topPlatform}. Consider diversifying.`,
          metric: `${topPlatformPct.toFixed(0)}% on ${topPlatform}`,
          action: 'List inventory on additional platforms',
          severity: 'low'
        })
      }
    }

    // Sort by severity
    return detected.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
  }, [items, expenses, revenue, profit, previousRevenue, previousProfit, formatCurrency])

  if (alerts.length === 0) {
    return (
      <div className={cn('bg-elev-1 border border-border/40 rounded-xl p-6', className)}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[#00FF94]/10 mb-4">
            <Zap className="h-8 w-8 text-[#00FF94]" />
          </div>
          <h3 className="text-lg font-semibold text-fg mb-2">All Clear!</h3>
          <p className="text-sm text-muted">
            No anomalies detected. Your business metrics look healthy.
          </p>
        </div>
      </div>
    )
  }

  const highSeverity = alerts.filter(a => a.severity === 'high').length
  const mediumSeverity = alerts.filter(a => a.severity === 'medium').length

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-400" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Smart Alerts & Insights</h3>
            <p className="text-sm text-muted mt-0.5">AI-powered anomaly detection</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {highSeverity > 0 && (
            <div className="px-2 py-1 bg-red-500/10 text-red-400 text-xs font-semibold rounded">
              {highSeverity} HIGH
            </div>
          )}
          {mediumSeverity > 0 && (
            <div className="px-2 py-1 bg-amber-500/10 text-amber-400 text-xs font-semibold rounded">
              {mediumSeverity} MEDIUM
            </div>
          )}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.map((alert) => {
          const Icon = getAlertIcon(alert.type)
          const colors = getAlertColors(alert.type)

          return (
            <div
              key={alert.id}
              className={cn(
                'p-4 rounded-lg border transition-all',
                colors.border,
                colors.bg
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('mt-0.5', colors.icon)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className={cn('text-sm font-semibold', colors.text)}>
                        {alert.title}
                      </h4>
                      <div className="text-xs text-muted mt-0.5">
                        {getCategoryLabel(alert.category)}
                      </div>
                    </div>
                    {alert.metric && (
                      <div className={cn('text-sm font-bold mono', colors.text)}>
                        {alert.metric}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-fg mb-3">{alert.message}</p>
                  {alert.action && (
                    <div className="flex items-start gap-2 p-2 bg-elev-0 rounded border border-border/30">
                      <Info className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-dim uppercase tracking-wide mb-0.5">Recommended Action</div>
                        <div className="text-xs text-fg">{alert.action}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getAlertIcon(type: Alert['type']) {
  switch (type) {
    case 'danger': return AlertTriangle
    case 'warning': return AlertCircle
    case 'success': return TrendingUp
    case 'info': return Info
    default: return AlertCircle
  }
}

function getAlertColors(type: Alert['type']) {
  switch (type) {
    case 'danger':
      return {
        bg: 'bg-red-500/5',
        border: 'border-red-500/30',
        icon: 'text-red-400',
        text: 'text-red-400'
      }
    case 'warning':
      return {
        bg: 'bg-amber-500/5',
        border: 'border-amber-500/30',
        icon: 'text-amber-400',
        text: 'text-amber-400'
      }
    case 'success':
      return {
        bg: 'bg-[#00FF94]/5',
        border: 'border-[#00FF94]/30',
        icon: 'text-[#00FF94]',
        text: 'text-[#00FF94]'
      }
    case 'info':
      return {
        bg: 'bg-blue-500/5',
        border: 'border-blue-500/30',
        icon: 'text-blue-400',
        text: 'text-blue-400'
      }
  }
}

function getCategoryLabel(category: Alert['category']) {
  switch (category) {
    case 'sales': return 'Sales Performance'
    case 'margin': return 'Profit Margins'
    case 'expense': return 'Expenses'
    case 'inventory': return 'Inventory Management'
    case 'performance': return 'Business Performance'
    default: return category
  }
}
