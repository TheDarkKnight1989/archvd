'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useCurrency } from '@/hooks/useCurrency'
import { usePortfolioSeries, type Timeframe as SeriesTimeframe } from '@/hooks/usePortfolioSeries'
import { cn } from '@/lib/utils/cn'

interface MetricChartData {
  date: string
  value: number
}

interface ReportsViewProps {
  // Pass down reports data from parent
  netProfit: number
  salesIncome: number
  itemSpend: number
  netProfitFromSold: number
  avgProfitPerSale: number
  conversionRate: number
  totalFees: number
  avgHoldingPeriod: number
}

const TIMEFRAME_LABELS: Record<SeriesTimeframe, string> = {
  '24h': '24H',
  '1w': '1W',
  mtd: 'MTD',
  '1m': '1M',
  '3m': '3M',
  '1y': '1Y',
  all: 'ALL',
}

function TimeframeChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-full text-[11px] font-medium transition-colors',
        active
          ? 'bg-accent/25 text-accent-100 border border-accent/80 shadow-[0_0_12px_rgba(74,222,128,0.35)]'
          : 'border border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100'
      )}
    >
      {label}
    </button>
  )
}

function MetricCard({
  title,
  value,
  format,
  chartData,
  currency,
}: {
  title: string
  value: number
  format: 'currency' | 'percentage' | 'number' | 'days'
  chartData: MetricChartData[]
  currency: string
}) {
  const { format: formatCurrency } = useCurrency()

  const formatValue = () => {
    // Handle undefined/null values
    const safeValue = value ?? 0

    switch (format) {
      case 'currency':
        return formatCurrency(safeValue)
      case 'percentage':
        return `${safeValue.toFixed(1)}%`
      case 'days':
        return `${safeValue.toFixed(0)}d`
      default:
        return safeValue.toFixed(2)
    }
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0].payload
    return (
      <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-medium">
        <p className="text-xs text-dim mb-1">{new Date(data.date).toLocaleDateString('en-GB')}</p>
        <p className="text-sm font-semibold text-fg mono">
          {format === 'currency'
            ? formatCurrency(data.value)
            : format === 'percentage'
            ? `${data.value.toFixed(1)}%`
            : data.value.toFixed(0)}
        </p>
      </div>
    )
  }

  return (
    <Card className="p-4 bg-elev-2 border-border/40">
      <p className="text-xs text-neutral-400 uppercase tracking-[0.12em] mb-2">{title}</p>
      <p className="text-2xl font-semibold text-neutral-50 mb-3 mono tabular-nums">{formatValue()}</p>

      {/* Mini chart */}
      {chartData.length > 0 && (
        <div className="w-full h-20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="rgb(196, 164, 132)"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: 'rgb(196, 164, 132)', stroke: '#000', strokeWidth: 1 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

export function ReportsView({ netProfit, salesIncome, itemSpend, netProfitFromSold, avgProfitPerSale, conversionRate, totalFees, avgHoldingPeriod }: ReportsViewProps) {
  const [timeframe, setTimeframe] = useState<SeriesTimeframe>('1m')
  const { currency } = useCurrency()

  // Fetch real time-series data
  const { data: seriesData, loading: seriesLoading } = usePortfolioSeries(timeframe)

  return (
    <div className="space-y-6">
      {/* Timeframe Controls */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(TIMEFRAME_LABELS) as SeriesTimeframe[]).map((tf) => (
          <TimeframeChip
            key={tf}
            label={TIMEFRAME_LABELS[tf]}
            active={timeframe === tf}
            onClick={() => setTimeframe(tf)}
          />
        ))}
      </div>

      {/* Primary Net Profit Chart */}
      <Card className="p-6 bg-elev-2 border-border/40">
        <h3 className="text-sm font-medium text-neutral-50 mb-4">Net Profit</h3>
        <p className="text-[40px] font-semibold text-neutral-50 mb-4 mono tabular-nums">
          {netProfit >= 0 ? '+' : ''}
          {currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'}
          {netProfit.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>

        {seriesLoading ? (
          <div className="w-full h-64 flex items-center justify-center">
            <p className="text-sm text-neutral-400">Loading chart data...</p>
          </div>
        ) : seriesData.net_profit.length > 0 ? (
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={seriesData.net_profit} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.2)"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return `${date.getDate()}/${date.getMonth() + 1}`
                  }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.2)"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  tickFormatter={(value) => {
                    if (value >= 1000) {
                      return `${currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'}${(value / 1000).toFixed(0)}k`
                    }
                    return `${currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'}${value}`
                  }}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="rgb(196, 164, 132)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: 'rgb(196, 164, 132)', stroke: '#000', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="w-full h-64 flex items-center justify-center">
            <p className="text-sm text-neutral-400">No data available for this timeframe</p>
          </div>
        )}
      </Card>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Sales Income"
          value={salesIncome}
          format="currency"
          chartData={seriesData.sales_income}
          currency={currency}
        />
        <MetricCard
          title="Item Spend"
          value={itemSpend}
          format="currency"
          chartData={seriesData.item_spend}
          currency={currency}
        />
        <MetricCard
          title="Net from Sold"
          value={netProfitFromSold}
          format="currency"
          chartData={seriesData.net_profit}
          currency={currency}
        />
        <MetricCard
          title="Avg Profit/Sale"
          value={avgProfitPerSale}
          format="currency"
          chartData={seriesData.sales_income}
          currency={currency}
        />
        <MetricCard
          title="Items Sold"
          value={0}
          format="number"
          chartData={seriesData.items_sold}
          currency={currency}
        />
        <MetricCard
          title="Total Spend"
          value={itemSpend}
          format="currency"
          chartData={seriesData.total_spend}
          currency={currency}
        />
        <MetricCard
          title="Subscription Spend"
          value={0}
          format="currency"
          chartData={seriesData.subscription_spend}
          currency={currency}
        />
      </div>
    </div>
  )
}
