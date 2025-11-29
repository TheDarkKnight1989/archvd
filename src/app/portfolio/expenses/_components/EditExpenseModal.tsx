/**
 * Edit Expense Modal Component
 * Modal dialog for editing existing expenses
 */

'use client'

import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type ExpenseCategory } from '@/lib/portfolio/types'
import { cn } from '@/lib/utils/cn'

interface EditExpenseModalProps {
  expense: {
    id: string
    category: ExpenseCategory
    amount: number
    date: string
    description: string
    vendor?: string
    linked_item_id?: string | null
    tags?: string[]
    is_tax_deductible?: boolean
    currency?: string
  }
  items: any[]
  onSave: (updatedExpense: any) => Promise<void>
  onClose: () => void
}

export function EditExpenseModal({ expense, items, onSave, onClose }: EditExpenseModalProps) {
  const [category, setCategory] = useState<ExpenseCategory>(expense.category)
  const [amount, setAmount] = useState(expense.amount.toString())
  const [date, setDate] = useState(expense.date)
  const [description, setDescription] = useState(expense.description)
  const [vendor, setVendor] = useState(expense.vendor || '')
  const [linkedItemId, setLinkedItemId] = useState(expense.linked_item_id || '')
  const [isTaxDeductible, setIsTaxDeductible] = useState(expense.is_tax_deductible || false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const parsedAmount = parseFloat(amount)
      if (parsedAmount <= 0) {
        throw new Error('Amount must be positive')
      }

      await onSave({
        id: expense.id,
        category,
        amount: parsedAmount,
        date,
        description,
        vendor: vendor || null,
        linked_item_id: linkedItemId || null,
        is_tax_deductible: isTaxDeductible,
      })

      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update expense')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-[#111111]/95 backdrop-blur-md border border-border/50 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-fg">Edit Expense</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-elev-2 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-dim" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-dim uppercase tracking-wide mb-2 block">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="bg-bg border-border"
            />
          </div>

          <div>
            <label className="text-xs text-dim uppercase tracking-wide mb-2 block">Vendor (Optional)</label>
            <Input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="bg-bg border-border"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-dim uppercase tracking-wide mb-2 block">Amount (£)</label>
              <Input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                step="0.01"
                min="0.01"
                className="bg-bg border-border num text-right"
              />
            </div>
            <div>
              <label className="text-xs text-dim uppercase tracking-wide mb-2 block">Category</label>
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
          </div>

          <div>
            <label className="text-xs text-dim uppercase tracking-wide mb-2 block">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="bg-bg border-border font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-dim uppercase tracking-wide mb-2 block">Linked Item (Optional)</label>
            <Select
              value={linkedItemId || '__none__'}
              onValueChange={(val) => setLinkedItemId(val === '__none__' ? '' : val)}
            >
              <SelectTrigger className="bg-bg border-border">
                <SelectValue placeholder="None" />
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
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="tax-deductible"
              checked={isTaxDeductible}
              onChange={(e) => setIsTaxDeductible(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-bg"
            />
            <label htmlFor="tax-deductible" className="text-sm text-fg cursor-pointer">
              Tax deductible
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 bg-accent text-black hover:bg-accent/90"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="border-border"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
