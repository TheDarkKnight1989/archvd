/**
 * Category Rules Manager Component
 * Auto-categorization rules based on description/vendor patterns
 */

'use client'

import { useState, useEffect } from 'react'
import { Zap, Plus, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type ExpenseCategory } from '@/lib/portfolio/types'
import { cn } from '@/lib/utils/cn'

interface CategoryRule {
  id: string
  trigger: 'description' | 'vendor'
  pattern: string
  category: ExpenseCategory
  tags?: string[]
  enabled: boolean
}

interface CategoryRulesManagerProps {
  onApplyRules?: (expense: any) => { category?: ExpenseCategory; tags?: string[] }
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

export function CategoryRulesManager({ onApplyRules, className }: CategoryRulesManagerProps) {
  // Load rules from localStorage
  const [rules, setRules] = useState<CategoryRule[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('expense_category_rules')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return []
        }
      }
    }
    // Default rules
    return [
      { id: '1', trigger: 'description', pattern: 'royal mail', category: 'shipping', enabled: true },
      { id: '2', trigger: 'description', pattern: 'parcelforce', category: 'shipping', enabled: true },
      { id: '3', trigger: 'vendor', pattern: 'stockx', category: 'fees', tags: ['platform'], enabled: true },
      { id: '4', trigger: 'vendor', pattern: 'ebay', category: 'fees', tags: ['platform'], enabled: true },
      { id: '5', trigger: 'description', pattern: 'instagram', category: 'ads', tags: ['social'], enabled: true },
      { id: '6', trigger: 'description', pattern: 'facebook', category: 'ads', tags: ['social'], enabled: true },
    ]
  })

  const [isCreating, setIsCreating] = useState(false)
  const [newRule, setNewRule] = useState({
    trigger: 'description' as 'description' | 'vendor',
    pattern: '',
    category: 'misc' as ExpenseCategory,
  })

  // Save rules to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('expense_category_rules', JSON.stringify(rules))
    }
  }, [rules])

  const handleCreateRule = () => {
    if (!newRule.pattern) return

    const rule: CategoryRule = {
      id: Date.now().toString(),
      trigger: newRule.trigger,
      pattern: newRule.pattern.toLowerCase(),
      category: newRule.category,
      enabled: true,
    }

    setRules([...rules, rule])
    setNewRule({ trigger: 'description', pattern: '', category: 'misc' })
    setIsCreating(false)
  }

  const handleDeleteRule = (id: string) => {
    if (!window.confirm('Delete this rule?')) return
    setRules(rules.filter((r) => r.id !== id))
  }

  const handleToggleRule = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))
  }

  // Apply rules to an expense
  const applyRulesToExpense = (description: string, vendor?: string): { category?: ExpenseCategory; tags?: string[] } => {
    const desc = description.toLowerCase()
    const vend = vendor?.toLowerCase() || ''

    for (const rule of rules) {
      if (!rule.enabled) continue

      const matchText = rule.trigger === 'description' ? desc : vend
      if (matchText.includes(rule.pattern)) {
        return {
          category: rule.category,
          tags: rule.tags,
        }
      }
    }

    return {}
  }

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Auto-Category Rules</h3>
            <p className="text-sm text-muted mt-0.5">Smart categorization based on patterns</p>
          </div>
        </div>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          size="sm"
          className="bg-accent/20 text-fg hover:bg-accent/30"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="mb-5 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="text-sm font-semibold text-purple-400 mb-3">New Auto-Category Rule</div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select value={newRule.trigger} onValueChange={(val: any) => setNewRule({ ...newRule, trigger: val })}>
                <SelectTrigger className="bg-elev-0 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-elev-2 border-border">
                  <SelectItem value="description">Description contains</SelectItem>
                  <SelectItem value="vendor">Vendor contains</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="e.g., Royal Mail"
                value={newRule.pattern}
                onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                className="bg-elev-0 border-border"
              />
            </div>
            <Select value={newRule.category} onValueChange={(val: any) => setNewRule({ ...newRule, category: val })}>
              <SelectTrigger className="bg-elev-0 border-border">
                <SelectValue placeholder="Set category to..." />
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
            <div className="flex gap-2">
              <Button onClick={handleCreateRule} size="sm" className="bg-purple-500 text-white hover:bg-purple-600">
                Create Rule
              </Button>
              <Button onClick={() => setIsCreating(false)} size="sm" variant="outline" className="border-border">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-3">
        {rules.length === 0 && !isCreating && (
          <div className="text-center py-8 text-dim text-sm">
            No rules yet. Create rules to auto-categorize expenses.
          </div>
        )}
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={cn(
              'p-4 rounded-lg border transition-colors',
              rule.enabled ? 'bg-elev-0 border-border/30' : 'bg-elev-0/50 border-border/20 opacity-60'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-fg">
                    If <span className="font-semibold">{rule.trigger}</span> contains "
                    <span className="font-mono text-accent">{rule.pattern}</span>"
                  </span>
                </div>
                <div className="text-xs text-muted">
                  → Set category to <span className="font-semibold capitalize">{CATEGORY_LABELS[rule.category]}</span>
                  {rule.tags && rule.tags.length > 0 && (
                    <span> + tags: {rule.tags.join(', ')}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleRule(rule.id)}
                  className={cn(
                    'px-2 py-1 text-xs rounded transition-colors',
                    rule.enabled ? 'bg-accent/20 text-accent' : 'bg-elev-2 text-dim'
                  )}
                >
                  {rule.enabled ? 'Active' : 'Disabled'}
                </button>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="p-1 hover:bg-red-500/10 rounded transition-colors"
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>How it works:</strong> When you create a new expense, these rules automatically check the description and vendor fields. The first matching rule wins!
          </div>
        </div>
      </div>
    </div>
  )
}
