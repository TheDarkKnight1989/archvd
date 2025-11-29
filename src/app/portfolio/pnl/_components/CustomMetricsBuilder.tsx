/**
 * Custom Metrics Builder Component
 * Allow users to create and track their own KPIs
 */

'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Star, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

interface CustomMetric {
  id: string
  name: string
  formula: string
  target: number
  current: number
  unit: 'currency' | 'percentage' | 'number'
  category: 'revenue' | 'profit' | 'efficiency' | 'growth' | 'custom'
  isPinned: boolean
}

interface CustomMetricsBuilderProps {
  revenue: number
  profit: number
  items: any[]
  formatCurrency: (value: number) => string
  className?: string
}

export function CustomMetricsBuilder({
  revenue,
  profit,
  items,
  formatCurrency,
  className
}: CustomMetricsBuilderProps) {
  // Default custom metrics (in real app, these would be saved to DB)
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([
    {
      id: '1',
      name: 'Average Profit Per Sale',
      formula: 'profit / itemsSold',
      target: 100,
      current: items.length > 0 ? profit / items.length : 0,
      unit: 'currency',
      category: 'profit',
      isPinned: true
    },
    {
      id: '2',
      name: 'Daily Revenue Run Rate',
      formula: 'revenue / daysInPeriod',
      target: 200,
      current: revenue / 90, // Assuming 90 day period
      unit: 'currency',
      category: 'revenue',
      isPinned: false
    },
    {
      id: '3',
      name: 'Sales Conversion Rate',
      formula: 'itemsSold / totalListings',
      target: 50,
      current: 35, // Mock data
      unit: 'percentage',
      category: 'efficiency',
      isPinned: true
    }
  ])

  const [isCreating, setIsCreating] = useState(false)
  const [newMetric, setNewMetric] = useState<Partial<CustomMetric>>({
    name: '',
    formula: '',
    target: 0,
    unit: 'number',
    category: 'custom'
  })

  const handleCreate = () => {
    if (!newMetric.name || !newMetric.formula) return

    const metric: CustomMetric = {
      id: Date.now().toString(),
      name: newMetric.name,
      formula: newMetric.formula,
      target: newMetric.target || 0,
      current: 0, // Would be calculated based on formula
      unit: newMetric.unit || 'number',
      category: newMetric.category || 'custom',
      isPinned: false
    }

    setCustomMetrics([...customMetrics, metric])
    setNewMetric({ name: '', formula: '', target: 0, unit: 'number', category: 'custom' })
    setIsCreating(false)
  }

  const handleDelete = (id: string) => {
    setCustomMetrics(customMetrics.filter(m => m.id !== id))
  }

  const handleTogglePin = (id: string) => {
    setCustomMetrics(customMetrics.map(m =>
      m.id === id ? { ...m, isPinned: !m.isPinned } : m
    ))
  }

  const pinnedMetrics = customMetrics.filter(m => m.isPinned)
  const unpinnedMetrics = customMetrics.filter(m => !m.isPinned)

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Custom Metrics</h3>
            <p className="text-sm text-muted mt-0.5">Track your own KPIs and benchmarks</p>
          </div>
        </div>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          size="sm"
          className="bg-accent/20 text-fg hover:bg-accent/30"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Metric
        </Button>
      </div>

      {/* Create New Metric Form */}
      {isCreating && (
        <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg mb-5">
          <div className="text-sm font-semibold text-purple-400 mb-3">Create Custom Metric</div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-dim uppercase tracking-wide mb-1 block">Metric Name</label>
              <input
                type="text"
                value={newMetric.name || ''}
                onChange={(e) => setNewMetric({ ...newMetric, name: e.target.value })}
                placeholder="e.g., Return on Inventory Investment"
                className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-dim uppercase tracking-wide mb-1 block">Unit Type</label>
                <select
                  value={newMetric.unit || 'number'}
                  onChange={(e) => setNewMetric({ ...newMetric, unit: e.target.value as any })}
                  className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg"
                >
                  <option value="currency">Currency (£)</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="number">Number</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-dim uppercase tracking-wide mb-1 block">Target Value</label>
                <input
                  type="number"
                  value={newMetric.target || 0}
                  onChange={(e) => setNewMetric({ ...newMetric, target: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-dim uppercase tracking-wide mb-1 block">Category</label>
              <select
                value={newMetric.category || 'custom'}
                onChange={(e) => setNewMetric({ ...newMetric, category: e.target.value as any })}
                className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg"
              >
                <option value="revenue">Revenue</option>
                <option value="profit">Profit</option>
                <option value="efficiency">Efficiency</option>
                <option value="growth">Growth</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-dim uppercase tracking-wide mb-1 block">
                Formula (For Display Only)
              </label>
              <input
                type="text"
                value={newMetric.formula || ''}
                onChange={(e) => setNewMetric({ ...newMetric, formula: e.target.value })}
                placeholder="e.g., profit / totalInventoryCost * 100"
                className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg font-mono"
              />
              <div className="text-xs text-dim mt-1">Formula is for reference - actual calculation would be implemented</div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={!newMetric.name || !newMetric.formula}
                size="sm"
                className="bg-purple-500 text-white hover:bg-purple-600"
              >
                Create Metric
              </Button>
              <Button
                onClick={() => setIsCreating(false)}
                size="sm"
                variant="outline"
                className="border-border/30"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pinned Metrics */}
      {pinnedMetrics.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            <h4 className="text-sm font-semibold text-fg">Pinned Metrics</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pinnedMetrics.map((metric) => (
              <MetricCard
                key={metric.id}
                metric={metric}
                formatCurrency={formatCurrency}
                onDelete={handleDelete}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Metrics */}
      {unpinnedMetrics.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-fg mb-3">All Metrics</h4>
          <div className="space-y-2">
            {unpinnedMetrics.map((metric) => (
              <MetricCard
                key={metric.id}
                metric={metric}
                formatCurrency={formatCurrency}
                onDelete={handleDelete}
                onTogglePin={handleTogglePin}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {customMetrics.length === 0 && !isCreating && (
        <div className="text-center py-8">
          <div className="text-dim text-sm mb-2">No custom metrics yet</div>
          <div className="text-xs text-muted">Click "New Metric" to create your first custom KPI</div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-5 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
        <strong>Pro Tip:</strong> Pin your most important metrics to track them at a glance. Custom metrics help you measure what matters most to your business.
      </div>
    </div>
  )
}

interface MetricCardProps {
  metric: CustomMetric
  formatCurrency: (value: number) => string
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
  compact?: boolean
}

function MetricCard({ metric, formatCurrency, onDelete, onTogglePin, compact }: MetricCardProps) {
  const progress = metric.target > 0 ? Math.min(100, (metric.current / metric.target) * 100) : 0
  const isOnTrack = progress >= 75

  const formatValue = (value: number) => {
    switch (metric.unit) {
      case 'currency': return formatCurrency(value)
      case 'percentage': return `${value.toFixed(1)}%`
      case 'number': return value.toFixed(0)
    }
  }

  const categoryColors = {
    revenue: 'text-accent',
    profit: 'text-[#00FF94]',
    efficiency: 'text-blue-400',
    growth: 'text-purple-400',
    custom: 'text-dim'
  }

  if (compact) {
    return (
      <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-fg">{metric.name}</div>
              <div className={cn('text-xs', categoryColors[metric.category])}>
                {metric.category}
              </div>
            </div>
            <div className="text-xs text-dim mt-0.5 font-mono">{metric.formula}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className={cn(
                'text-lg font-bold mono',
                isOnTrack ? 'text-[#00FF94]' : 'text-amber-400'
              )}>
                {formatValue(metric.current)}
              </div>
              <div className="text-xs text-dim">of {formatValue(metric.target)}</div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => onTogglePin(metric.id)}
                className="p-1.5 hover:bg-elev-1 rounded transition-colors"
              >
                <Star className={cn(
                  'h-4 w-4',
                  metric.isPinned ? 'text-amber-400 fill-amber-400' : 'text-dim'
                )} />
              </button>
              <button
                onClick={() => onDelete(metric.id)}
                className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-elev-0 rounded-lg border border-border/30">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-sm font-semibold text-fg">{metric.name}</div>
            <div className={cn(
              'px-2 py-0.5 rounded text-xs font-semibold',
              categoryColors[metric.category]
            )}>
              {metric.category}
            </div>
          </div>
          <div className="text-xs text-dim font-mono">{metric.formula}</div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onTogglePin(metric.id)}
            className="p-1.5 hover:bg-elev-1 rounded transition-colors"
          >
            <Star className={cn(
              'h-4 w-4',
              metric.isPinned ? 'text-amber-400 fill-amber-400' : 'text-dim'
            )} />
          </button>
          <button
            onClick={() => onDelete(metric.id)}
            className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
          >
            <Trash2 className="h-4 w-4 text-red-400" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-xs text-dim mb-0.5">Current</div>
          <div className={cn(
            'text-xl font-bold mono',
            isOnTrack ? 'text-[#00FF94]' : 'text-amber-400'
          )}>
            {formatValue(metric.current)}
          </div>
        </div>
        <div>
          <div className="text-xs text-dim mb-0.5">Target</div>
          <div className="text-xl font-bold text-accent mono">{formatValue(metric.target)}</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-elev-1 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all',
            isOnTrack ? 'bg-[#00FF94]' : 'bg-amber-400'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-xs text-dim text-right mt-1">{progress.toFixed(0)}% of target</div>
    </div>
  )
}
