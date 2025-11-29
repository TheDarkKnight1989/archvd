/**
 * Financial Health Metrics Component
 * Shows inventory turnover, burn rate, runway, ROI
 */

'use client'

import { Activity, DollarSign, Clock, TrendingUp, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface FinancialHealthMetricsProps {
  soldItems: any[]
  inventoryValue: number
  averageCost: number
  formatCurrency: (value: number) => string
  dateRange: { from: string; to: string }
}

export function FinancialHealthMetrics({
  soldItems,
  inventoryValue,
  averageCost,
  formatCurrency,
  dateRange
}: FinancialHealthMetricsProps) {
  // Calculate days in period
  const fromDate = new Date(dateRange.from)
  const toDate = new Date(dateRange.to)
  const daysInPeriod = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))

  // Total revenue
  const totalRevenue = soldItems.reduce((sum, item) => sum + (item.salePrice || 0), 0)

  // Total cost
  const totalCost = soldItems.reduce((sum, item) => sum + (item.cost || 0), 0)

  // Total profit
  const totalProfit = soldItems.reduce((sum, item) => sum + (item.margin || 0), 0)

  // Inventory Turnover Ratio = Cost of Goods Sold / Average Inventory Value
  // Annualized to show yearly rate
  const inventoryTurnover = inventoryValue > 0
    ? (totalCost / inventoryValue) * (365 / daysInPeriod)
    : 0

  // ROI = (Total Profit / Total Cost) * 100
  const roi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

  // Average holding period = Days in period / Number of items sold
  const avgHoldingPeriod = soldItems.length > 0 ? daysInPeriod / soldItems.length : 0

  // Burn rate = Average daily expenses
  const burnRate = daysInPeriod > 0 ? totalCost / daysInPeriod : 0

  // Runway = Current inventory value / burn rate (in days)
  const runway = burnRate > 0 ? inventoryValue / burnRate : 0

  // Profit margin %
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  // Health score (0-100)
  const healthScore = calculateHealthScore({
    inventoryTurnover,
    roi,
    profitMargin,
    runway
  })

  return (
    <div className="space-y-4">
      {/* Health Score */}
      <div className="bg-elev-1 border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-semibold text-fg">Financial Health Score</h3>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  'text-3xl font-bold mono',
                  healthScore >= 75 && 'text-[#00FF94]',
                  healthScore >= 50 && healthScore < 75 && 'text-amber-400',
                  healthScore < 50 && 'text-red-400'
                )}>
                  {healthScore}/100
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <div className="font-semibold mb-1">Score Breakdown</div>
                  <div>90-100: Excellent</div>
                  <div>75-89: Good</div>
                  <div>50-74: Fair</div>
                  <div>&lt;50: Needs Improvement</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-elev-0 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all',
              healthScore >= 75 && 'bg-[#00FF94]',
              healthScore >= 50 && healthScore < 75 && 'bg-amber-400',
              healthScore < 50 && 'bg-red-400'
            )}
            style={{ width: `${healthScore}%` }}
          />
        </div>

        {healthScore < 50 && (
          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-400">
              Your financial health needs attention. Consider improving inventory turnover or profit margins.
            </p>
          </div>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Inventory Turnover */}
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Inventory Turnover"
          value={inventoryTurnover.toFixed(1) + 'x'}
          subtitle="per year"
          tooltip="How many times inventory is sold and replaced per year. Higher is better (>4 is good)."
          status={inventoryTurnover >= 4 ? 'good' : inventoryTurnover >= 2 ? 'fair' : 'poor'}
        />

        {/* ROI */}
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Return on Investment"
          value={roi.toFixed(1) + '%'}
          subtitle="overall"
          tooltip="Profit as a percentage of cost. Higher is better (>30% is excellent)."
          status={roi >= 30 ? 'good' : roi >= 15 ? 'fair' : 'poor'}
        />

        {/* Avg Holding Period */}
        <MetricCard
          icon={<Clock className="h-4 w-4" />}
          label="Avg Hold Time"
          value={Math.round(avgHoldingPeriod) + 'd'}
          subtitle="per item"
          tooltip="Average days an item stays in inventory before selling. Lower is better (<30d is good)."
          status={avgHoldingPeriod <= 30 ? 'good' : avgHoldingPeriod <= 60 ? 'fair' : 'poor'}
        />

        {/* Runway */}
        <MetricCard
          icon={<Activity className="h-4 w-4" />}
          label="Runway"
          value={Math.round(runway) + 'd'}
          subtitle={formatCurrency(inventoryValue) + ' inv.'}
          tooltip="Days until inventory runs out at current sales rate. Based on inventory value vs daily cost."
          status={runway >= 60 ? 'good' : runway >= 30 ? 'fair' : 'poor'}
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-elev-1 border border-border rounded-lg p-4">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Burn Rate</div>
          <div className="text-xl font-bold text-fg mono">{formatCurrency(burnRate)}/day</div>
          <div className="text-xs text-muted mt-1">Average daily cost</div>
        </div>

        <div className="bg-elev-1 border border-border rounded-lg p-4">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Profit Margin</div>
          <div className={cn(
            'text-xl font-bold mono',
            profitMargin >= 20 ? 'text-[#00FF94]' : profitMargin >= 10 ? 'text-amber-400' : 'text-red-400'
          )}>
            {profitMargin.toFixed(1)}%
          </div>
          <div className="text-xs text-muted mt-1">Of total revenue</div>
        </div>
      </div>
    </div>
  )
}

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
  subtitle: string
  tooltip: string
  status: 'good' | 'fair' | 'poor'
}

