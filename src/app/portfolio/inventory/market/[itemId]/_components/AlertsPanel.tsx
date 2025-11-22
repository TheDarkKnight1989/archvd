'use client'

/**
 * AlertsPanel - Price alerts and notifications (Placeholder)
 *
 * Future features:
 * - Price drop alerts
 * - Listing expiration warnings
 * - Market volatility notifications
 * - Sales opportunity alerts
 */

import { Bell, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AlertsPanelProps {
  item: any
}

export function AlertsPanel({ item }: AlertsPanelProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Alerts</h3>
        <Bell className="h-5 w-5 text-muted" />
      </div>

      <div className="py-8 text-center">
        <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-soft/50 flex items-center justify-center">
          <Bell className="h-6 w-6 text-muted" />
        </div>
        <p className="text-muted text-sm mb-1">No alerts configured</p>
        <p className="text-muted text-xs mb-4">
          Set up price alerts and market notifications
        </p>
        <Button variant="outline" size="sm" className="gap-2" disabled>
          <Plus className="h-4 w-4" />
          Add Alert
        </Button>
      </div>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted italic">
          Coming soon: Price drop alerts, listing expiration warnings, and more
        </p>
      </div>
    </div>
  )
}
