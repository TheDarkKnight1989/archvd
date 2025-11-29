/**
 * Tax Estimation Component
 * Comprehensive tax calculations and breakdown for UK resellers
 */

'use client'

import { useMemo, useState } from 'react'
import { Receipt, Info, AlertCircle, Download } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface TaxEstimationProps {
  revenue: number
  profit: number
  vatDue: number
  expenses: number
  formatCurrency: (value: number) => string
  className?: string
}

export function TaxEstimation({
  revenue,
  profit,
  vatDue,
  expenses,
  formatCurrency,
  className
}: TaxEstimationProps) {
  const [showDetails, setShowDetails] = useState(false)

  const taxEstimates = useMemo(() => {
    // VAT (already calculated using margin scheme)
    const vat = vatDue

    // Income Tax (UK rates for 2024/25)
    const personalAllowance = 12570 // Personal allowance
    const basicRateThreshold = 50270 // Up to this amount
    const higherRateThreshold = 125140 // Up to this amount

    // Assume profit is the taxable income (simplified)
    const taxableIncome = Math.max(0, profit - personalAllowance)

    let incomeTax = 0
    if (taxableIncome <= 0) {
      incomeTax = 0
    } else if (taxableIncome <= basicRateThreshold - personalAllowance) {
      // Basic rate: 20%
      incomeTax = taxableIncome * 0.20
    } else if (taxableIncome <= higherRateThreshold - personalAllowance) {
      // Basic + Higher rate: 20% then 40%
      const basicRateAmount = basicRateThreshold - personalAllowance
      const higherRateAmount = taxableIncome - basicRateAmount
      incomeTax = (basicRateAmount * 0.20) + (higherRateAmount * 0.40)
    } else {
      // Basic + Higher + Additional rate: 20%, 40%, then 45%
      const basicRateAmount = basicRateThreshold - personalAllowance
      const higherRateAmount = (higherRateThreshold - personalAllowance) - basicRateAmount
      const additionalRateAmount = taxableIncome - (higherRateThreshold - personalAllowance)
      incomeTax = (basicRateAmount * 0.20) + (higherRateAmount * 0.40) + (additionalRateAmount * 0.45)
    }

    // National Insurance (simplified - self-employed Class 2 + Class 4)
    let nationalInsurance = 0
    if (profit > 12570) {
      // Class 2: £3.45/week if profit > £12,570
      const class2Annual = 3.45 * 52

      // Class 4: 9% on profits between £12,570 and £50,270, then 2% above
      let class4 = 0
      if (profit > personalAllowance) {
        const class4Profit = Math.min(profit - personalAllowance, basicRateThreshold - personalAllowance)
        class4 += class4Profit * 0.09

        if (profit > basicRateThreshold) {
          const excessProfit = profit - basicRateThreshold
          class4 += excessProfit * 0.02
        }
      }

      nationalInsurance = class2Annual + class4
    }

    // Total tax liability
    const totalTax = vat + incomeTax + nationalInsurance

    // Effective tax rate
    const effectiveRate = revenue > 0 ? (totalTax / revenue) * 100 : 0

    // After-tax profit
    const afterTaxProfit = profit - incomeTax - nationalInsurance

    return {
      vat,
      incomeTax,
      nationalInsurance,
      totalTax,
      effectiveRate,
      afterTaxProfit,
      taxableIncome: Math.max(0, profit)
    }
  }, [revenue, profit, vatDue])

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Tax Estimation</h3>
            <p className="text-sm text-muted mt-0.5">UK tax liability breakdown</p>
          </div>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-accent hover:text-fg transition-colors"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {/* Total Tax */}
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Total Tax Due</div>
          <div className="text-xl font-bold text-red-400 mono">
            {formatCurrency(taxEstimates.totalTax)}
          </div>
        </div>

        {/* VAT */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-3 bg-elev-0 border border-border/30 rounded-lg cursor-help">
                <div className="text-xs text-dim uppercase tracking-wide mb-1 flex items-center gap-1">
                  VAT
                  <Info className="h-3 w-3" />
                </div>
                <div className="text-lg font-bold text-fg mono">
                  {formatCurrency(taxEstimates.vat)}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="font-semibold mb-1">VAT Margin Scheme</div>
                <div>16.67% on profit margin</div>
                <div>Charged on eligible sales</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Income Tax */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-3 bg-elev-0 border border-border/30 rounded-lg cursor-help">
                <div className="text-xs text-dim uppercase tracking-wide mb-1 flex items-center gap-1">
                  Income Tax
                  <Info className="h-3 w-3" />
                </div>
                <div className="text-lg font-bold text-fg mono">
                  {formatCurrency(taxEstimates.incomeTax)}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs max-w-[250px]">
                <div className="font-semibold mb-1">Income Tax (2024/25)</div>
                <div>Personal Allowance: £12,570 (0%)</div>
                <div>Basic Rate: £12,571-£50,270 (20%)</div>
                <div>Higher Rate: £50,271-£125,140 (40%)</div>
                <div>Additional: Over £125,140 (45%)</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* National Insurance */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-3 bg-elev-0 border border-border/30 rounded-lg cursor-help">
                <div className="text-xs text-dim uppercase tracking-wide mb-1 flex items-center gap-1">
                  NI
                  <Info className="h-3 w-3" />
                </div>
                <div className="text-lg font-bold text-fg mono">
                  {formatCurrency(taxEstimates.nationalInsurance)}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs max-w-[250px]">
                <div className="font-semibold mb-1">National Insurance</div>
                <div>Class 2: £3.45/week (if profit &gt; £12,570)</div>
                <div>Class 4: 9% on £12,571-£50,270</div>
                <div>Class 4: 2% on profit over £50,270</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Effective Tax Rate</div>
          <div className="text-xl font-bold text-accent mono">
            {taxEstimates.effectiveRate.toFixed(1)}%
          </div>
          <div className="text-xs text-muted mt-0.5">Total tax / Revenue</div>
        </div>

        <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">After-Tax Profit</div>
          <div className={cn(
            'text-xl font-bold mono',
            taxEstimates.afterTaxProfit >= 0 ? 'text-[#00FF94]' : 'text-red-400'
          )}>
            {formatCurrency(taxEstimates.afterTaxProfit)}
          </div>
          <div className="text-xs text-muted mt-0.5">Profit - Income Tax - NI</div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      {showDetails && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="text-sm font-semibold text-fg mb-2">Tax Calculation Details</div>

          {/* Income Tax Breakdown */}
          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-2">Income Tax Breakdown</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Taxable Profit</span>
                <span className="text-fg font-mono">{formatCurrency(profit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Personal Allowance</span>
                <span className="text-fg font-mono">-{formatCurrency(12570)}</span>
              </div>
              <div className="flex justify-between border-t border-border/30 pt-1">
                <span className="text-muted">Taxable Income</span>
                <span className="text-fg font-bold font-mono">
                  {formatCurrency(taxEstimates.taxableIncome)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Income Tax Due</span>
                <span className="text-red-400 font-bold font-mono">
                  {formatCurrency(taxEstimates.incomeTax)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Schedule */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-400">
                <div className="font-semibold mb-1">Important Reminders</div>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>VAT returns: Quarterly or monthly based on registration</li>
                  <li>Self Assessment deadline: 31 January</li>
                  <li>Payment on account: 2 payments (31 Jan & 31 Jul)</li>
                  <li>Keep records for at least 5 years</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-4 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-400">
        <strong>Note:</strong> This is an estimate only. Actual tax liability may vary based on personal circumstances.
        Consult a qualified accountant for accurate tax advice.
      </div>
    </div>
  )
}
