/**
 * Customer & Buyer Insights Component
 * Analyze buyer behavior, repeat customers, and customer lifetime value
 */

'use client'

import { useMemo } from 'react'
import { Users, TrendingUp, Star, ShoppingCart, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface CustomerInsightsProps {
  items: any[]
  formatCurrency: (value: number) => string
  className?: string
}

interface Customer {
  id: string
  email?: string
  platform: string
  totalPurchases: number
  totalRevenue: number
  totalProfit: number
  avgOrderValue: number
  firstPurchase: Date
  lastPurchase: Date
  items: any[]
}

interface CustomerSegment {
  name: string
  count: number
  revenue: number
  profit: number
  avgValue: number
  description: string
}

export function CustomerInsights({
  items,
  formatCurrency,
  className
}: CustomerInsightsProps) {
  // Group items by buyer (using platform + any buyer identifier)
  const customers = useMemo((): Customer[] => {
    const grouped = new Map<string, Customer>()

    items.forEach((item) => {
      // Create a key based on platform and any available buyer info
      // In real implementation, would use actual buyer email/ID
      const buyerKey = `${item.platform || 'unknown'}_${item.buyer_email || item.buyer_id || 'anonymous'}`

      const existing = grouped.get(buyerKey) || {
        id: buyerKey,
        email: item.buyer_email,
        platform: item.platform || 'Unknown',
        totalPurchases: 0,
        totalRevenue: 0,
        totalProfit: 0,
        avgOrderValue: 0,
        firstPurchase: new Date(item.saleDate || item.date),
        lastPurchase: new Date(item.saleDate || item.date),
        items: []
      }

      existing.totalPurchases += 1
      existing.totalRevenue += item.salePrice || 0
      existing.totalProfit += item.margin || 0
      existing.items.push(item)

      const itemDate = new Date(item.saleDate || item.date)
      if (itemDate < existing.firstPurchase) existing.firstPurchase = itemDate
      if (itemDate > existing.lastPurchase) existing.lastPurchase = itemDate

      grouped.set(buyerKey, existing)
    })

    // Calculate avgOrderValue
    return Array.from(grouped.values()).map(customer => ({
      ...customer,
      avgOrderValue: customer.totalPurchases > 0 ? customer.totalRevenue / customer.totalPurchases : 0
    })).sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [items])

  // Customer segments
  const segments = useMemo((): CustomerSegment[] => {
    const oneTimers = customers.filter(c => c.totalPurchases === 1)
    const repeatBuyers = customers.filter(c => c.totalPurchases >= 2 && c.totalPurchases < 5)
    const loyalCustomers = customers.filter(c => c.totalPurchases >= 5 && c.totalPurchases < 10)
    const vipCustomers = customers.filter(c => c.totalPurchases >= 10)

    const createSegment = (name: string, customers: Customer[], description: string): CustomerSegment => ({
      name,
      count: customers.length,
      revenue: customers.reduce((sum, c) => sum + c.totalRevenue, 0),
      profit: customers.reduce((sum, c) => sum + c.totalProfit, 0),
      avgValue: customers.length > 0 ? customers.reduce((sum, c) => sum + c.avgOrderValue, 0) / customers.length : 0,
      description
    })

    return [
      createSegment('VIP Customers', vipCustomers, '10+ purchases'),
      createSegment('Loyal Customers', loyalCustomers, '5-9 purchases'),
      createSegment('Repeat Buyers', repeatBuyers, '2-4 purchases'),
      createSegment('One-Time Buyers', oneTimers, '1 purchase')
    ]
  }, [customers])

  // Top customers
  const topCustomers = customers.slice(0, 10)

  // Metrics
  const totalCustomers = customers.length
  const repeatCustomerRate = totalCustomers > 0
    ? (customers.filter(c => c.totalPurchases > 1).length / totalCustomers) * 100
    : 0
  const avgCustomerValue = totalCustomers > 0
    ? customers.reduce((sum, c) => sum + c.totalRevenue, 0) / totalCustomers
    : 0
  const avgPurchaseFrequency = totalCustomers > 0
    ? customers.reduce((sum, c) => sum + c.totalPurchases, 0) / totalCustomers
    : 0

  return (
    <div className={cn('space-y-4', className)}>
      {/* Customer Overview */}
      <div className="bg-elev-1 border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Users className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Customer Insights</h3>
            <p className="text-sm text-muted mt-0.5">Understand your buyer behavior and lifetime value</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Total Customers</div>
            <div className="text-2xl font-bold text-accent mono">{totalCustomers}</div>
            <div className="text-xs text-muted mt-1">unique buyers</div>
          </div>

          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Repeat Rate</div>
            <div className="text-2xl font-bold text-[#00FF94] mono">{repeatCustomerRate.toFixed(1)}%</div>
            <div className="text-xs text-muted mt-1">bought 2+ times</div>
          </div>

          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Avg Customer Value</div>
            <div className="text-2xl font-bold text-accent mono">{formatCurrency(avgCustomerValue)}</div>
            <div className="text-xs text-muted mt-1">lifetime value</div>
          </div>

          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Avg Frequency</div>
            <div className="text-2xl font-bold text-accent mono">{avgPurchaseFrequency.toFixed(1)}x</div>
            <div className="text-xs text-muted mt-1">purchases/customer</div>
          </div>
        </div>

        {/* Customer Segments */}
        <div>
          <h4 className="text-sm font-semibold text-fg mb-3">Customer Segments</h4>
          <div className="space-y-2">
            {segments.map((segment) => {
              const totalRevenue = segments.reduce((sum, s) => sum + s.revenue, 0)
              const revenuePercent = totalRevenue > 0 ? (segment.revenue / totalRevenue) * 100 : 0

              return (
                <div key={segment.name} className="p-4 bg-elev-0 rounded-lg border border-border/30">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-sm font-semibold text-fg">{segment.name}</div>
                        <div className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded">
                          {segment.description}
                        </div>
                      </div>
                      <div className="text-xs text-muted">{segment.count} customers</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-accent mono">{formatCurrency(segment.revenue)}</div>
                      <div className="text-xs text-dim">{revenuePercent.toFixed(1)}% of revenue</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="text-dim mb-0.5">Avg Order Value</div>
                      <div className="text-fg font-mono">{formatCurrency(segment.avgValue)}</div>
                    </div>
                    <div>
                      <div className="text-dim mb-0.5">Total Profit</div>
                      <div className="text-[#00FF94] font-mono">{formatCurrency(segment.profit)}</div>
                    </div>
                    <div>
                      <div className="text-dim mb-0.5">Profit Margin</div>
                      <div className="text-fg font-mono">
                        {segment.revenue > 0 ? ((segment.profit / segment.revenue) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-2 bg-elev-1 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${revenuePercent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Top Customers */}
      <div className="bg-elev-1 border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
          <h4 className="text-sm font-semibold text-fg">Top 10 Customers by Revenue</h4>
        </div>

        <div className="space-y-2">
          {topCustomers.length > 0 ? (
            topCustomers.map((customer, index) => (
              <div
                key={customer.id}
                className="p-3 bg-elev-0 rounded-lg border border-border/30 hover:border-accent/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                      index < 3 ? 'bg-amber-400/20 text-amber-400' : 'bg-elev-1 text-dim'
                    )}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-fg">
                        {customer.email || 'Anonymous Buyer'}
                      </div>
                      <div className="text-xs text-muted">
                        {customer.platform} • {customer.totalPurchases} purchases
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-right">
                    <div>
                      <div className="text-xs text-dim">Revenue</div>
                      <div className="text-sm font-bold text-accent mono">{formatCurrency(customer.totalRevenue)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-dim">Profit</div>
                      <div className="text-sm font-bold text-[#00FF94] mono">{formatCurrency(customer.totalProfit)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-dim">Avg Order</div>
                      <div className="text-sm font-bold text-fg mono">{formatCurrency(customer.avgOrderValue)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <div className="text-dim text-sm">No customer data available</div>
            </div>
          )}
        </div>
      </div>

      {/* Platform Distribution */}
      <div className="bg-elev-1 border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="h-5 w-5 text-accent" />
          <h4 className="text-sm font-semibold text-fg">Customers by Platform</h4>
        </div>

        {useMemo(() => {
          const platformGroups = new Map<string, { count: number; revenue: number }>()
          customers.forEach(customer => {
            const existing = platformGroups.get(customer.platform) || { count: 0, revenue: 0 }
            existing.count += 1
            existing.revenue += customer.totalRevenue
            platformGroups.set(customer.platform, existing)
          })

          return Array.from(platformGroups.entries())
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .map(([platform, data]) => {
              const totalRevenue = Array.from(platformGroups.values()).reduce((sum, d) => sum + d.revenue, 0)
              const percent = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0

              return (
                <div key={platform} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm text-fg">{platform}</div>
                    <div className="text-xs text-dim">{data.count} customers • {formatCurrency(data.revenue)}</div>
                  </div>
                  <div className="h-2 bg-elev-0 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })
        }, [customers, formatCurrency])}
      </div>

      {/* Insights */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="text-sm font-semibold text-blue-400 mb-2">Customer Insights</div>
        <ul className="text-xs text-blue-400 space-y-1 list-disc list-inside">
          {repeatCustomerRate >= 30 && (
            <li>Strong repeat customer rate of {repeatCustomerRate.toFixed(0)}% - focus on retention strategies</li>
          )}
          {repeatCustomerRate < 20 && (
            <li>Low repeat rate ({repeatCustomerRate.toFixed(0)}%) - consider loyalty programs or follow-up campaigns</li>
          )}
          {avgCustomerValue >= 500 && (
            <li>High customer lifetime value - these buyers are your business foundation</li>
          )}
          <li>Top 20% of customers generate {((segments[0]?.revenue || 0) / segments.reduce((sum, s) => sum + s.revenue, 0) * 100).toFixed(0)}% of revenue</li>
        </ul>
      </div>
    </div>
  )
}
