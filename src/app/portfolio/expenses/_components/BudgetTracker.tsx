/**
 * Budget Tracker Component
 * Set and track budget limits by category
 */

'use client'

import { useState, useMemo } from 'react'
import { Target, TrendingUp, AlertTriangle, Edit2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type ExpenseCategory } from '@/lib/portfolio/types'
import { cn } from '@/lib/utils/cn'

interface Budget {
  category: ExpenseCategory
  limit: number
}

interface BudgetTrackerProps {
  expenses: Array<{ category: ExpenseCategory; amount: number; date: string }>
  currentMonth: string
  formatCurrency: (value: number) => string
  className?: string
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  shipping: 'Shipping',
  fees: 'Fees',
  ads: 'Advertising',
  supplies: 'Supplies',
  subscriptions: 'Subscriptions',
  misc: 'Miscellaneous',
}

export function BudgetTracker({ expenses, currentMonth, formatCurrency, className }: BudgetTrackerProps) {
  // Load budgets from localStorage
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('expense_budgets')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return []
        }
      }
    }
    return [
      { category: 'shipping', limit: 500 },
      { category: 'fees', limit: 300 },
      { category: 'ads', limit: 200 },
      { category: 'supplies', limit: 150 },
      { category: 'subscriptions', limit: 250 },
      { category: 'misc', limit: 100 },
    ]
  })

  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null)
  const [editValue, setEditValue] = useState('')

  // Calculate current month spending by category
  const currentSpending = useMemo(() => {
    const monthExpenses = expenses.filter((exp) => exp.date.startsWith(currentMonth))
    return monthExpenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount
      return acc
    }, {} as Record<ExpenseCategory, number>)
  }, [expenses, currentMonth])

  const handleEditBudget = (category: ExpenseCategory) => {
    const budget = budgets.find((b) => b.category === category)
    setEditingCategory(category)
    setEditValue(budget?.limit.toString() || '0')
  }

  const handleSaveBudget = () => {
    if (!editingCategory) return

    const newLimit = parseFloat(editValue)
    if (isNaN(newLimit) || newLimit < 0) return

    const updated = budgets.map((b) =>
      b.category === editingCategory ? { ...b, limit: newLimit } : b
    )

    // Add new budget if it doesn't exist
    if (!budgets.find((b) => b.category === editingCategory)) {
      updated.push({ category: editingCategory, limit: newLimit })
    }

    setBudgets(updated)
    localStorage.setItem('expense_budgets', JSON.stringify(updated))
    setEditingCategory(null)
    setEditValue('')
  }

  const handleCancelEdit = () => {
    setEditingCategory(null)
    setEditValue('')
  }

  const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0)
  const totalSpent = Object.values(currentSpending).reduce((sum, amount) => sum + amount, 0)
  const totalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Target className="h-5 w-5 text-accent" />
        <div>
          <h3 className="text-lg font-semibold text-fg">Budget Tracker</h3>
          <p className="text-sm text-muted mt-0.5">
            {new Date(currentMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="mb-5 p-5 bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl border border-accent/20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Total Monthly Budget</div>
            <div className="text-2xl font-bold text-fg font-mono">
              {formatCurrency(totalSpent)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Limit</div>
            <div className="text-lg font-semibold text-muted font-mono">
              {formatCurrency(totalBudget)}
            </div>
          </div>
        </div>
        <div className="h-3 bg-elev-0/50 rounded-full overflow-hidden shadow-inner">
          <div
            className={cn(
              'h-full transition-all duration-500 ease-out',
              totalPercentage >= 100
                ? 'bg-gradient-to-r from-red-500 to-red-600'
                : totalPercentage >= 80
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : 'bg-gradient-to-r from-accent to-accent/80'
            )}
            style={{ width: `${Math.min(totalPercentage, 100)}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-sm font-bold font-mono',
              totalPercentage >= 100 ? 'text-red-400' : totalPercentage >= 80 ? 'text-amber-400' : 'text-accent'
            )}>
              {totalPercentage.toFixed(1)}%
            </span>
            <span className="text-xs text-dim">of budget used</span>
          </div>
          {totalPercentage >= 100 && (
            <div className="flex items-center gap-1.5 text-xs text-red-400 font-semibold px-2 py-1 bg-red-500/10 rounded-full">
              <AlertTriangle className="h-3.5 w-3.5" />
              Over budget
            </div>
          )}
          {totalPercentage >= 80 && totalPercentage < 100 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold px-2 py-1 bg-amber-500/10 rounded-full">
              <AlertTriangle className="h-3.5 w-3.5" />
              Approaching limit
            </div>
          )}
        </div>
      </div>

      {/* Category Budgets */}
      <div className="space-y-3">
        <div className="text-xs text-dim uppercase tracking-wide mb-2">Category Budgets</div>
        {budgets.map((budget) => {
          const spent = currentSpending[budget.category] || 0
          const percentage = budget.limit > 0 ? (spent / budget.limit) * 100 : 0
          const isEditing = editingCategory === budget.category

          return (
            <div key={budget.category} className="p-3 bg-elev-0 rounded-lg border border-border/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-fg">
                  {CATEGORY_LABELS[budget.category]}
                </span>
                {!isEditing ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-dim">
                      {formatCurrency(spent)} / {formatCurrency(budget.limit)}
                    </span>
                    <button
                      onClick={() => handleEditBudget(budget.category)}
                      className="p-1 hover:bg-elev-1 rounded transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-dim" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-24 h-7 text-xs bg-bg border-border"
                      step="10"
                      min="0"
                    />
                    <button
                      onClick={handleSaveBudget}
                      className="p-1 hover:bg-elev-1 rounded transition-colors text-accent"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1 hover:bg-elev-1 rounded transition-colors text-dim"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="h-1.5 bg-elev-2 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all',
                    percentage >= 100 ? 'bg-red-500' : percentage >= 80 ? 'bg-amber-500' : 'bg-accent'
                  )}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-dim">{percentage.toFixed(1)}% used</span>
                {percentage >= 100 && (
                  <span className="text-xs text-red-400">Over budget</span>
                )}
                {percentage >= 80 && percentage < 100 && (
                  <span className="text-xs text-amber-400">Nearly at limit</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
        <strong>Tip:</strong> Click the edit icon to adjust budget limits. Budgets are saved locally to your browser.
      </div>
    </div>
  )
}
