'use client'

/**
 * Rules Section
 *
 * Displays and manages auto-lower and match lowest ask rules
 */

import { Button } from '@/components/ui/button'
import { Plus, Settings2, TrendingDown, Target } from 'lucide-react'

export function RulesSection() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-fg">Listing Rules</h2>
          <p className="text-sm text-muted mt-1">
            Automate price adjustments and competitive positioning
          </p>
        </div>
        <Button size="sm" className="bg-[#00FF94] hover:bg-[#00E085] text-black font-medium gap-2">
          <Plus className="h-4 w-4" />
          Create Rule
        </Button>
      </div>

      {/* Rule Categories */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Auto-Lower Rules */}
        <div className="rounded-lg border border-border bg-soft/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-[#FFA500]/10 border border-[#FFA500]/30 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-[#FFA500]" />
            </div>
            <div>
              <h3 className="font-medium text-fg">Auto-Lower Rules</h3>
              <p className="text-xs text-muted">Automatically reduce prices over time</p>
            </div>
          </div>
          <div className="text-sm text-muted text-center py-8 border border-dashed border-border rounded-lg">
            No auto-lower rules configured
          </div>
        </div>

        {/* Match Lowest Ask Rules */}
        <div className="rounded-lg border border-border bg-soft/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-[#00FF94]/10 border border-[#00FF94]/30 flex items-center justify-center">
              <Target className="h-5 w-5 text-[#00FF94]" />
            </div>
            <div>
              <h3 className="font-medium text-fg">Match Lowest Ask Rules</h3>
              <p className="text-xs text-muted">Stay competitive with market pricing</p>
            </div>
          </div>
          <div className="text-sm text-muted text-center py-8 border border-dashed border-border rounded-lg">
            No match rules configured
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-border bg-elev-1 p-4">
        <div className="flex items-start gap-3">
          <Settings2 className="h-5 w-5 text-muted mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-fg mb-1">About Listing Rules</h4>
            <p className="text-xs text-muted leading-relaxed">
              Rules help you automate pricing strategies. Auto-lower rules gradually reduce your ask price over time
              to increase sell probability. Match rules keep your listings competitive by automatically adjusting to
              market conditions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
