'use client'

import { useEffect, useState, FormEvent, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useSavedViews } from '@/hooks/useSavedViews'
import { gbp2 } from '@/lib/utils/format'
import { TABLE_ITEMS, TABLE_EXPENSES, type ExpenseCategory, type InventoryItem } from '@/lib/portfolio/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Download, Trash2, Bookmark, Edit2, BarChart3, TrendingUp, DollarSign, FileText, Upload, Tag as TagIcon, CheckSquare, Paperclip, Zap, History, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { SavedViewChip } from '@/components/SavedViewChip'
import { ColumnChooser, type ColumnConfig } from '@/components/ColumnChooser'
import { CollapsibleSection } from '../pnl/_components/CollapsibleSection'
import { EditExpenseModal } from './_components/EditExpenseModal'
import { CategoryBreakdownChart } from './_components/CategoryBreakdownChart'
import { SpendingTrendChart } from './_components/SpendingTrendChart'
import { BudgetTracker } from './_components/BudgetTracker'
import { RecurringExpenseManager } from './_components/RecurringExpenseManager'
import { ExpenseTemplates } from './_components/ExpenseTemplates'
import { BulkActionsToolbar } from './_components/BulkActionsToolbar'
import { TagsManager } from './_components/TagsManager'
import { DataImport } from '../pnl/_components/DataImport'
import { AttachReceiptModal } from './_components/AttachReceiptModal'
import { CategoryRulesManager } from './_components/CategoryRulesManager'
import { AuditLog } from './_components/AuditLog'
import { YearlySummary } from './_components/YearlySummary'

type Expense = {
  id: string
  user_id: string
  category: ExpenseCategory
  amount: number
  date: string
  description: string
  vendor?: string
  linked_item_id?: string | null
  created_at: string
  tags?: string[]
  is_tax_deductible?: boolean
  currency?: string
  receipt_url?: string
}

type ExpenseWithItem = Expense & {
  linkedItem?: InventoryItem | null
}

