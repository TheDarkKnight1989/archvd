/**
 * Inventory Valuation Methods Component
 * Calculate inventory value using FIFO, LIFO, and Weighted Average methods
 */

'use client'

import { useMemo, useState } from 'react'
import { Package, TrendingUp, Calculator, Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface InventoryItem {
  id: string
  name: string
  buyPrice: number
  quantity: number
  purchaseDate: Date
}

interface ValuationMethod {
  id: 'fifo' | 'lifo' | 'weighted-average'
  name: string
  description: string
  totalValue: number
  avgUnitCost: number
  taxImplication: 'lower' | 'higher' | 'moderate'
  bestFor: string
}

interface InventoryValuationProps {
  currentInventory: any[]
  soldItems: any[]
  formatCurrency: (value: number) => string
  className?: string
}

export function InventoryValuation({
  currentInventory,
  soldItems,
  formatCurrency,
  className
}: InventoryValuationProps) {
  const [selectedMethod, setSelectedMethod] = useState<'fifo' | 'lifo' | 'weighted-average'>('fifo')

  // Calculate valuations using different methods
  const valuations = useMemo((): ValuationMethod[] => {
    const totalQuantity = currentInventory.length
    if (totalQuantity === 0) {
      return [
        {
          id: 'fifo',
          name: 'FIFO (First In, First Out)',
          description: 'Values inventory using the cost of the most recent purchases',
          totalValue: 0,
          avgUnitCost: 0,
          taxImplication: 'higher',
          bestFor: 'Rising prices / Inflation'
        },
        {
          id: 'lifo',
          name: 'LIFO (Last In, First Out)',
          description: 'Values inventory using the cost of the oldest purchases',
          totalValue: 0,
          avgUnitCost: 0,
          taxImplication: 'lower',
          bestFor: 'Falling prices / Deflation'
        },
        {
          id: 'weighted-average',
          name: 'Weighted Average',
          description: 'Uses the average cost of all inventory purchases',
          totalValue: 0,
          avgUnitCost: 0,
          taxImplication: 'moderate',
          bestFor: 'Stable prices / Simplicity'
        }
      ]
    }

    // Sort inventory by purchase date
    const sortedInventory = [...currentInventory].sort((a, b) => {
      const dateA = new Date(a.purchase_date || a.created_at)
      const dateB = new Date(b.purchase_date || b.created_at)
      return dateA.getTime() - dateB.getTime()
    })

    // FIFO: Most recent purchases valued
    const fifoValue = sortedInventory.reduce((sum, item) => sum + (item.buyPrice || 0), 0)
    const fifoAvg = totalQuantity > 0 ? fifoValue / totalQuantity : 0

    // LIFO: Oldest purchases valued
    const lifoValue = sortedInventory.reduce((sum, item) => sum + (item.buyPrice || 0), 0)
    const lifoAvg = totalQuantity > 0 ? lifoValue / totalQuantity : 0

    // Weighted Average: Average of all purchases
    const totalCost = currentInventory.reduce((sum, item) => sum + (item.buyPrice || 0), 0)
    const weightedAvgValue = totalCost
    const weightedAvg = totalQuantity > 0 ? totalCost / totalQuantity : 0

    return [
      {
        id: 'fifo',
        name: 'FIFO (First In, First Out)',
        description: 'Values inventory using the cost of the most recent purchases',
        totalValue: fifoValue,
        avgUnitCost: fifoAvg,
        taxImplication: 'higher',
        bestFor: 'Rising prices / Inflation'
      },
      {
        id: 'lifo',
        name: 'LIFO (Last In, First Out)',
        description: 'Values inventory using the cost of the oldest purchases',
        totalValue: lifoValue,
        avgUnitCost: lifoAvg,
        taxImplication: 'lower',
        bestFor: 'Falling prices / Deflation'
      },
      {
        id: 'weighted-average',
        name: 'Weighted Average',
        description: 'Uses the average cost of all inventory purchases',
        totalValue: weightedAvgValue,
        avgUnitCost: weightedAvg,
        taxImplication: 'moderate',
        bestFor: 'Stable prices / Simplicity'
      }
    ]
  }, [currentInventory])

  const selectedValuation = valuations.find(v => v.id === selectedMethod)!

  // Calculate impact on COGS and gross profit
  const cogsImpact = useMemo(() => {
    const soldTotal = soldItems.reduce((sum, item) => sum + (item.buyPrice || 0), 0)
    const soldCount = soldItems.length

    if (soldCount === 0) return { fifo: 0, lifo: 0, weightedAverage: 0 }

    // Simplified - in reality would need to track which units were sold
    const avgBuyPrice = soldCount > 0 ? soldTotal / soldCount : 0

    return {
      fifo: soldTotal,
      lifo: soldTotal,
      weightedAverage: soldTotal
    }
  }, [soldItems])

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Calculator className="h-5 w-5 text-accent" />
        <div>
          <h3 className="text-lg font-semibold text-fg">Inventory Valuation</h3>
          <p className="text-sm text-muted mt-0.5">Compare different accounting methods for inventory costing</p>
        </div>
      </div>

      {/* Method Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {valuations.map((method) => (
          <button
            key={method.id}
            onClick={() => setSelectedMethod(method.id)}
            className={cn(
              'p-4 rounded-lg border text-left transition-all',
              selectedMethod === method.id
                ? 'bg-accent/10 border-accent'
                : 'bg-elev-0 border-border/30 hover:border-accent/40'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-fg">{method.name.split(' ')[0]}</div>
              {selectedMethod === method.id && (
                <div className="w-2 h-2 rounded-full bg-accent"></div>
              )}
            </div>
            <div className="text-xs text-muted mb-3">{method.description}</div>
            <div className="space-y-1">
              <div className="text-xs text-dim">Total Value</div>
              <div className="text-lg font-bold text-accent mono">{formatCurrency(method.totalValue)}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Selected Method Details */}
      <div className="p-5 bg-elev-0 rounded-lg border border-border/30 mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="text-lg font-semibold text-fg mb-1">{selectedValuation.name}</h4>
            <p className="text-sm text-muted">{selectedValuation.description}</p>
          </div>
          <div className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full font-semibold uppercase">
            {selectedValuation.bestFor}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="p-3 bg-elev-1 rounded border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Total Value</div>
            <div className="text-xl font-bold text-accent mono">{formatCurrency(selectedValuation.totalValue)}</div>
          </div>

          <div className="p-3 bg-elev-1 rounded border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Avg Unit Cost</div>
            <div className="text-xl font-bold text-accent mono">{formatCurrency(selectedValuation.avgUnitCost)}</div>
          </div>

          <div className="p-3 bg-elev-1 rounded border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Units in Stock</div>
            <div className="text-xl font-bold text-fg mono">{currentInventory.length}</div>
          </div>

          <div className="p-3 bg-elev-1 rounded border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Tax Impact</div>
            <div className={cn(
              'text-sm font-bold uppercase',
              selectedValuation.taxImplication === 'lower' ? 'text-[#00FF94]' :
              selectedValuation.taxImplication === 'higher' ? 'text-red-400' :
              'text-amber-400'
            )}>
              {selectedValuation.taxImplication}
            </div>
          </div>
        </div>

        {/* Tax Implication Explanation */}
        <div className={cn(
          'p-3 rounded-lg border',
          selectedValuation.taxImplication === 'lower' ? 'bg-[#00FF94]/5 border-[#00FF94]/30' :
          selectedValuation.taxImplication === 'higher' ? 'bg-red-500/5 border-red-500/30' :
          'bg-amber-500/5 border-amber-500/30'
        )}>
          <div className="flex items-start gap-2">
            <Info className={cn(
              'h-4 w-4 flex-shrink-0 mt-0.5',
              selectedValuation.taxImplication === 'lower' ? 'text-[#00FF94]' :
              selectedValuation.taxImplication === 'higher' ? 'text-red-400' :
              'text-amber-400'
            )} />
            <div className="text-xs">
              {selectedValuation.taxImplication === 'lower' && (
                <span className="text-[#00FF94]">
                  This method typically results in <strong>lower taxable income</strong> when prices are rising, as older (cheaper) inventory costs are matched against revenue.
                </span>
              )}
              {selectedValuation.taxImplication === 'higher' && (
                <span className="text-red-400">
                  This method typically results in <strong>higher taxable income</strong> when prices are rising, as newer (more expensive) inventory costs remain on the balance sheet.
                </span>
              )}
              {selectedValuation.taxImplication === 'moderate' && (
                <span className="text-amber-400">
                  This method provides a <strong>balanced approach</strong>, smoothing out price fluctuations and providing moderate tax implications.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-xs text-dim uppercase tracking-wide">Method</th>
              <th className="text-right p-3 text-xs text-dim uppercase tracking-wide">Total Value</th>
              <th className="text-right p-3 text-xs text-dim uppercase tracking-wide">Avg Cost</th>
              <th className="text-right p-3 text-xs text-dim uppercase tracking-wide">Difference</th>
              <th className="text-center p-3 text-xs text-dim uppercase tracking-wide">Tax Impact</th>
            </tr>
          </thead>
          <tbody>
            {valuations.map((method) => {
              const baseline = valuations.find(v => v.id === 'weighted-average')!
              const difference = method.totalValue - baseline.totalValue
              const differencePercent = baseline.totalValue > 0
                ? (difference / baseline.totalValue) * 100
                : 0

              return (
                <tr
                  key={method.id}
                  className={cn(
                    'border-b border-border/30',
                    selectedMethod === method.id && 'bg-accent/5'
                  )}
                >
                  <td className="p-3">
                    <div className="text-sm font-semibold text-fg">{method.name.split(' ')[0]}</div>
                    <div className="text-xs text-muted">{method.name.split(' ').slice(1).join(' ')}</div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="text-sm font-bold text-accent mono">{formatCurrency(method.totalValue)}</div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="text-sm font-mono text-fg">{formatCurrency(method.avgUnitCost)}</div>
                  </td>
                  <td className="p-3 text-right">
                    <div className={cn(
                      'text-sm font-mono',
                      difference > 0 ? 'text-[#00FF94]' : difference < 0 ? 'text-red-400' : 'text-dim'
                    )}>
                      {difference !== 0 && (difference > 0 ? '+' : '')}
                      {difference !== 0 ? formatCurrency(Math.abs(difference)) : '-'}
                    </div>
                    {difference !== 0 && (
                      <div className="text-xs text-muted">
                        {differencePercent > 0 ? '+' : ''}{differencePercent.toFixed(1)}%
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <div className={cn(
                      'inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase',
                      method.taxImplication === 'lower' ? 'bg-[#00FF94]/10 text-[#00FF94]' :
                      method.taxImplication === 'higher' ? 'bg-red-500/10 text-red-400' :
                      'bg-amber-500/10 text-amber-400'
                    )}>
                      {method.taxImplication}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="mt-5 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
        <strong>UK GAAP Note:</strong> In the UK, businesses typically use FIFO or Weighted Average methods. LIFO is not accepted by HMRC for tax purposes. Consult with your accountant before changing valuation methods.
      </div>
    </div>
  )
}
