/**
 * Cost Allocation Tool Component
 * Distribute shared costs across products, platforms, or time periods
 */

'use client'

import { useState, useMemo } from 'react'
import { Calculator, DollarSign, PieChart, TrendingUp, Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

interface AllocationRule {
  id: string
  name: string
  method: 'equal' | 'revenue-based' | 'units-based' | 'custom'
  amount: number
  category: string
  allocatedTo: 'products' | 'platforms' | 'brands' | 'time-periods'
  customWeights?: Record<string, number>
}

interface AllocationResult {
  entity: string
  allocated: number
  percentage: number
  basis: number
}

interface CostAllocationProps {
  items: any[]
  expenses: any[]
  revenue: number
  formatCurrency: (value: number) => string
  className?: string
}

export function CostAllocation({
  items,
  expenses,
  revenue,
  formatCurrency,
  className
}: CostAllocationProps) {
  const [rules, setRules] = useState<AllocationRule[]>([
    {
      id: '1',
      name: 'Shipping & Handling',
      method: 'revenue-based',
      amount: 450,
      category: 'Shipping',
      allocatedTo: 'products'
    },
    {
      id: '2',
      name: 'Platform Fees',
      method: 'revenue-based',
      amount: 680,
      category: 'Fees',
      allocatedTo: 'platforms'
    },
    {
      id: '3',
      name: 'Marketing Spend',
      method: 'equal',
      amount: 300,
      category: 'Marketing',
      allocatedTo: 'brands'
    }
  ])

  const [isCreating, setIsCreating] = useState(false)
  const [newRule, setNewRule] = useState<Partial<AllocationRule>>({
    name: '',
    method: 'revenue-based',
    amount: 0,
    category: 'Other',
    allocatedTo: 'products'
  })

  // Calculate allocations
  const allocations = useMemo(() => {
    return rules.map(rule => {
      const results: AllocationResult[] = []

      // Group items based on allocation target
      const grouped = new Map<string, { revenue: number; count: number; items: any[] }>()

      items.forEach(item => {
        let key = ''
        switch (rule.allocatedTo) {
          case 'products':
            key = item.name || 'Unknown Product'
            break
          case 'platforms':
            key = item.platform || 'Unknown Platform'
            break
          case 'brands':
            key = item.brand || 'Unknown Brand'
            break
          case 'time-periods':
            const date = new Date(item.saleDate || item.date)
            key = date.toLocaleString('en-GB', { month: 'long', year: 'numeric' })
            break
        }

        const existing = grouped.get(key) || { revenue: 0, count: 0, items: [] }
        existing.revenue += item.salePrice || 0
        existing.count += 1
        existing.items.push(item)
        grouped.set(key, existing)
      })

      // Calculate total basis for allocation
      const totalBasis = rule.method === 'units-based'
        ? items.length
        : rule.method === 'revenue-based'
        ? revenue
        : rule.method === 'custom' && rule.customWeights
        ? Object.values(rule.customWeights).reduce((sum, w) => sum + w, 0)
        : grouped.size // equal split

      // Allocate costs
      Array.from(grouped.entries()).forEach(([entity, data]) => {
        let allocated = 0
        let basis = 0

        switch (rule.method) {
          case 'equal':
            allocated = rule.amount / grouped.size
            basis = 1
            break
          case 'revenue-based':
            basis = data.revenue
            allocated = (data.revenue / totalBasis) * rule.amount
            break
          case 'units-based':
            basis = data.count
            allocated = (data.count / totalBasis) * rule.amount
            break
          case 'custom':
            if (rule.customWeights && rule.customWeights[entity]) {
              basis = rule.customWeights[entity]
              allocated = (rule.customWeights[entity] / totalBasis) * rule.amount
            }
            break
        }

        results.push({
          entity,
          allocated,
          percentage: (allocated / rule.amount) * 100,
          basis
        })
      })

      return {
        rule,
        results: results.sort((a, b) => b.allocated - a.allocated)
      }
    })
  }, [rules, items, revenue])

  const totalAllocated = rules.reduce((sum, rule) => sum + rule.amount, 0)

  const handleCreateRule = () => {
    if (!newRule.name || !newRule.amount) return

    const rule: AllocationRule = {
      id: Date.now().toString(),
      name: newRule.name,
      method: newRule.method || 'revenue-based',
      amount: newRule.amount,
      category: newRule.category || 'Other',
      allocatedTo: newRule.allocatedTo || 'products'
    }

    setRules([...rules, rule])
    setNewRule({ name: '', method: 'revenue-based', amount: 0, category: 'Other', allocatedTo: 'products' })
    setIsCreating(false)
  }

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id))
  }

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Cost Allocation</h3>
            <p className="text-sm text-muted mt-0.5">Distribute shared costs across your business</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Total Allocated</div>
          <div className="text-2xl font-bold text-accent mono">{formatCurrency(totalAllocated)}</div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="p-4 bg-elev-0 rounded-lg border border-border/30">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Allocation Rules</div>
          <div className="text-2xl font-bold text-fg mono">{rules.length}</div>
          <div className="text-xs text-muted mt-1">active rules</div>
        </div>

        <div className="p-4 bg-elev-0 rounded-lg border border-border/30">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Cost per Item</div>
          <div className="text-2xl font-bold text-accent mono">
            {items.length > 0 ? formatCurrency(totalAllocated / items.length) : formatCurrency(0)}
          </div>
          <div className="text-xs text-muted mt-1">average allocation</div>
        </div>

        <div className="p-4 bg-elev-0 rounded-lg border border-border/30">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Impact on Margin</div>
          <div className="text-2xl font-bold text-red-400 mono">
            {revenue > 0 ? ((totalAllocated / revenue) * 100).toFixed(1) : 0}%
          </div>
          <div className="text-xs text-muted mt-1">of revenue</div>
        </div>
      </div>

      {/* Create New Rule */}
      <div className="mb-5">
        <Button
          onClick={() => setIsCreating(!isCreating)}
          size="sm"
          className="bg-accent/20 text-fg hover:bg-accent/30"
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Add Allocation Rule
        </Button>
      </div>

      {isCreating && (
        <div className="mb-5 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="text-sm font-semibold text-purple-400 mb-3">New Allocation Rule</div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-dim uppercase tracking-wide mb-1 block">Rule Name</label>
                <input
                  type="text"
                  value={newRule.name || ''}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g., Storage Costs"
                  className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg"
                />
              </div>

              <div>
                <label className="text-xs text-dim uppercase tracking-wide mb-1 block">Total Amount</label>
                <input
                  type="number"
                  value={newRule.amount || 0}
                  onChange={(e) => setNewRule({ ...newRule, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-dim uppercase tracking-wide mb-1 block">Allocation Method</label>
                <select
                  value={newRule.method || 'revenue-based'}
                  onChange={(e) => setNewRule({ ...newRule, method: e.target.value as any })}
                  className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg"
                >
                  <option value="equal">Equal Split</option>
                  <option value="revenue-based">Revenue Based</option>
                  <option value="units-based">Units Based</option>
                  <option value="custom">Custom Weights</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-dim uppercase tracking-wide mb-1 block">Allocate To</label>
                <select
                  value={newRule.allocatedTo || 'products'}
                  onChange={(e) => setNewRule({ ...newRule, allocatedTo: e.target.value as any })}
                  className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg"
                >
                  <option value="products">Products</option>
                  <option value="platforms">Platforms</option>
                  <option value="brands">Brands</option>
                  <option value="time-periods">Time Periods</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCreateRule}
                disabled={!newRule.name || !newRule.amount}
                size="sm"
                className="bg-purple-500 text-white hover:bg-purple-600"
              >
                Create Rule
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

      {/* Allocation Rules */}
      <div className="space-y-4">
        {allocations.map(({ rule, results }) => (
          <div key={rule.id} className="p-4 bg-elev-0 rounded-lg border border-border/30">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-sm font-semibold text-fg">{rule.name}</div>
                  <div className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded">
                    {rule.method.replace('-', ' ')}
                  </div>
                  <div className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded">
                    {rule.allocatedTo}
                  </div>
                </div>
                <div className="text-xs text-muted">{rule.category}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-accent mono">{formatCurrency(rule.amount)}</div>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="text-xs text-red-400 hover:underline mt-1"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Allocation Breakdown */}
            <div className="space-y-2">
              <div className="text-xs text-dim uppercase tracking-wide mb-2">Allocation Breakdown</div>
              {results.slice(0, 5).map((result) => (
                <div key={result.entity} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-fg">{result.entity}</div>
                      <div className="text-xs font-mono text-dim">{result.percentage.toFixed(1)}%</div>
                    </div>
                    <div className="h-1.5 bg-elev-1 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{ width: `${result.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-sm font-bold text-accent mono w-24 text-right">
                    {formatCurrency(result.allocated)}
                  </div>
                </div>
              ))}
              {results.length > 5 && (
                <div className="text-xs text-dim text-center pt-2">
                  +{results.length - 5} more...
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {rules.length === 0 && !isCreating && (
        <div className="text-center py-8">
          <div className="text-dim text-sm mb-2">No allocation rules yet</div>
          <div className="text-xs text-muted">Create rules to distribute shared costs</div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-5 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Cost Allocation Methods:</strong>
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              <li><strong>Equal Split:</strong> Divides cost equally across all entities</li>
              <li><strong>Revenue Based:</strong> Allocates proportionally to revenue generated</li>
              <li><strong>Units Based:</strong> Allocates proportionally to number of units</li>
              <li><strong>Custom Weights:</strong> Use your own allocation percentages</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
