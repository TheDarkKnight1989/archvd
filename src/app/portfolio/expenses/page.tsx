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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Download, Trash2, Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { SavedViewChip } from '@/components/SavedViewChip'
import { ColumnChooser, type ColumnConfig } from '@/components/ColumnChooser'

type Expense = {
  id: string
  user_id: string
  category: ExpenseCategory
  amount: number
  date: string
  description: string
  linked_item_id?: string | null
  created_at: string
}

type ExpenseWithItem = Expense & {
  linkedItem?: InventoryItem | null
}

// Column widths
const COLS = {
  DATE: 'w-[120px]',
  CATEGORY: 'w-[140px]',
  AMOUNT: 'w-[110px]',
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

  // Filter state
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [filterMonth, setFilterMonth] = useState<string>(currentMonth)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Column visibility state (Date and Amount locked)
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>([
    { key: 'date', label: 'Date', visible: true, lock: true },
    { key: 'category', label: 'Category', visible: true },
    { key: 'amount', label: 'Amount', visible: true, lock: true },
    { key: 'description', label: 'Description', visible: true },
    { key: 'linked_item', label: 'Linked Item', visible: true },
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
      [] // No sorting for expenses
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
        expense_currency: 'GBP', // Default to GBP, will be configurable later
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
      setLinkedItemId('')

      setSuccess('Expense added successfully!')
      setTimeout(() => setSuccess(null), 3000)

      await fetchExpenses()
    } catch (err: any) {
      setError(err.message || 'Failed to add expense')
    } finally {
      setSubmitting(false)
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

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      // Month filter
      if (filterMonth) {
        const expenseMonth = expense.date.slice(0, 7)
        if (expenseMonth !== filterMonth) return false
      }

      // Category filter
      if (filterCategory !== 'all' && expense.category !== filterCategory) return false

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches = expense.description.toLowerCase().includes(q)
        if (!matches) return false
      }

      return true
    })
  }, [expenses, filterMonth, filterCategory, searchQuery])

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  }, [filteredExpenses])

  const exportCSV = () => {
    const headers = ['date', 'category', 'amount', 'description', 'linked_item']
    const rows = filteredExpenses.map((expense) => {
      const linkedItemLabel = expense.linkedItem
        ? `${expense.linkedItem.sku} - ${expense.linkedItem.brand} ${expense.linkedItem.model}`
        : ''
      return [
        expense.date,
        expense.category,
        expense.amount,
        expense.description,
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

  return (
    <div className="mx-auto max-w-[1280px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 text-fg">
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
              placeholder="Search description"
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

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-3 md:gap-4">
        {/* Add Expense Card */}
        <Card elevation="soft" className="border border-border rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm text-muted font-normal">Add Expense</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <form onSubmit={handleSubmit} className="grid gap-3">
              <Input
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
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

              <Button type="submit" disabled={submitting} className="bg-accent text-black hover:bg-accent-600">
                {submitting ? 'Adding...' : 'Add Expense'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Table */}
        <Card elevation="soft" className="border border-border rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-10 text-dim">
              <p className="font-mono text-sm">
                {expenses.length === 0 ? 'No expenses yet • Add your first entry!' : 'No results • Try adjusting your filters.'}
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
              <div className="max-h-[70vh] overflow-auto">
                <Table className="min-w-[720px]">
                  <TableHeader className="text-muted text-xs bg-elev-2 sticky top-0 z-10">
                    <TableRow className="border-border border-t border-t-accent-400/25">
                      <TableHead className={cn('px-3 md:px-4 py-3', COLS.DATE)}>Date</TableHead>
                      <TableHead className="px-3 md:px-4 py-3">Description</TableHead>
                      <TableHead className={cn('px-3 md:px-4 py-3', COLS.CATEGORY)}>Category</TableHead>
                      <TableHead className={cn('px-3 md:px-4 py-3 text-right', COLS.AMOUNT)}>Amount</TableHead>
                      <TableHead className="px-3 md:px-4 py-3">Linked Item</TableHead>
                      <TableHead className="px-3 md:px-4 py-3 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id} className="border-border hover:bg-elev-2 h-12">
                        <TableCell className={cn('px-3 md:px-4 py-3 font-mono text-xs', COLS.DATE)}>
                          {formatUKDate(expense.date)}
                        </TableCell>
                        <TableCell className="px-3 md:px-4 py-3 text-sm">{expense.description}</TableCell>
                        <TableCell className={cn('px-3 md:px-4 py-3', COLS.CATEGORY)}>
                          <Badge variant="outline" className="border-border text-xs capitalize">
                            {expense.category}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn('px-3 md:px-4 py-3 font-mono text-sm text-right', COLS.AMOUNT)}>
                          {gbp2.format(expense.amount)}
                        </TableCell>
                        <TableCell className="px-3 md:px-4 py-3 text-xs text-dim">
                          {expense.linkedItem ? (
                            <span>
                              {expense.linkedItem.sku} • {expense.linkedItem.brand}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 md:px-4 py-3 text-center">
                          <button
                            onClick={() => handleDelete(expense.id, expense.description)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-danger hover:text-danger/80 font-medium"
                            title="Delete expense"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Total Footer */}
              <div className="border-t border-border bg-elev-2 px-4 py-3 flex justify-between items-center">
                <span className="text-sm font-medium text-muted">
                  Total ({filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'})
                </span>
                <span className="text-lg font-bold text-fg font-mono">{gbp2.format(totalExpenses)}</span>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