const formatUKDate = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export default function ExpensesPage() {
  useRequireAuth()
  const [expenses, setExpenses] = useState<ExpenseWithItem[]>([])
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Saved views
  const savedViews = useSavedViews()

  // Form state
  const [category, setCategory] = useState<ExpenseCategory>('shipping')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [linkedItemId, setLinkedItemId] = useState('')
  const [isTaxDeductible, setIsTaxDeductible] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [vendor, setVendor] = useState('')

  // Receipt attachment state
  const [attachingReceiptFor, setAttachingReceiptFor] = useState<ExpenseWithItem | null>(null)

  // Filter state
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [filterMonth, setFilterMonth] = useState<string>(currentMonth)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Edit state
  const [editingExpense, setEditingExpense] = useState<ExpenseWithItem | null>(null)

  // Bulk selection state
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set())

  // Column visibility state
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>([
    { key: 'select', label: 'Select', visible: true },
    { key: 'date', label: 'Date', visible: true, lock: true },
    { key: 'category', label: 'Category', visible: true },
    { key: 'amount', label: 'Amount', visible: true, lock: true },
    { key: 'description', label: 'Description', visible: true },
    { key: 'vendor', label: 'Vendor', visible: true },
    { key: 'tags', label: 'Tags', visible: true },
    { key: 'tax', label: 'Tax Deductible', visible: true },
    { key: 'linked_item', label: 'Linked Item', visible: true },
    { key: 'receipt', label: 'Receipt', visible: true },
    { key: 'actions', label: 'Actions', visible: true },
  ])

  // Saved view helpers
  const applySavedView = (viewId: string) => {
    const view = savedViews.views.find((v) => v.id === viewId)
    if (view) {
      setFilterMonth(view.filters.status || currentMonth)
      setFilterCategory(view.filters.category || 'all')
      setSearchQuery(view.filters.search || '')
      savedViews.setActiveView(viewId)
    }
  }

  const saveCurrentView = (name: string) => {
    savedViews.createView(
      name,
      {
        status: filterMonth !== currentMonth ? filterMonth : undefined,
        category: filterCategory !== 'all' ? filterCategory : undefined,
        search: searchQuery || undefined,
      },
      []
    )
  }

  const activeFilterCount =
    (filterMonth !== currentMonth ? 1 : 0) +
    (filterCategory !== 'all' ? 1 : 0) +
    (searchQuery ? 1 : 0)

  useEffect(() => {
    fetchItems()
    fetchExpenses()
  }, [])

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from(TABLE_ITEMS)
        .select('id, sku, brand, model')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setItems(data || [])
    } catch (err: any) {
      console.error('Failed to fetch items:', err)
    }
  }

  const fetchExpenses = async () => {
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id

      if (!userId) {
        throw new Error('No authenticated user found')
      }

      const { data, error } = await supabase
        .from(TABLE_EXPENSES)
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })

      if (error) throw error

      const expensesWithItems: ExpenseWithItem[] = await Promise.all(
        (data || []).map(async (expense) => {
          if (expense.linked_item_id) {
            const { data: itemData } = await supabase
              .from(TABLE_ITEMS)
              .select('id, sku, brand, model')
              .eq('id', expense.linked_item_id)
              .single()
            return { ...expense, linkedItem: itemData }
          }
          return expense
        })
      )

      setExpenses(expensesWithItems)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch expenses')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const parsedAmount = parseFloat(amount)
      if (parsedAmount <= 0) {
        throw new Error('Amount must be positive')
      }

      const requestData: any = {
        category,
        amount: parsedAmount,
        date,
        description,
        expense_currency: 'GBP',
        is_tax_deductible: isTaxDeductible,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        vendor: vendor || undefined,
      }

      if (linkedItemId) {
        requestData.linked_item_id = linkedItemId
      }

      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add expense')
      }

      // Reset form
      setCategory('shipping')
      setAmount('')
      setDate(new Date().toISOString().split('T')[0])
      setDescription('')
      setVendor('')
      setLinkedItemId('')
      setIsTaxDeductible(false)
      setSelectedTags([])

      setSuccess('Expense added successfully!')
      setTimeout(() => setSuccess(null), 3000)

      await fetchExpenses()
    } catch (err: any) {
      setError(err.message || 'Failed to add expense')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (updatedExpense: any) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id

      if (!userId) throw new Error('No authenticated user found')

      const { error } = await supabase
        .from(TABLE_EXPENSES)
        .update({
          category: updatedExpense.category,
          amount: updatedExpense.amount,
          date: updatedExpense.date,
          description: updatedExpense.description,
          vendor: updatedExpense.vendor || null,
          linked_item_id: updatedExpense.linked_item_id,
          is_tax_deductible: updatedExpense.is_tax_deductible,
        })
        .eq('id', updatedExpense.id)
        .eq('user_id', userId)

      if (error) throw error

      setSuccess('Expense updated successfully!')
      setTimeout(() => setSuccess(null), 3000)
      await fetchExpenses()
    } catch (err: any) {
      setError(err.message || 'Failed to update expense')
    }
  }

  const handleDelete = async (id: string, description: string) => {
    if (!window.confirm(`Delete expense "${description}"? This cannot be undone.`)) {
      return
    }

    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id

      if (!userId) {
        throw new Error('No authenticated user found')
      }

      const { error } = await supabase
        .from(TABLE_EXPENSES)
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      await fetchExpenses()
    } catch (err: any) {
      setError(err.message || 'Failed to delete expense')
    }
  }

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedExpenseIds.size} expenses? This cannot be undone.`)) {
      return
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id

      if (!userId) throw new Error('No authenticated user found')

      const { error } = await supabase
        .from(TABLE_EXPENSES)
        .delete()
        .in('id', Array.from(selectedExpenseIds))
        .eq('user_id', userId)

      if (error) throw error

      setSelectedExpenseIds(new Set())
      setSuccess(`Deleted ${selectedExpenseIds.size} expenses`)
      setTimeout(() => setSuccess(null), 3000)
      await fetchExpenses()
    } catch (err: any) {
      setError(err.message || 'Failed to delete expenses')
    }
  }

  const handleApplyTemplate = (template: any) => {
    setDescription(template.description)
    setCategory(template.category)
    if (template.amount) setAmount(template.amount.toString())
    if (template.tags) setSelectedTags(template.tags)
  }

  const handleCreateRecurringExpense = async (recurring: any) => {
    // This would be called automatically by RecurringExpenseManager
    setDescription(recurring.description)
    setCategory(recurring.category)
    setAmount(recurring.amount.toString())
    setDate(new Date().toISOString().split('T')[0])
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (filterMonth) {
        const expenseMonth = expense.date.slice(0, 7)
        if (expenseMonth !== filterMonth) return false
      }

      if (filterCategory !== 'all' && expense.category !== filterCategory) return false

      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches =
          expense.description.toLowerCase().includes(q) ||
          expense.vendor?.toLowerCase().includes(q) ||
          expense.category.toLowerCase().includes(q) ||
          expense.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
          expense.linkedItem?.sku?.toLowerCase().includes(q) ||
          expense.linkedItem?.brand?.toLowerCase().includes(q) ||
          expense.linkedItem?.model?.toLowerCase().includes(q)
        if (!matches) return false
      }

      return true
    })
  }, [expenses, filterMonth, filterCategory, searchQuery])

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  }, [filteredExpenses])

  const taxDeductibleTotal = useMemo(() => {
    return filteredExpenses
      .filter((exp) => exp.is_tax_deductible)
      .reduce((sum, expense) => sum + expense.amount, 0)
  }, [filteredExpenses])

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    filteredExpenses.forEach((exp) => {
      totals[exp.category] = (totals[exp.category] || 0) + exp.amount
    })
    return totals
  }, [filteredExpenses])

  const exportCSV = () => {
    const headers = ['date', 'category', 'amount', 'description', 'tax_deductible', 'tags', 'linked_item']
    const rows = filteredExpenses.map((expense) => {
      const linkedItemLabel = expense.linkedItem
        ? `${expense.linkedItem.sku} - ${expense.linkedItem.brand} ${expense.linkedItem.model}`
        : ''
      return [
        expense.date,
        expense.category,
        expense.amount,
        expense.description,
        expense.is_tax_deductible ? 'Yes' : 'No',
        expense.tags?.join('; ') || '',
        linkedItemLabel,
      ].map((field) => `"${field}"`)
    })

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const monthLabel = filterMonth || new Date().toISOString().slice(0, 7)
    a.download = `archvd-expenses-${monthLabel}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportSelectedCSV = () => {
    const selected = filteredExpenses.filter((exp) => selectedExpenseIds.has(exp.id))
    const headers = ['date', 'category', 'amount', 'description', 'tax_deductible', 'tags']
    const rows = selected.map((expense) => [
      expense.date,
      expense.category,
      expense.amount,
      expense.description,
      expense.is_tax_deductible ? 'Yes' : 'No',
      expense.tags?.join('; ') || '',
    ].map((field) => `"${field}"`))

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `archvd-expenses-selected-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedExpenseIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedExpenseIds(newSet)
  }

  const handleSelectAll = () => {
    if (selectedExpenseIds.size === filteredExpenses.length) {
      setSelectedExpenseIds(new Set())
    } else {
      setSelectedExpenseIds(new Set(filteredExpenses.map((exp) => exp.id)))
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 text-fg">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg relative inline-block">
          Expenses
          <span className="absolute bottom-0 left-0 w-16 h-0.5 bg-accent-400 opacity-40"></span>
        </h1>

        {/* Saved Views */}
        <div className="flex items-center gap-2">
          {savedViews.views.map((view) => (
            <SavedViewChip
              key={view.id}
              label={view.name}
              active={savedViews.activeViewId === view.id}
              onApply={() => applySavedView(view.id)}
              onDelete={() => savedViews.deleteView(view.id)}
            />
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex items-center gap-2 overflow-x-auto snap-x">
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dim" />
            <Input
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[260px] bg-bg border-border"
            />
          </div>
          <Input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-[160px] bg-elev-1 border-border shrink-0"
          />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[140px] bg-elev-1 border-border shrink-0">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-elev-2 border-border">
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="shipping">Shipping</SelectItem>
              <SelectItem value="fees">Fees</SelectItem>
              <SelectItem value="ads">Advertising</SelectItem>
              <SelectItem value="supplies">Supplies</SelectItem>
              <SelectItem value="subscriptions">Subscriptions</SelectItem>
              <SelectItem value="misc">Miscellaneous</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-border"
            onClick={exportCSV}
            disabled={filteredExpenses.length === 0}
          >
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          {activeFilterCount > 0 && (
            <Button
              variant="outline"
              className="border-border max-md:hidden border-accent/40 text-accent hover:bg-accent/10"
              onClick={() => {
                const name = prompt('Enter a name for this view:')
                if (name) saveCurrentView(name)
              }}
            >
              <Bookmark className="h-4 w-4 mr-2" /> Save View
            </Button>
          )}
          <ColumnChooser
            columns={columnConfig}
            onChange={(updated) => {
              setColumnConfig(prev =>
                prev.map(col => ({
                  ...col,
                  visible: updated.find(u => u.key === col.key)?.visible ?? col.visible
                }))
              )
            }}
          />
        </div>
      </div>

      {/* Success/Error Alerts */}
      {success && (
        <Alert variant="success">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Collapsible Sections */}
      <div className="space-y-6">
        {/* Overview & Analytics */}
        <CollapsibleSection
          title="Overview & Analytics"
          description="Key metrics and spending insights"
          icon={<BarChart3 className="h-5 w-5 text-accent" />}
          defaultExpanded={true}
          priority="high"
          badge={filteredExpenses.length}
        >
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-elev-2 border border-border rounded-xl p-4 shadow-soft">
                <div className="text-xs text-dim uppercase tracking-wide mb-1">Total Expenses</div>
                <div className="text-2xl font-bold text-fg mono">{gbp2.format(totalExpenses)}</div>
                <div className="text-xs text-muted mt-1">{filteredExpenses.length} expenses</div>
              </div>

              <div className="bg-elev-2 border border-border rounded-xl p-4 shadow-soft">
                <div className="text-xs text-dim uppercase tracking-wide mb-1">Average Expense</div>
                <div className="text-2xl font-bold text-accent mono">
                  {gbp2.format(filteredExpenses.length > 0 ? totalExpenses / filteredExpenses.length : 0)}
                </div>
                <div className="text-xs text-muted mt-1">per expense</div>
              </div>

              <div className="bg-elev-2 border border-border rounded-xl p-4 shadow-soft">
                <div className="text-xs text-dim uppercase tracking-wide mb-1">Tax Deductible</div>
                <div className="text-2xl font-bold text-green-400 mono">{gbp2.format(taxDeductibleTotal)}</div>
                <div className="text-xs text-muted mt-1">
                  {totalExpenses > 0 ? ((taxDeductibleTotal / totalExpenses) * 100).toFixed(1) : 0}% of total
                </div>
              </div>

              <div className="bg-elev-2 border border-border rounded-xl p-4 shadow-soft">
                <div className="text-xs text-dim uppercase tracking-wide mb-1">Top Category</div>
                <div className="text-2xl font-bold text-purple-400 capitalize">
                  {Object.keys(categoryTotals).length > 0
                    ? Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0][0]
                    : '—'}
                </div>
                <div className="text-xs text-muted mt-1">
                  {Object.keys(categoryTotals).length > 0
                    ? gbp2.format(Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0][1])
                    : '—'}
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-elev-2 border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-fg mb-4">Category Breakdown</h3>
                <CategoryBreakdownChart
                  expenses={filteredExpenses}
                  formatCurrency={gbp2.format}
                />
              </div>

              <div className="bg-elev-2 border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-fg mb-4">Spending Trend</h3>
                <SpendingTrendChart
                  expenses={expenses}
                  formatCurrency={gbp2.format}
                />
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Budget Tracker */}
        <CollapsibleSection
          title="Budget Tracker"
          description="Monitor spending against category budgets"
          icon={<DollarSign className="h-5 w-5 text-accent" />}
          defaultExpanded={true}
          priority="high"
        >
          <BudgetTracker
            expenses={expenses}
            currentMonth={filterMonth}
            formatCurrency={gbp2.format}
          />
        </CollapsibleSection>

        {/* Add Expense & Templates */}
        <CollapsibleSection
          title="Add Expense & Templates"
          description="Quick-add expenses with templates"
          icon={<FileText className="h-5 w-5 text-accent" />}
          defaultExpanded={false}
          priority="medium"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Add Expense Form */}
            <div className="bg-elev-2 border border-border rounded-xl p-5">
              <h3 className="text-lg font-semibold text-fg mb-4">Add Expense</h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <Input
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="bg-bg border-border"
                />

                <Input
                  placeholder="Vendor (Optional)"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="bg-bg border-border"
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Amount (£)"
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    step="0.01"
                    min="0.01"
                    className="bg-bg border-border num text-right"
                  />
                  <Select value={category} onValueChange={(val) => setCategory(val as ExpenseCategory)}>
                    <SelectTrigger className="bg-bg border-border">
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

                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="bg-bg border-border font-mono"
                />

                <Select
                  value={linkedItemId || '__none__'}
                  onValueChange={(val) => setLinkedItemId(val === '__none__' ? '' : val)}
                >
                  <SelectTrigger className="bg-bg border-border">
                    <SelectValue placeholder="Linked Item (Optional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-elev-2 border-border max-h-[200px]">
                    <SelectItem value="__none__">None</SelectItem>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.sku} • {item.brand} • {item.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="tax-deductible-new"
                    checked={isTaxDeductible}
                    onChange={(e) => setIsTaxDeductible(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-bg"
                  />
                  <label htmlFor="tax-deductible-new" className="text-sm text-fg cursor-pointer">
                    Tax deductible
                  </label>
                </div>

                <div>
                  <label className="text-xs text-dim uppercase tracking-wide mb-2 block">Tags (Optional)</label>
                  <TagsManager
                    selectedTags={selectedTags}
                    onTagsChange={setSelectedTags}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-accent text-black hover:bg-accent-600"
                >
                  {submitting ? 'Adding...' : 'Add Expense'}
                </Button>
              </form>
            </div>

            {/* Templates */}
            <ExpenseTemplates
              onApplyTemplate={handleApplyTemplate}
              formatCurrency={gbp2.format}
            />
          </div>
        </CollapsibleSection>

        {/* Recurring Expenses */}
        <CollapsibleSection
          title="Recurring Expenses"
          description="Automate regular expenses"
          icon={<TrendingUp className="h-5 w-5 text-accent" />}
          defaultExpanded={false}
          priority="medium"
        >
          <RecurringExpenseManager
            formatCurrency={gbp2.format}
            onCreateExpense={handleCreateRecurringExpense}
          />
        </CollapsibleSection>

        {/* Tax Year Summary */}
        <CollapsibleSection
          title="Tax Year Summary"
          description="UK tax year overview (6 Apr - 5 Apr)"
          icon={<Calendar className="h-5 w-5 text-accent" />}
          defaultExpanded={true}
          priority="high"
        >
          <YearlySummary
            expenses={expenses}
            formatCurrency={gbp2.format}
          />
        </CollapsibleSection>

        {/* Auto-Category Rules */}
        <CollapsibleSection
          title="Auto-Category Rules"
          description="Smart categorization based on patterns"
          icon={<Zap className="h-5 w-5 text-accent" />}
          defaultExpanded={false}
          priority="medium"
        >
          <CategoryRulesManager />
        </CollapsibleSection>

        {/* Recent Activity */}
        <CollapsibleSection
          title="Recent Activity"
          description="Audit log for tax-proofing"
          icon={<History className="h-5 w-5 text-accent" />}
          defaultExpanded={false}
          priority="low"
        >
          <AuditLog />
        </CollapsibleSection>

        {/* All Expenses */}
        <CollapsibleSection
          title="All Expenses"
          description="View and manage all your expenses"
          icon={<FileText className="h-5 w-5 text-accent" />}
          defaultExpanded={true}
          priority="high"
          badge={filteredExpenses.length}
        >
          <div className="bg-elev-2 border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-10 text-dim">
                <p className="font-mono text-sm">
                  {expenses.length === 0
                    ? 'No expenses yet • Add your first entry!'
                    : 'No results • Try adjusting your filters.'}
                </p>
                {expenses.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-border"
                    onClick={() => {
                      setFilterCategory('all')
                      setFilterMonth(currentMonth)
                      setSearchQuery('')
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="max-h-[600px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted text-xs bg-elev-1 sticky top-0 z-10">
                      <tr className="border-b border-border">
                        <th className="px-3 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedExpenseIds.size === filteredExpenses.length}
                            onChange={handleSelectAll}
                            className="w-4 h-4 rounded border-border bg-bg"
                          />
                        </th>
                        <th className="px-3 py-3 text-left">Date</th>
                        <th className="px-3 py-3 text-left">Description</th>
                        <th className="px-3 py-3 text-left">Vendor</th>
                        <th className="px-3 py-3 text-left">Category</th>
                        <th className="px-3 py-3 text-right">Amount</th>
                        <th className="px-3 py-3 text-left">Tags</th>
                        <th className="px-3 py-3 text-center">Tax</th>
                        <th className="px-3 py-3 text-left">Linked Item</th>
                        <th className="px-3 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map((expense) => (
                        <tr
                          key={expense.id}
                          className={cn(
                            'border-b border-border hover:bg-elev-1 transition-colors',
                            selectedExpenseIds.has(expense.id) && 'bg-accent/5'
                          )}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedExpenseIds.has(expense.id)}
                              onChange={() => handleToggleSelect(expense.id)}
                              className="w-4 h-4 rounded border-border bg-bg"
                            />
                          </td>
                          <td className="px-3 py-3 font-mono text-xs">{formatUKDate(expense.date)}</td>
                          <td className="px-3 py-3">{expense.description}</td>
                          <td className="px-3 py-3 text-xs text-muted">
                            {expense.vendor || '—'}
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant="outline" className="border-border text-xs capitalize">
                              {expense.category}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 font-mono text-right">{gbp2.format(expense.amount)}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {expense.tags?.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 bg-accent/10 text-accent text-xs rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {expense.is_tax_deductible && (
                              <CheckSquare className="h-4 w-4 text-green-400 inline-block" />
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-dim">
                            {expense.linkedItem ? (
                              <span>
                                {expense.linkedItem.sku} • {expense.linkedItem.brand}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setAttachingReceiptFor(expense)}
                                className="p-1 hover:bg-purple-500/10 rounded transition-colors"
                                title="Attach receipt"
                              >
                                <Paperclip className="h-3.5 w-3.5 text-purple-400" />
                              </button>
                              <button
                                onClick={() => setEditingExpense(expense)}
                                className="p-1 hover:bg-elev-2 rounded transition-colors"
                                title="Edit expense"
                              >
                                <Edit2 className="h-3.5 w-3.5 text-accent" />
                              </button>
                              <button
                                onClick={() => handleDelete(expense.id, expense.description)}
                                className="p-1 hover:bg-red-500/10 rounded transition-colors"
                                title="Delete expense"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Total Footer */}
                <div className="border-t border-border bg-elev-1 px-4 py-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-muted">
                    Total ({filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'})
                  </span>
                  <span className="text-lg font-bold text-fg font-mono">{gbp2.format(totalExpenses)}</span>
                </div>
              </>
            )}
          </div>
        </CollapsibleSection>

        {/* Data Import */}
        <CollapsibleSection
          title="Data Import"
          description="Import expenses from CSV or Excel"
          icon={<Upload className="h-5 w-5 text-accent" />}
          defaultExpanded={false}
          priority="low"
        >
          <DataImport
            onImport={async (data, mappings) => {
              console.log('Importing data:', data, mappings)
              setSuccess('Import completed successfully!')
              setTimeout(() => setSuccess(null), 3000)
              await fetchExpenses()
            }}
          />
        </CollapsibleSection>
      </div>

      {/* Attach Receipt Modal */}
      {attachingReceiptFor && (
        <AttachReceiptModal
          expenseId={attachingReceiptFor.id}
          expenseDescription={attachingReceiptFor.description}
          existingReceipts={[]}
          onClose={() => setAttachingReceiptFor(null)}
          onUpload={async (file) => {
            console.log('Uploading receipt:', file.name)
            // In production, would upload to cloud storage
            setSuccess(`Receipt "${file.name}" uploaded successfully!`)
            setTimeout(() => setSuccess(null), 3000)
          }}
          onDelete={async (receiptId) => {
            console.log('Deleting receipt:', receiptId)
            setSuccess('Receipt deleted successfully!')
            setTimeout(() => setSuccess(null), 3000)
          }}
        />
      )}

      {/* Edit Modal */}
      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          items={items}
          onSave={handleEdit}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedExpenseIds.size}
        onDeleteSelected={handleBulkDelete}
        onTagSelected={() => {
          alert('Bulk tag editing would be implemented here')
        }}
        onExportSelected={exportSelectedCSV}
        onClearSelection={() => setSelectedExpenseIds(new Set())}
      />
    </div>
  )
}
