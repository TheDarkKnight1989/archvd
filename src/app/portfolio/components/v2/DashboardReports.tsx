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
  gradientFrom?: string
  gradientTo?: string
}

export function DashboardReports({ data, loading = false }: DashboardReportsProps) {
  const { format } = useCurrency()

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="h-4 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-24 animate-pulse" />
          <div className="h-3 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-48 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i} className="relative p-5 bg-gradient-to-br from-accent/5 via-elev-2 to-elev-2 border-border/40 overflow-hidden">
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />

              <div className="relative space-y-3">
                <div className="flex items-start justify-between">
                  <div className="h-3 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-20 animate-pulse" />
                  <div className="h-9 w-9 bg-gradient-to-br from-elev-1 to-elev-1/50 rounded-lg animate-pulse" />
                </div>
                <div className="h-10 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-2/3 animate-pulse" />
                <div className="h-1.5 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded-full w-full animate-pulse" />
              </div>
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
      gradientFrom: data.netProfit >= 0 ? 'emerald-500/10' : 'red-500/10',
      gradientTo: 'elev-2',
    },
    {
      label: 'Sales Income',
      value: data.salesIncome,
      icon: DollarSign,
      format: 'currency',
      subtitle: 'Gross sales revenue',
      gradientFrom: 'green-500/10',
      gradientTo: 'elev-2',
    },
    {
      label: 'Item Spend',
      value: data.itemSpend,
      icon: ShoppingCart,
      format: 'currency',
      subtitle: 'Total purchase cost',
      gradientFrom: 'orange-500/10',
      gradientTo: 'elev-2',
    },
    {
      label: 'Net Profit From Sold',
      value: data.netProfitFromSold,
      icon: TrendingUp,
      format: 'currency',
      colorClass: data.netProfitFromSold >= 0 ? 'money-pos' : 'money-neg',
      subtitle: 'Realised profit only',
      gradientFrom: data.netProfitFromSold >= 0 ? 'emerald-500/10' : 'red-500/10',
      gradientTo: 'elev-2',
    },
    {
      label: 'Items Purchased',
      value: data.itemsPurchased,
      icon: Package,
      format: 'number',
      subtitle: 'New inventory added',
      gradientFrom: 'blue-500/10',
      gradientTo: 'elev-2',
    },
    {
      label: 'Items Sold',
      value: data.itemsSold,
      icon: Repeat,
      format: 'number',
      subtitle: 'Successfully sold',
      gradientFrom: 'purple-500/10',
      gradientTo: 'elev-2',
    },
    {
      label: 'Subscription Spend',
      value: data.subscriptionSpend,
      icon: CreditCard,
      format: 'currency',
      subtitle: 'Recurring charges',
      gradientFrom: 'pink-500/10',
      gradientTo: 'elev-2',
    },
    {
      label: 'Expense Spend',
      value: data.expenseSpend,
      icon: CreditCard,
      format: 'currency',
      subtitle: 'Fees + shipping + taxes',
      gradientFrom: 'yellow-500/10',
      gradientTo: 'elev-2',
    },
    {
      label: 'Total Spend',
      value: data.totalSpend,
      icon: DollarSign,
      format: 'currency',
      subtitle: 'All expenses combined',
      gradientFrom: 'red-500/10',
      gradientTo: 'elev-2',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-50 mb-0.5">Reports</h3>
          <p className="text-[10px] text-neutral-400">
            {new Date(data.dateRange.from).toLocaleDateString('en-GB')} -{' '}
            {new Date(data.dateRange.to).toLocaleDateString('en-GB')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report, index) => {
          const Icon = report.icon
          const isNegative = report.format === 'currency' && report.value < 0

          return (
            <Card
              key={index}
              className={cn(
                'group relative p-5 border-border/40 hover:border-accent/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(196,164,132,0.1)] hover:scale-[1.02] overflow-hidden',
                `bg-gradient-to-br from-${report.gradientFrom} to-${report.gradientTo}`
              )}
            >
              {/* Glassmorphic overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              {/* Header: Label + Icon */}
              <div className="relative flex items-start justify-between mb-4">
                <span className="label-up text-neutral-400 text-[10px] font-semibold uppercase tracking-wider">{report.label}</span>
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
              </div>

              {/* Main Value */}
              <p
                className={cn(
                  'relative text-3xl md:text-[32px] font-bold mono tabular-nums mb-2',
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

              {/* Subtitle text */}
              {report.subtitle && (
                <p className="relative text-[11px] text-neutral-400 mb-3">{report.subtitle}</p>
              )}

              {/* Enhanced progress bar with gradient */}
              <div className="relative mt-auto h-1.5 w-full rounded-full bg-white/5 overflow-hidden shadow-inner">
                <div
                  className={cn(
                    'h-full transition-all duration-500 rounded-full',
                    report.colorClass?.includes('pos')
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                      : report.colorClass?.includes('neg')
                      ? 'bg-gradient-to-r from-red-500 to-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]'
                      : 'bg-gradient-to-r from-accent to-accent/70 shadow-[0_0_8px_rgba(196,164,132,0.4)]'
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
