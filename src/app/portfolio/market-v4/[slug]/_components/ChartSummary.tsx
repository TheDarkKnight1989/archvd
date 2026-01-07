'use client'

/**
 * ChartSummary - Summary stats for the selected chart period
 *
 * Shows: High, Low, Avg, Volume
 */

interface ChartSummaryProps {
  summary: {
    high: number
    low: number
    avg: number
    volume: number
  } | null
  loading?: boolean
  currencySymbol?: string
}

export function ChartSummary({ summary, loading, currencySymbol = '$' }: ChartSummaryProps) {
  if (loading) {
    return (
      <div className="flex justify-between text-sm animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="text-center">
            <div className="h-3 bg-muted rounded w-10 mx-auto mb-1" />
            <div className="h-4 bg-muted rounded w-14 mx-auto" />
          </div>
        ))}
      </div>
    )
  }

  if (!summary) {
    return null
  }

  const stats = [
    { label: 'High', value: summary.high, prefix: currencySymbol },
    { label: 'Low', value: summary.low, prefix: currencySymbol },
    { label: 'Avg', value: summary.avg, prefix: currencySymbol },
    { label: 'Volume', value: summary.volume, prefix: '', suffix: ' sales' },
  ]

  return (
    <div className="flex justify-between text-sm">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <div className="text-xs text-muted-foreground">{stat.label}</div>
          <div className="font-mono font-medium">
            {stat.prefix}{stat.value.toLocaleString()}{stat.suffix || ''}
          </div>
        </div>
      ))}
    </div>
  )
}
