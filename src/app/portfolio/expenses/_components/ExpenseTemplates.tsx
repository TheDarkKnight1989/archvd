/**
 * Expense Templates Component
 * Save and reuse common expense configurations
 */

'use client'

import { useState, useEffect } from 'react'
import { Star, Plus, Trash2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type ExpenseCategory } from '@/lib/portfolio/types'
import { cn } from '@/lib/utils/cn'

interface ExpenseTemplate {
  id: string
  name: string
  description: string
  category: ExpenseCategory
  amount?: number
  tags?: string[]
}

interface ExpenseTemplatesProps {
  onApplyTemplate: (template: Omit<ExpenseTemplate, 'id' | 'name'>) => void
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

export function ExpenseTemplates({ onApplyTemplate, formatCurrency, className }: ExpenseTemplatesProps) {
  // Load templates from localStorage
  const [templates, setTemplates] = useState<ExpenseTemplate[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('expense_templates')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return []
        }
      }
    }
    // Default templates
    return [
      {
        id: '1',
        name: 'StockX Shipping',
        description: 'Standard StockX shipping cost',
        category: 'shipping',
        amount: 12.5,
        tags: ['stockx'],
      },
      {
        id: '2',
        name: 'Platform Fees',
        description: 'Marketplace transaction fee',
        category: 'fees',
        amount: 15,
        tags: ['marketplace'],
      },
      {
        id: '3',
        name: 'Instagram Ads',
        description: 'Social media advertising',
        category: 'ads',
        amount: 50,
        tags: ['social', 'marketing'],
      },
      {
        id: '4',
        name: 'Packaging Supplies',
        description: 'Boxes, bubble wrap, tape',
        category: 'supplies',
        amount: 25,
        tags: ['packaging'],
      },
    ]
  })

  const [isCreating, setIsCreating] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: 'misc' as ExpenseCategory,
    amount: '',
  })

  // Save to localStorage whenever templates change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('expense_templates', JSON.stringify(templates))
    }
  }, [templates])

  const handleCreate = () => {
    if (!newTemplate.name || !newTemplate.description) return

    const template: ExpenseTemplate = {
      id: Date.now().toString(),
      name: newTemplate.name,
      description: newTemplate.description,
      category: newTemplate.category,
      amount: newTemplate.amount ? parseFloat(newTemplate.amount) : undefined,
    }

    setTemplates([...templates, template])
    setNewTemplate({ name: '', description: '', category: 'misc', amount: '' })
    setIsCreating(false)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this template?')) return
    setTemplates(templates.filter((t) => t.id !== id))
  }

  const handleApply = (template: ExpenseTemplate) => {
    onApplyTemplate({
      description: template.description,
      category: template.category,
      amount: template.amount,
      tags: template.tags,
    })
  }

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Expense Templates</h3>
            <p className="text-sm text-muted mt-0.5">Quick-add common expenses</p>
          </div>
        </div>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          size="sm"
          className="bg-accent/20 text-fg hover:bg-accent/30"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="mb-5 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="text-sm font-semibold text-purple-400 mb-3">New Template</div>
          <div className="space-y-3">
            <Input
              placeholder="Template name (e.g., Monthly Hosting)"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              className="bg-elev-0 border-border"
            />
            <Input
              placeholder="Description"
              value={newTemplate.description}
              onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
              className="bg-elev-0 border-border"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                placeholder="Default amount (optional)"
                value={newTemplate.amount}
                onChange={(e) => setNewTemplate({ ...newTemplate, amount: e.target.value })}
                step="0.01"
                className="bg-elev-0 border-border"
              />
              <select
                value={newTemplate.category}
                onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value as ExpenseCategory })}
                className="px-3 py-2 bg-elev-0 border border-border rounded-lg text-sm text-fg"
              >
                <option value="shipping">Shipping</option>
                <option value="fees">Fees</option>
                <option value="ads">Advertising</option>
                <option value="supplies">Supplies</option>
                <option value="subscriptions">Subscriptions</option>
                <option value="misc">Miscellaneous</option>
              </select>
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

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {templates.length === 0 && !isCreating && (
          <div className="col-span-2 text-center py-8 text-dim text-sm">
            No templates yet. Create your first template to get started.
          </div>
        )}
        {templates.map((template) => (
          <div
            key={template.id}
            className="p-4 bg-elev-0 rounded-lg border border-border/30 hover:border-accent/40 transition-colors group"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-fg">{template.name}</h4>
                  <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded capitalize">
                    {CATEGORY_LABELS[template.category]}
                  </span>
                </div>
                <p className="text-xs text-muted">{template.description}</p>
              </div>
              <button
                onClick={() => handleDelete(template.id)}
                className="p-1 hover:bg-elev-2 rounded transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-3">
              {template.amount !== undefined && (
                <span className="text-sm font-mono font-semibold text-accent">
                  {formatCurrency(template.amount)}
                </span>
              )}
              <Button
                onClick={() => handleApply(template)}
                size="sm"
                className="ml-auto bg-accent/20 text-fg hover:bg-accent/30"
              >
                <Zap className="h-3.5 w-3.5 mr-1" />
                Use Template
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
        <strong>Pro tip:</strong> Templates save time by pre-filling common expense details.
        Click "Use Template" to apply it to a new expense.
      </div>
    </div>
  )
}
