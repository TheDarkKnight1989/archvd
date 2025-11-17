'use client'

import { TrendingUp, DollarSign, ShoppingCart, Package, Repeat, CreditCard } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import type { ReportMetrics } from '@/hooks/useDashboardReports'

interface DashboardReportsProps {
  data: ReportMetrics | null
  loading?: boolean
}

interface ReportCard {
  label: string
  value: number
  icon: React.ElementType
  format: 'currency' | 'number'
  colorClass?: string
  subtitle?: string
}

export function DashboardReports({ data, loading = false }: DashboardReportsProps) {
  const { format } = useCurrency()

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-fg">Reports</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i} className="p-5 bg-elev-2 border-border/40 animate-pulse">
              <div className="h-4 bg-elev-1 rounded w-1/2 mb-3" />
              <div className="h-8 bg-elev-1 rounded w-3/4 mb-2" />
              <div className="h-3 bg-elev-1 rounded w-1/3" />
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const reports: ReportCard[] = [
    {
      label: 'Net Profit',
      value: data.netProfit,
      icon: TrendingUp,
      format: 'currency',
      colorClass: data.netProfit >= 0 ? 'money-pos' : 'money-neg',
      subtitle: 'Total profit (realised + unrealised)',
    },
    {
      label: 'Sales Income',
      value: data.salesIncome,
      icon: DollarSign,
      format: 'currency',
      subtitle: 'Gross sales revenue',
    },
    {
      label: 'Item Spend',
      value: data.itemSpend,
      icon: ShoppingCart,
      format: 'currency',
      subtitle: 'Total purchase cost',
    },
    {
      label: 'Net Profit From Sold',
      value: data.netProfitFromSold,
      icon: TrendingUp,
      format: 'currency',
      colorClass: data.netProfitFromSold >= 0 ? 'money-pos' : 'money-neg',
      subtitle: 'Realised profit only',
    },
    {
      label: 'Items Purchased',
      value: data.itemsPurchased,
      icon: Package,
      format: 'number',
      subtitle: 'New inventory added',
    },
    {
      label: 'Items Sold',
      value: data.itemsSold,
      icon: Repeat,
      format: 'number',
      subtitle: 'Successfully sold',
    },
    {
      label: 'Subscription Spend',
      value: data.subscriptionSpend,
      icon: CreditCard,
      format: 'currency',
      subtitle: 'Recurring charges',
    },
    {
      label: 'Expense Spend',
      value: data.expenseSpend,
      icon: CreditCard,
      format: 'currency',
      subtitle: 'Fees + shipping + taxes',
    },
    {
      label: 'Total Spend',
      value: data.totalSpend,
      icon: DollarSign,
      format: 'currency',
      subtitle: 'All expenses combined',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-50">Reports</h3>
        <p className="text-[11px] text-neutral-400">
          {new Date(data.dateRange.from).toLocaleDateString('en-GB')} -{' '}
          {new Date(data.dateRange.to).toLocaleDateString('en-GB')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report, index) => {
          const Icon = report.icon
          const isNegative = report.format === 'currency' && report.value < 0

          return (
            <Card
              key={index}
              className="p-5 bg-elev-2 border-border/40 hover:border-border/60 transition-colors"
            >
              {/* Header: Label + Icon */}
              <div className="flex items-start justify-between mb-3">
                <span className="label-up text-neutral-400 text-[10px]">{report.label}</span>
                <div className="h-8 w-8 rounded-md bg-elev-1/50 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
              </div>

              {/* Main Value */}
              <p
                className={cn(
                  'text-2xl md:text-3xl font-bold mono tabular-nums mb-3',
                  report.colorClass || 'text-neutral-50'
                )}
              >
                {report.format === 'currency' ? (
                  <>
                    {isNegative ? '-' : ''}
                    {format(Math.abs(report.value))}
                  </>
                ) : (
                  report.value.toLocaleString()
                )}
              </p>

              {/* Subtitle text (no background, plain text) */}
              {report.subtitle && (
                <p className="mt-2 text-[11px] text-neutral-400">{report.subtitle}</p>
              )}

              {/* Progress bar (bar only, no text inside) */}
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-500 rounded-full',
                    report.colorClass?.includes('pos')
                      ? 'bg-emerald-500/70'
                      : report.colorClass?.includes('neg')
                      ? 'bg-red-500/70'
                      : 'bg-accent/60'
                  )}
                  style={{
                    width: report.format === 'currency' && data
                      ? `${Math.min(100, Math.max(5, (Math.abs(report.value) / Math.max(data.salesIncome, data.totalSpend, 1)) * 100))}%`
                      : report.format === 'number' && data
                      ? `${Math.min(100, Math.max(5, (report.value / Math.max(data.itemsPurchased, data.itemsSold, 1)) * 100))}%`
                      : '0%',
                  }}
                />
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
