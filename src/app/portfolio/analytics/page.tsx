import { Suspense } from 'react'
import { BarChart3, TrendingUp, DollarSign, Package } from 'lucide-react'

/**
 * Analytics Page
 *
 * Advanced analytics and insights for portfolio performance.
 * - Revenue trends
 * - Profit margins
 * - Inventory turnover
 * - Sales by platform/category
 */
export default function AnalyticsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-accent" />
            Analytics
          </h1>
          <p className="text-muted mt-1">
            Advanced insights and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded bg-accent-200/20 text-accent border border-accent-200/30">
            ALPHA
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value="£12,450"
          change="+23.5%"
          icon={DollarSign}
          trend="up"
        />
        <StatCard
          title="Avg. Profit Margin"
          value="42.3%"
          change="+5.2%"
          icon={TrendingUp}
          trend="up"
        />
        <StatCard
          title="Portfolio Turnover"
          value="3.2x"
          change="-0.4x"
          icon={Package}
          trend="down"
        />
        <StatCard
          title="Active Listings"
          value="24"
          change="+8"
          icon={BarChart3}
          trend="up"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-elev-1 border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-fg mb-4">Revenue Trend</h3>
          <div className="h-64 flex items-center justify-center text-dim">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Chart implementation coming soon</p>
            </div>
          </div>
        </div>

        {/* Profit by Category */}
        <div className="bg-elev-1 border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-fg mb-4">Profit by Category</h3>
          <div className="h-64 flex items-center justify-center text-dim">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Chart implementation coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="bg-elev-1 border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-fg mb-4">Top Performing Items</h3>
        <div className="space-y-3">
          <TopPerformerRow
            rank={1}
            sku="DZ5485-410"
            name="Nike Dunk Low University Blue"
            profit={145.50}
            margin={45.2}
          />
          <TopPerformerRow
            rank={2}
            sku="M990GL6"
            name="New Balance 990v6 Grey"
            profit={125.00}
            margin={38.5}
          />
          <TopPerformerRow
            rank={3}
            sku="GW3773"
            name="Yeezy 350 V2 Bone"
            profit={98.75}
            margin={35.1}
          />
        </div>
      </div>

      {/* Implementation Note */}
      <div className="bg-accent-200/10 border border-accent-200/30 rounded-lg p-4">
        <p className="text-sm text-dim">
          <strong className="text-accent">Note:</strong> Advanced analytics features are currently in development.
          Full implementation includes revenue forecasting, cohort analysis, and custom report builder.
        </p>
      </div>
    </div>
  )
}

// Stat Card Component
interface StatCardProps {
  title: string
  value: string
  change: string
  icon: React.ComponentType<{ className?: string }>
  trend: 'up' | 'down'
}

function StatCard({ title, value, change, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="bg-elev-1 border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted">{title}</span>
        <Icon className="h-5 w-5 text-accent opacity-70" />
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-bold text-fg">{value}</div>
        <div className={`text-xs ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
          {change} vs last period
        </div>
      </div>
    </div>
  )
}

// Top Performer Row Component
interface TopPerformerRowProps {
  rank: number
  sku: string
  name: string
  profit: number
  margin: number
}

function TopPerformerRow({ rank, sku, name, profit, margin }: TopPerformerRowProps) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-elev-2/50 border border-border/50">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-200/20 text-accent flex items-center justify-center text-sm font-bold">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-fg truncate">{name}</div>
        <div className="text-xs text-muted">{sku}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-green-500">+£{profit.toFixed(2)}</div>
        <div className="text-xs text-muted">{margin.toFixed(1)}% margin</div>
      </div>
    </div>
  )
}
