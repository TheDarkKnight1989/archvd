/**
 * Goal Tracker Component
 * Track monthly/quarterly revenue and profit goals
 */

'use client'

import { useState } from 'react'
import { Target, TrendingUp, AlertCircle, Edit2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

interface Goal {
  id: string
  type: 'revenue' | 'profit' | 'margin' | 'items'
  period: 'month' | 'quarter' | 'year'
  target: number
  current: number
  label: string
  unit: 'currency' | 'percentage' | 'count'
}

interface GoalTrackerProps {
  revenue: number
  profit: number
  itemsSold: number
  formatCurrency: (value: number) => string
  className?: string
}

export function GoalTracker({
  revenue,
  profit,
  itemsSold,
  formatCurrency,
  className
}: GoalTrackerProps) {
  // Default goals (in real app, these would be saved to DB)
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: '1',
      type: 'revenue',
      period: 'month',
      target: 5000,
      current: revenue,
      label: 'Monthly Revenue',
      unit: 'currency'
    },
    {
      id: '2',
      type: 'profit',
      period: 'month',
      target: 1500,
      current: profit,
      label: 'Monthly Profit',
      unit: 'currency'
    },
    {
      id: '3',
      type: 'items',
      period: 'month',
      target: 20,
      current: itemsSold,
      label: 'Items Sold',
      unit: 'count'
    }
  ])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<number>(0)

  const handleEdit = (goal: Goal) => {
    setEditingId(goal.id)
    setEditValue(goal.target)
  }

  const handleSave = (goalId: string) => {
    setGoals(prev => prev.map(g =>
      g.id === goalId ? { ...g, target: editValue } : g
    ))
    setEditingId(null)
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditValue(0)
  }

  const formatValue = (value: number, unit: Goal['unit']) => {
    if (unit === 'currency') return formatCurrency(value)
    if (unit === 'percentage') return value.toFixed(1) + '%'
    return value.toString()
  }

  const overallProgress = goals.reduce((sum, g) => {
    const progress = Math.min((g.current / g.target) * 100, 100)
    return sum + progress
  }, 0) / goals.length

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Goal Tracker</h3>
            <p className="text-sm text-muted mt-0.5">Monitor your targets</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Overall Progress</div>
          <div className={cn(
            'text-2xl font-bold mono',
            overallProgress >= 75 ? 'text-[#00FF94]' : overallProgress >= 50 ? 'text-amber-400' : 'text-red-400'
          )}>
            {overallProgress.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Goals List */}
      <div className="space-y-3">
        {goals.map((goal) => {
          const progress = Math.min((goal.current / goal.target) * 100, 100)
          const isOnTrack = progress >= 75
          const needsAttention = progress < 50
          const isEditing = editingId === goal.id

          return (
            <div
              key={goal.id}
              className={cn(
                'p-4 bg-elev-0 rounded-lg border transition-all',
                isOnTrack && 'border-[#00FF94]/20',
                needsAttention && 'border-red-400/20',
                !isOnTrack && !needsAttention && 'border-border/30'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-fg">{goal.label}</h4>
                    {isOnTrack && (
                      <div className="px-1.5 py-0.5 bg-[#00FF94]/10 text-[#00FF94] text-xs rounded font-semibold">
                        ON TRACK
                      </div>
                    )}
                    {needsAttention && (
                      <div className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-xs rounded font-semibold flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        NEEDS FOCUS
                      </div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-fg mono">
                      {formatValue(goal.current, goal.unit)}
                    </span>
                    <span className="text-sm text-dim">/</span>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(Number(e.target.value))}
                          className="w-24 px-2 py-1 bg-elev-1 border border-border rounded text-sm font-bold text-accent mono"
                          autoFocus
                        />
                        <Button
                          onClick={() => handleSave(goal.id)}
                          size="sm"
                          className="h-6 w-6 p-0 bg-[#00FF94] text-black hover:bg-[#00E085]"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={handleCancel}
                          size="sm"
                          variant="outline"
                          className="h-6 w-6 p-0 border-border/30"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-accent mono">
                          {formatValue(goal.target, goal.unit)}
                        </span>
                        <button
                          onClick={() => handleEdit(goal)}
                          className="text-dim hover:text-fg transition-colors"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    'text-2xl font-bold mono',
                    isOnTrack && 'text-[#00FF94]',
                    needsAttention && 'text-red-400',
                    !isOnTrack && !needsAttention && 'text-amber-400'
                  )}>
                    {progress.toFixed(0)}%
                  </div>
                  <div className="text-xs text-dim">
                    {formatValue(goal.target - goal.current, goal.unit)} to go
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 bg-elev-1 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-500',
                    isOnTrack && 'bg-[#00FF94]',
                    needsAttention && 'bg-red-400',
                    !isOnTrack && !needsAttention && 'bg-amber-400'
                  )}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>

              {/* Insights */}
              {goal.current > goal.target && (
                <div className="mt-2 text-xs text-[#00FF94] flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>Goal exceeded by {formatValue(goal.current - goal.target, goal.unit)}! 🎉</span>
                </div>
              )}
              {needsAttention && goal.current < goal.target * 0.25 && (
                <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  <span>Significantly behind target. Consider adjusting strategy.</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add Goal Placeholder */}
      <button
        className="mt-3 w-full p-3 border border-dashed border-border/50 rounded-lg text-sm text-dim hover:text-fg hover:border-border transition-colors"
      >
        + Add Custom Goal
      </button>
    </div>
  )
}
