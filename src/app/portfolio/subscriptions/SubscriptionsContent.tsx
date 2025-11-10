'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { SubscriptionDialog } from './SubscriptionDialog'
import { SubscriptionCard } from './SubscriptionCard'

interface Subscription {
  id: string
  user_id: string
  name: string
  vendor: string | null
  amount: number
  currency: string
  interval: 'monthly' | 'annual'
  next_charge: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface SubscriptionsContentProps {
  initialSubscriptions: Subscription[]
  monthlyTotal: number
}

export function SubscriptionsContent({ initialSubscriptions, monthlyTotal }: SubscriptionsContentProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null)

  const handleAdd = () => {
    setEditingSubscription(null)
    setDialogOpen(true)
  }

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription)
    setDialogOpen(true)
  }

  const handleSuccess = () => {
    router.refresh()
    setDialogOpen(false)
    setEditingSubscription(null)
  }

  const activeSubscriptions = initialSubscriptions.filter((s) => s.is_active)
  const inactiveSubscriptions = initialSubscriptions.filter((s) => !s.is_active)

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-fg mb-2">Subscriptions</h1>
            <p className="text-muted">Track and manage your recurring expenses</p>
          </div>
          <Button onClick={handleAdd} className="bg-accent text-black hover:bg-accent-600 glow-accent-hover">
            <Plus className="h-4 w-4 mr-2" />
            Add Subscription
          </Button>
        </div>

        {/* Monthly Total KPI */}
        <div className="mt-6 bg-gradient-elev rounded-2xl border border-border p-6">
          <div className="text-xs uppercase tracking-wider text-dim mb-1">
            Total Monthly Cost
          </div>
          <div className="text-4xl font-bold font-mono text-fg">
            £{monthlyTotal.toFixed(2)}
          </div>
          <div className="text-sm text-muted mt-1">
            {activeSubscriptions.length} active subscription{activeSubscriptions.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Active Subscriptions */}
      {activeSubscriptions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-fg mb-4">Active</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {activeSubscriptions.map((subscription) => (
              <SubscriptionCard
                key={subscription.id}
                subscription={subscription}
                onEdit={() => handleEdit(subscription)}
                onSuccess={handleSuccess}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inactive Subscriptions */}
      {inactiveSubscriptions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-fg mb-4">Inactive</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {inactiveSubscriptions.map((subscription) => (
              <SubscriptionCard
                key={subscription.id}
                subscription={subscription}
                onEdit={() => handleEdit(subscription)}
                onSuccess={handleSuccess}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {initialSubscriptions.length === 0 && (
        <div className="text-center py-12 text-muted">
          <p className="mb-4">No subscriptions yet</p>
          <Button onClick={handleAdd} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Subscription
          </Button>
        </div>
      )}

      {/* Dialog */}
      <SubscriptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        subscription={editingSubscription}
        onSuccess={handleSuccess}
      />
    </>
  )
}
