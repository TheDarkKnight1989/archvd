'use client'

import { Card } from '@/components/ui/card'
import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils/cn'

interface BreakdownMetrics {
  // Overall section
  totalSales: number
  totalPurchases: number
  totalProfit: number

  // Inventory section
  itemCount: number
  retailValue: number
  marketValue: number
  unrealisedProfit: number
}

interface BreakdownViewProps {
  metrics: BreakdownMetrics
  loading?: boolean
}

function LargeTile({
  label,
  value,
  subtitle,
  valueClassName,
}: {
  label: string
  value: string
  subtitle?: string
  valueClassName?: string
}) {
  return (
    <Card className="p-6 md:p-8 bg-elev-2 border-border/40 hover:border-border/60 transition-colors">
      <span className="text-xs text-neutral-400 uppercase tracking-[0.16em]">{label}</span>
      <p className={cn('text-[40px] md:text-[48px] leading-none font-semibold mt-2 mb-2 mono tabular-nums', valueClassName || 'text-neutral-50')}>
        {value}
      </p>
      {subtitle && <p className="text-[11px] text-neutral-300">{subtitle}</p>}
    </Card>
  )
}

export function BreakdownView({ metrics, loading = false }: BreakdownViewProps) {
  const { format } = useCurrency()

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Loading skeleton */}
        {Array.from({ length: 2 }).map((_, sectionIdx) => (
          <div key={sectionIdx} className="space-y-4">
            <div className="h-5 bg-elev-1 rounded w-32 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-6 md:p-8 bg-elev-2 border-border/40 animate-pulse">
                  <div className="h-4 bg-elev-1 rounded w-1/2 mb-4" />
                  <div className="h-10 bg-elev-1 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-elev-1 rounded w-2/3" />
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const profitPositive = metrics.totalProfit >= 0
  const unrealisedPositive = metrics.unrealisedProfit >= 0

  return (
    <div className="space-y-8">
      {/* Overall Section */}
      <div>
        <h3 className="text-sm font-medium text-neutral-50 mb-4">Overall</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <LargeTile
            label="Total Sales"
            value={format(metrics.totalSales)}
            subtitle="Revenue from sold items"
          />
          <LargeTile
            label="Total Purchases"
            value={format(metrics.totalPurchases)}
            subtitle="Capital deployed"
          />
          <LargeTile
            label="Total Profit"
            value={`${profitPositive ? '+' : ''}${format(metrics.totalProfit)}`}
            subtitle={`${profitPositive ? 'Net gain' : 'Net loss'} from sales`}
            valueClassName={profitPositive ? 'text-emerald-400' : 'text-red-400'}
          />
        </div>
      </div>

      {/* Inventory Section */}
      <div>
        <h3 className="text-sm font-medium text-neutral-50 mb-4">Inventory</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <LargeTile
            label="Items"
            value={metrics.itemCount.toString()}
            subtitle="In portfolio"
          />
          <LargeTile
            label="Retail Value"
            value={format(metrics.retailValue)}
            subtitle="Original purchase price"
          />
          <LargeTile
            label="Market Value"
            value={format(metrics.marketValue)}
            subtitle="Current estimated value"
          />
          <LargeTile
            label="Unrealised P/L"
            value={`${unrealisedPositive ? '+' : ''}${format(metrics.unrealisedProfit)}`}
            subtitle="Potential profit/loss"
            valueClassName={unrealisedPositive ? 'text-emerald-400' : 'text-red-400'}
          />
        </div>
      </div>
    </div>
  )
}