function MetricCard({ icon, label, value, subtitle, tooltip, status }: MetricCardProps) {
  const statusColors = {
    good: 'text-[#00FF94]',
    fair: 'text-amber-400',
    poor: 'text-red-400'
  }

  const statusBgColors = {
    good: 'bg-[#00FF94]/10',
    fair: 'bg-amber-400/10',
    poor: 'bg-red-400/10'
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'bg-elev-1 border rounded-lg p-4 cursor-help transition-colors hover:border-border',
            status === 'good' && 'border-[#00FF94]/20',
            status === 'fair' && 'border-amber-400/20',
            status === 'poor' && 'border-red-400/20'
          )}>
            <div className={cn('inline-flex p-2 rounded-lg mb-2', statusBgColors[status])}>
              <div className={statusColors[status]}>{icon}</div>
            </div>
            <div className="text-xs text-dim uppercase tracking-wide mb-1">{label}</div>
            <div className={cn('text-xl font-bold mono', statusColors[status])}>{value}</div>
            <div className="text-xs text-muted mt-0.5">{subtitle}</div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs max-w-[200px]">{tooltip}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function calculateHealthScore({
  inventoryTurnover,
  roi,
  profitMargin,
  runway
}: {
  inventoryTurnover: number
  roi: number
  profitMargin: number
  runway: number
}): number {
  let score = 0

  // Inventory turnover (25 points max)
  if (inventoryTurnover >= 6) score += 25
  else if (inventoryTurnover >= 4) score += 20
  else if (inventoryTurnover >= 2) score += 15
  else if (inventoryTurnover >= 1) score += 10
  else score += 5

  // ROI (25 points max)
  if (roi >= 40) score += 25
  else if (roi >= 30) score += 20
  else if (roi >= 20) score += 15
  else if (roi >= 10) score += 10
  else score += 5

  // Profit margin (25 points max)
  if (profitMargin >= 25) score += 25
  else if (profitMargin >= 20) score += 20
  else if (profitMargin >= 15) score += 15
  else if (profitMargin >= 10) score += 10
  else score += 5

  // Runway (25 points max)
  if (runway >= 90) score += 25
  else if (runway >= 60) score += 20
  else if (runway >= 30) score += 15
  else if (runway >= 15) score += 10
  else score += 5

  return Math.min(100, Math.round(score))
}
