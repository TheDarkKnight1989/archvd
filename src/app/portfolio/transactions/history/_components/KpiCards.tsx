'use client'

import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import type { TxKpis } from '@/lib/transactions/types'

interface KpiCardsProps {
  kpis: TxKpis
  type: 'sales' | 'purchases'
}

export function KpiCards({ kpis, type }: KpiCardsProps) {
  const { convert, format } = useCurrency()

  if (type === 'sales') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
          <div className="text-xs text-dim uppercase tracking-wider mb-1.5">Total Sales</div>
          <div className="text-2xl font-bold text-fg font-mono">
            {format(convert(kpis.totalSales || 0, 'GBP'))}
          </div>
          <div className="text-xs text-muted mt-1.5">{kpis.transactions || 0} transactions</div>
        </div>

        <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
          <div className="text-xs text-dim uppercase tracking-wider mb-1.5">Realized Gains</div>
          <div
            className={cn(
              'text-2xl font-bold font-mono',
              (kpis.realizedGains || 0) >= 0 ? 'money-pos' : 'money-neg'
            )}
          >
            {(kpis.realizedGains || 0) >= 0 ? '+' : ''}
            {format(convert(kpis.realizedGains || 0, 'GBP'))}
          </div>
          <div className="text-xs text-muted mt-1.5">Total profit</div>
        </div>

        <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
          <div className="text-xs text-dim uppercase tracking-wider mb-1.5">Transactions</div>
          <div className="text-2xl font-bold text-fg font-mono">{kpis.transactions || 0}</div>
          <div className="text-xs text-muted mt-1.5">Items sold</div>
        </div>

        <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
          <div className="text-xs text-dim uppercase tracking-wider mb-1.5">Avg Gain %</div>
          <div
            className={cn(
              'text-2xl font-bold font-mono',
              (kpis.avgGainPct || 0) >= 0 ? 'money-pos' : 'money-neg'
            )}
          >
            {(kpis.avgGainPct || 0) >= 0 ? '+' : ''}
            {(kpis.avgGainPct || 0).toFixed(1)}%
          </div>
          <div className="text-xs text-muted mt-1.5">Average profit margin</div>
        </div>
      </div>
    )
  }

  // Purchases KPIs
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
        <div className="text-xs text-dim uppercase tracking-wider mb-1.5">Total Spent</div>
        <div className="text-2xl font-bold text-fg font-mono">
          {format(convert(kpis.totalSpent || 0, 'GBP'))}
        </div>
        <div className="text-xs text-muted mt-1.5">Including fees</div>
      </div>

      <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
        <div className="text-xs text-dim uppercase tracking-wider mb-1.5">Total Items</div>
        <div className="text-2xl font-bold text-fg font-mono">{kpis.totalItems || 0}</div>
        <div className="text-xs text-muted mt-1.5">Quantity purchased</div>
      </div>

      <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
        <div className="text-xs text-dim uppercase tracking-wider mb-1.5">Unique Products</div>
        <div className="text-2xl font-bold text-fg font-mono">{kpis.uniqueProducts || 0}</div>
        <div className="text-xs text-muted mt-1.5">Distinct SKUs</div>
      </div>

      <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
        <div className="text-xs text-dim uppercase tracking-wider mb-1.5">Recent 7d</div>
        <div className="text-2xl font-bold text-fg font-mono">{kpis.recent7d || 0}</div>
        <div className="text-xs text-muted mt-1.5">Last week</div>
      </div>
    </div>
  )
}
