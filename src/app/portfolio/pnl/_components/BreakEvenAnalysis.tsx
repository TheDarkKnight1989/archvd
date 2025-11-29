/**
 * Break-Even Analysis Component
 * Calculate break-even points, safety margins, and target analysis
 */

'use client'

import { useMemo } from 'react'
import { Target, Shield, TrendingUp, DollarSign, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface BreakEvenAnalysisProps {
  revenue: number
  fixedCosts: number
  variableCosts: number
  itemsSold: number
  formatCurrency: (value: number) => string
  className?: string
}

export function BreakEvenAnalysis({
  revenue,
  fixedCosts,
  variableCosts,
  itemsSold,
  formatCurrency,
  className
}: BreakEvenAnalysisProps) {
  const analysis = useMemo(() => {
    // Average revenue per unit
    const avgRevenuePerUnit = itemsSold > 0 ? revenue / itemsSold : 0

    // Average variable cost per unit
    const avgVariableCostPerUnit = itemsSold > 0 ? variableCosts / itemsSold : 0

    // Contribution margin per unit
    const contributionMarginPerUnit = avgRevenuePerUnit - avgVariableCostPerUnit

    // Contribution margin ratio
    const contributionMarginRatio = avgRevenuePerUnit > 0
      ? (contributionMarginPerUnit / avgRevenuePerUnit) * 100
      : 0

    // Break-even point in units
    const breakEvenUnits = contributionMarginPerUnit > 0
      ? Math.ceil(fixedCosts / contributionMarginPerUnit)
      : 0

    // Break-even point in revenue
    const breakEvenRevenue = breakEvenUnits * avgRevenuePerUnit

    // Margin of safety (units)
    const marginOfSafetyUnits = itemsSold - breakEvenUnits

    // Margin of safety (revenue)
    const marginOfSafetyRevenue = revenue - breakEvenRevenue

    // Margin of safety percentage
    const marginOfSafetyPercent = revenue > 0
      ? (marginOfSafetyRevenue / revenue) * 100
      : 0

    // Current profit
    const currentProfit = revenue - fixedCosts - variableCosts

    // Target calculations for different profit goals
    const targetForProfit = (targetProfit: number) => {
      if (contributionMarginPerUnit <= 0) return { units: 0, revenue: 0 }
      const units = Math.ceil((fixedCosts + targetProfit) / contributionMarginPerUnit)
      return {
        units,
        revenue: units * avgRevenuePerUnit
      }
    }

    const target10k = targetForProfit(10000)
    const target25k = targetForProfit(25000)
    const target50k = targetForProfit(50000)

    return {
      avgRevenuePerUnit,
      avgVariableCostPerUnit,
      contributionMarginPerUnit,
      contributionMarginRatio,
      breakEvenUnits,
      breakEvenRevenue,
      marginOfSafetyUnits,
      marginOfSafetyRevenue,
      marginOfSafetyPercent,
      currentProfit,
      target10k,
      target25k,
      target50k
    }
  }, [revenue, fixedCosts, variableCosts, itemsSold])

  const isAboveBreakEven = itemsSold >= analysis.breakEvenUnits
  const safetyLevel = analysis.marginOfSafetyPercent >= 30 ? 'high' :
                     analysis.marginOfSafetyPercent >= 15 ? 'medium' : 'low'

  return (
    <div className={cn('space-y-4', className)}>
      {/* Break-Even Summary */}
      <div className="bg-elev-1 border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-fg">Break-Even Analysis</h3>
        </div>

        {/* Status Banner */}
        <div className={cn(
          'p-4 rounded-lg border mb-5',
          isAboveBreakEven
            ? 'bg-[#00FF94]/5 border-[#00FF94]/30'
            : 'bg-red-500/5 border-red-500/30'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              isAboveBreakEven ? 'bg-[#00FF94]/10' : 'bg-red-500/10'
            )}>
              {isAboveBreakEven ? (
                <TrendingUp className="h-6 w-6 text-[#00FF94]" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-400" />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-fg">
                {isAboveBreakEven ? 'Above Break-Even ✓' : 'Below Break-Even'}
              </div>
              <div className="text-xs text-muted mt-0.5">
                {isAboveBreakEven
                  ? `You've sold ${analysis.marginOfSafetyUnits} units above break-even point`
                  : `Need ${-analysis.marginOfSafetyUnits} more units to break even`
                }
              </div>
            </div>
          </div>
        </div>

        {/* Break-Even Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Break-Even Units</div>
            <div className="text-xl font-bold text-accent mono">{analysis.breakEvenUnits}</div>
            <div className="text-xs text-muted mt-1">units needed</div>
          </div>

          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Break-Even Revenue</div>
            <div className="text-xl font-bold text-accent mono">{formatCurrency(analysis.breakEvenRevenue)}</div>
            <div className="text-xs text-muted mt-1">revenue target</div>
          </div>

          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Units Sold</div>
            <div className={cn(
              'text-xl font-bold mono',
              isAboveBreakEven ? 'text-[#00FF94]' : 'text-red-400'
            )}>
              {itemsSold}
            </div>
            <div className="text-xs text-muted mt-1">
              {isAboveBreakEven ? 'above target' : 'below target'}
            </div>
          </div>

          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Actual Revenue</div>
            <div className={cn(
              'text-xl font-bold mono',
              isAboveBreakEven ? 'text-[#00FF94]' : 'text-red-400'
            )}>
              {formatCurrency(revenue)}
            </div>
            <div className="text-xs text-muted mt-1">current period</div>
          </div>
        </div>

        {/* Contribution Margin */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Contribution Margin</div>
            <div className="text-lg font-bold text-fg mono">
              {formatCurrency(analysis.contributionMarginPerUnit)}/unit
            </div>
            <div className="text-xs text-muted mt-1">{analysis.contributionMarginRatio.toFixed(1)}% ratio</div>
          </div>

          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Current Profit</div>
            <div className={cn(
              'text-lg font-bold mono',
              analysis.currentProfit >= 0 ? 'text-[#00FF94]' : 'text-red-400'
            )}>
              {formatCurrency(analysis.currentProfit)}
            </div>
            <div className="text-xs text-muted mt-1">this period</div>
          </div>
        </div>
      </div>

      {/* Margin of Safety */}
      <div className="bg-elev-1 border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-fg">Margin of Safety</h3>
        </div>

        <div className={cn(
          'p-4 rounded-lg border mb-4',
          safetyLevel === 'high' ? 'bg-[#00FF94]/5 border-[#00FF94]/30' :
          safetyLevel === 'medium' ? 'bg-amber-500/5 border-amber-500/30' :
          'bg-red-500/5 border-red-500/30'
        )}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-dim uppercase tracking-wide mb-1">Safety Level</div>
              <div className={cn(
                'text-2xl font-bold mono',
                safetyLevel === 'high' ? 'text-[#00FF94]' :
                safetyLevel === 'medium' ? 'text-amber-400' :
                'text-red-400'
              )}>
                {analysis.marginOfSafetyPercent.toFixed(1)}%
              </div>
            </div>
            <div className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold uppercase',
              safetyLevel === 'high' ? 'bg-[#00FF94]/10 text-[#00FF94]' :
              safetyLevel === 'medium' ? 'bg-amber-500/10 text-amber-400' :
              'bg-red-500/10 text-red-400'
            )}>
              {safetyLevel}
            </div>
          </div>
          <div className="mt-3 text-xs text-muted">
            {safetyLevel === 'high' && 'Excellent cushion above break-even. Low business risk.'}
            {safetyLevel === 'medium' && 'Moderate safety margin. Watch costs carefully.'}
            {safetyLevel === 'low' && 'Low safety margin. Small changes can lead to losses.'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Safety in Units</div>
            <div className={cn(
              'text-lg font-bold mono',
              analysis.marginOfSafetyUnits >= 0 ? 'text-[#00FF94]' : 'text-red-400'
            )}>
              {analysis.marginOfSafetyUnits >= 0 ? '+' : ''}{analysis.marginOfSafetyUnits}
            </div>
            <div className="text-xs text-muted mt-1">units above break-even</div>
          </div>

          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Safety in Revenue</div>
            <div className={cn(
              'text-lg font-bold mono',
              analysis.marginOfSafetyRevenue >= 0 ? 'text-[#00FF94]' : 'text-red-400'
            )}>
              {formatCurrency(Math.abs(analysis.marginOfSafetyRevenue))}
            </div>
            <div className="text-xs text-muted mt-1">
              {analysis.marginOfSafetyRevenue >= 0 ? 'cushion' : 'shortfall'}
            </div>
          </div>
        </div>
      </div>

      {/* Profit Targets */}
      <div className="bg-elev-1 border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-fg">Profit Targets</h3>
          <span className="text-xs text-dim">What you need to hit specific goals</span>
        </div>

        <div className="space-y-3">
          <TargetRow
            label="£10,000 Profit"
            units={analysis.target10k.units}
            revenue={analysis.target10k.revenue}
            currentUnits={itemsSold}
            formatCurrency={formatCurrency}
          />
          <TargetRow
            label="£25,000 Profit"
            units={analysis.target25k.units}
            revenue={analysis.target25k.revenue}
            currentUnits={itemsSold}
            formatCurrency={formatCurrency}
          />
          <TargetRow
            label="£50,000 Profit"
            units={analysis.target50k.units}
            revenue={analysis.target50k.revenue}
            currentUnits={itemsSold}
            formatCurrency={formatCurrency}
          />
        </div>
      </div>
    </div>
  )
}

interface TargetRowProps {
  label: string
  units: number
  revenue: number
  currentUnits: number
  formatCurrency: (value: number) => string
}

function TargetRow({ label, units, revenue, currentUnits, formatCurrency }: TargetRowProps) {
  const progress = units > 0 ? Math.min(100, (currentUnits / units) * 100) : 0
  const isAchieved = currentUnits >= units
  const remaining = Math.max(0, units - currentUnits)

  return (
    <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-fg">{label}</div>
        {isAchieved && (
          <div className="px-2 py-0.5 bg-[#00FF94]/10 text-[#00FF94] text-xs rounded font-semibold">
            ACHIEVED ✓
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-2">
        <div>
          <div className="text-xs text-dim mb-0.5">Target Units</div>
          <div className="text-sm font-bold text-accent mono">{units}</div>
        </div>
        <div>
          <div className="text-xs text-dim mb-0.5">Target Revenue</div>
          <div className="text-sm font-bold text-accent mono">{formatCurrency(revenue)}</div>
        </div>
        <div>
          <div className="text-xs text-dim mb-0.5">Remaining</div>
          <div className={cn(
            'text-sm font-bold mono',
            isAchieved ? 'text-[#00FF94]' : 'text-fg'
          )}>
            {isAchieved ? '0' : remaining} units
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-elev-1 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all',
            isAchieved ? 'bg-[#00FF94]' : 'bg-accent'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-xs text-dim text-right mt-1">{progress.toFixed(0)}% complete</div>
    </div>
  )
}
