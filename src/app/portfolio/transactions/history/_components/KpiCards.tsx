'use client'

import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { TrendingUp, DollarSign, ShoppingCart, Percent, Package, Hash, Calendar } from 'lucide-react'
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
        {/* Total Sales */}
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-xl p-5 transition-all hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-blue-400 uppercase tracking-wider font-semibold">Total Sales</div>
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-fg font-mono mb-2">
            {format(convert(kpis.totalSales || 0, 'GBP'))}
          </div>
          <div className="text-xs text-muted">{kpis.transactions || 0} transactions</div>
        </div>

        {/* Realized Gains */}
        <div className={cn(
          "bg-gradient-to-br rounded-xl p-5 transition-all hover:shadow-lg border",
          (kpis.realizedGains || 0) >= 0
            ? "from-green-500/10 to-green-500/5 border-green-500/20 hover:border-green-500/30 hover:shadow-green-500/5"
            : "from-red-500/10 to-red-500/5 border-red-500/20 hover:border-red-500/30 hover:shadow-red-500/5"
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className={cn(
              "text-xs uppercase tracking-wider font-semibold",
              (kpis.realizedGains || 0) >= 0 ? "text-green-400" : "text-red-400"
            )}>
              Realized Gains
            </div>
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              (kpis.realizedGains || 0) >= 0 ? "bg-green-500/10" : "bg-red-500/10"
            )}>
              <TrendingUp className={cn(
                "h-5 w-5",
                (kpis.realizedGains || 0) >= 0 ? "text-green-400" : "text-red-400"
              )} />
            </div>
          </div>
          <div
            className={cn(
              'text-2xl md:text-3xl font-bold font-mono mb-2',
              (kpis.realizedGains || 0) >= 0 ? 'text-green-400' : 'text-red-400'
            )}
          >
            {(kpis.realizedGains || 0) >= 0 ? '+' : ''}
            {format(convert(kpis.realizedGains || 0, 'GBP'))}
          </div>
          <div className="text-xs text-muted">Total profit</div>
        </div>

        {/* Transactions Count */}
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl p-5 transition-all hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-purple-400 uppercase tracking-wider font-semibold">Transactions</div>
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-purple-400" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-fg font-mono mb-2">
            {kpis.transactions || 0}
          </div>
          <div className="text-xs text-muted">Items sold</div>
        </div>

        {/* Avg Gain % */}
        <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-5 transition-all hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-accent uppercase tracking-wider font-semibold">Avg Gain %</div>
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Percent className="h-5 w-5 text-accent" />
            </div>
          </div>
          <div
            className={cn(
              'text-2xl md:text-3xl font-bold font-mono mb-2',
              (kpis.avgGainPct || 0) >= 0 ? 'text-green-400' : 'text-red-400'
            )}
          >
            {(kpis.avgGainPct || 0) >= 0 ? '+' : ''}
            {(kpis.avgGainPct || 0).toFixed(1)}%
          </div>
          <div className="text-xs text-muted">Average profit margin</div>
        </div>
      </div>
    )
  }

  // Purchases KPIs
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {/* Total Spent */}
      <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 rounded-xl p-5 transition-all hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-orange-400 uppercase tracking-wider font-semibold">Total Spent</div>
          <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-orange-400" />
          </div>
        </div>
        <div className="text-2xl md:text-3xl font-bold text-fg font-mono mb-2">
          {format(convert(kpis.totalSpent || 0, 'GBP'))}
        </div>
        <div className="text-xs text-muted">Including fees</div>
      </div>

      {/* Total Items */}
      <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-xl p-5 transition-all hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-blue-400 uppercase tracking-wider font-semibold">Total Items</div>
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-blue-400" />
          </div>
        </div>
        <div className="text-2xl md:text-3xl font-bold text-fg font-mono mb-2">
          {kpis.totalItems || 0}
        </div>
        <div className="text-xs text-muted">Quantity purchased</div>
      </div>

      {/* Unique Products */}
      <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl p-5 transition-all hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-purple-400 uppercase tracking-wider font-semibold">Unique Products</div>
          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
            <Hash className="h-5 w-5 text-purple-400" />
          </div>
        </div>
        <div className="text-2xl md:text-3xl font-bold text-fg font-mono mb-2">
          {kpis.uniqueProducts || 0}
        </div>
        <div className="text-xs text-muted">Distinct SKUs</div>
      </div>

      {/* Recent 7d */}
      <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-5 transition-all hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-accent uppercase tracking-wider font-semibold">Recent 7d</div>
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-accent" />
          </div>
        </div>
        <div className="text-2xl md:text-3xl font-bold text-fg font-mono mb-2">
          {kpis.recent7d || 0}
        </div>
        <div className="text-xs text-muted">Last week</div>
      </div>
    </div>
  )
}
