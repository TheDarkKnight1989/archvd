/**
 * Recurring Expense Manager Component
 * Create and manage automated recurring expenses
 */

'use client'

import { useState, useEffect } from 'react'
import { Repeat, Plus, Trash2, Clock, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type ExpenseCategory } from '@/lib/portfolio/types'
import { cn } from '@/lib/utils/cn'

interface RecurringExpense {
  id: string
  description: string
  amount: number
  category: ExpenseCategory
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  dayOfMonth?: number
  nextDue: string
  enabled: boolean
}

interface RecurringExpenseManagerProps {
  formatCurrency: (value: number) => string
  onCreateExpense: (expense: Omit<RecurringExpense, 'id' | 'nextDue' | 'enabled'>) => void
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

const FREQUENCY_LABELS = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

export function RecurringExpenseManager({ formatCurrency, onCreateExpense, className }: RecurringExpenseManagerProps) {
  // Load recurring expenses from localStorage
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('recurring_expenses')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return []
        }
      }
    }
    return []
  })

  const [isCreating, setIsCreating] = useState(false)
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'misc' as ExpenseCategory,
    frequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    dayOfMonth: '1',
  })

  // Save to localStorage whenever recurringExpenses changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('recurring_expenses', JSON.stringify(recurringExpenses))
    }
  }, [recurringExpenses])

  // Check for due expenses on mount
  useEffect(() => {
    checkDueExpenses()
  }, [])

  const calculateNextDue = (frequency: string, dayOfMonth?: number): string => {
    const today = new Date()
    const nextDate = new Date(today)

    switch (frequency) {
      case 'weekly':
        nextDate.setDate(today.getDate() + 7)
        break
      case 'monthly':
        nextDate.setMonth(today.getMonth() + 1)
        if (dayOfMonth) {
          nextDate.setDate(dayOfMonth)
        }
        break
      case 'quarterly':
        nextDate.setMonth(today.getMonth() + 3)
        break
      case 'yearly':
        nextDate.setFullYear(today.getFullYear() + 1)
        break
    }

    return nextDate.toISOString().split('T')[0]
  }

  const handleCreate = () => {
    if (!newExpense.description || !newExpense.amount) return

    const recurring: RecurringExpense = {
      id: Date.now().toString(),
      description: newExpense.description,
      amount: parseFloat(newExpense.amount),
      category: newExpense.category,
      frequency: newExpense.frequency,
      dayOfMonth: parseInt(newExpense.dayOfMonth),
      nextDue: calculateNextDue(newExpense.frequency, parseInt(newExpense.dayOfMonth)),
      enabled: true,
    }

    setRecurringExpenses([...recurringExpenses, recurring])
    setNewExpense({
      description: '',
      amount: '',
      category: 'misc',
      frequency: 'monthly',
      dayOfMonth: '1',
    })
    setIsCreating(false)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this recurring expense?')) return
    setRecurringExpenses(recurringExpenses.filter((exp) => exp.id !== id))
  }

  const handleToggle = (id: string) => {
    setRecurringExpenses(
      recurringExpenses.map((exp) =>
        exp.id === id ? { ...exp, enabled: !exp.enabled } : exp
      )
    )
  }

  const checkDueExpenses = () => {
    const today = new Date().toISOString().split('T')[0]
    recurringExpenses.forEach((recurring) => {
      if (recurring.enabled && recurring.nextDue <= today) {
        // Auto-create the expense
        onCreateExpense({
          description: recurring.description,
          amount: recurring.amount,
          category: recurring.category,
        })

        // Update next due date
        const updated = recurringExpenses.map((exp) =>
          exp.id === recurring.id
            ? { ...exp, nextDue: calculateNextDue(exp.frequency, exp.dayOfMonth) }
            : exp
        )
        setRecurringExpenses(updated)
      }
    })
  }

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Repeat className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Recurring Expenses</h3>
            <p className="text-sm text-muted mt-0.5">Automate regular costs</p>
          </div>
        </div>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          size="sm"
          className="bg-accent/20 text-fg hover:bg-accent/30"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Recurring
        </Button>
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="mb-5 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="text-sm font-semibold text-purple-400 mb-3">New Recurring Expense</div>
          <div className="space-y-3">
            <Input
              placeholder="Description (e.g., Monthly hosting)"
              value={newExpense.description}
              onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
              className="bg-elev-0 border-border"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                placeholder="Amount"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                step="0.01"
                min="0.01"
                className="bg-elev-0 border-border"
              />
              <Select
                value={newExpense.category}
                onValueChange={(val) => setNewExpense({ ...newExpense, category: val as ExpenseCategory })}
              >
                <SelectTrigger className="bg-elev-0 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-elev-2 border-border">
                  <SelectItem value="shipping">Shipping</SelectItem>
                  <SelectItem value="fees">Fees</SelectItem>
                  <SelectItem value="ads">Advertising</SelectItem>
                  <SelectItem value="supplies">Supplies</SelectItem>
                  <SelectItem value="subscriptions">Subscriptions</SelectItem>
                  <SelectItem value="misc">Miscellaneous</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={newExpense.frequency}
                onValueChange={(val: any) => setNewExpense({ ...newExpense, frequency: val })}
              >
                <SelectTrigger className="bg-elev-0 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-elev-2 border-border">
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              {newExpense.frequency === 'monthly' && (
                <Input
                  type="number"
                  placeholder="Day of month"
                  value={newExpense.dayOfMonth}
                  onChange={(e) => setNewExpense({ ...newExpense, dayOfMonth: e.target.value })}
                  min="1"
                  max="31"
                  className="bg-elev-0 border-border"
                />
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} size="sm" className="bg-purple-500 text-white hover:bg-purple-600">
                Create
              </Button>
              <Button onClick={() => setIsCreating(false)} size="sm" variant="outline" className="border-border">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Recurring Expenses List */}
      <div className="space-y-3">
        {recurringExpenses.length === 0 && !isCreating && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-elev-2 flex items-center justify-center mb-3">
              <Repeat className="h-8 w-8 text-dim" />
            </div>
            <p className="text-fg font-medium mb-1">No recurring expenses</p>
            <p className="text-sm text-muted mb-4">Automate monthly bills and subscriptions</p>
            <Button
              onClick={() => setIsCreating(true)}
              size="sm"
              className="bg-accent/20 text-fg hover:bg-accent/30"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create your first
            </Button>
          </div>
        )}
        {recurringExpenses.map((recurring) => (
          <div key={recurring.id} className="p-4 bg-elev-0 rounded-lg border border-border/30">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-fg">{recurring.description}</span>
                  <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded capitalize">
                    {CATEGORY_LABELS[recurring.category]}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <div className="flex items-center gap-1">
                    <Repeat className="h-3 w-3" />
                    {FREQUENCY_LABELS[recurring.frequency]}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Next: {new Date(recurring.nextDue).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-accent font-mono">
                  {formatCurrency(recurring.amount)}
                </span>
                <button
                  onClick={() => handleToggle(recurring.id)}
                  className={cn(
                    'px-2 py-1 text-xs rounded transition-colors',
                    recurring.enabled
                      ? 'bg-accent/20 text-accent'
                      : 'bg-elev-2 text-dim'
                  )}
                >
                  {recurring.enabled ? 'Active' : 'Paused'}
                </button>
                <button
                  onClick={() => handleDelete(recurring.id)}
                  className="p-1 hover:bg-elev-2 rounded transition-colors text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
        <strong>How it works:</strong> Recurring expenses are automatically created on their due date.
        You can pause or delete them at any time.
      </div>
    </div>
  )
}
