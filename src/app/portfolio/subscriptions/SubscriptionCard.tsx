'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MoreVertical, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

interface Subscription {
  id: string
  name: string
  vendor: string | null
  amount: number
  currency: string
  interval: 'monthly' | 'annual'
  next_charge: string | null
  notes: string | null
  is_active: boolean
}

interface SubscriptionCardProps {
  subscription: Subscription
  onEdit: () => void
  onSuccess: () => void
}

export function SubscriptionCard({ subscription, onEdit, onSuccess }: SubscriptionCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const monthlyAmount =
    subscription.interval === 'monthly'
      ? subscription.amount
      : subscription.amount / 12

  const handleToggleActive = async () => {
    setIsToggling(true)
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ is_active: !subscription.is_active })
        .eq('id', subscription.id)

      if (error) throw error

      toast.success(
        subscription.is_active ? 'Subscription deactivated' : 'Subscription activated'
      )
      onSuccess()
    } catch (error: any) {
      console.error('[SubscriptionCard] Toggle error:', error)
      toast.error(error.message || 'Failed to update subscription')
    } finally {
      setIsToggling(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${subscription.name}"?`)) return

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('id', subscription.id)

      if (error) throw error

      toast.success('Subscription deleted')
      onSuccess()
    } catch (error: any) {
      console.error('[SubscriptionCard] Delete error:', error)
      toast.error(error.message || 'Failed to delete subscription')
    } finally {
      setIsDeleting(false)
    }
  }

  const formatNextCharge = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div
      className={cn(
        'bg-gradient-elev rounded-lg border border-border p-4 transition-all duration-120',
        !subscription.is_active && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-fg mb-0.5">{subscription.name}</h3>
          {subscription.vendor && (
            <p className="text-xs text-muted">{subscription.vendor}</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted hover:text-fg"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-elev-2 border-border">
            <DropdownMenuItem onClick={onEdit} className="text-fg hover:bg-elev-1">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleToggleActive}
              disabled={isToggling}
              className="text-fg hover:bg-elev-1"
            >
              {subscription.is_active ? (
                <>
                  <ToggleLeft className="h-4 w-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <ToggleRight className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-danger hover:bg-elev-1"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Amount */}
      <div className="mb-2">
        <div className="text-2xl font-bold font-mono text-fg">
          £{subscription.amount.toFixed(2)}
        </div>
        <div className="text-xs text-muted">
          {subscription.interval === 'annual' && (
            <span>£{monthlyAmount.toFixed(2)}/mo • </span>
          )}
          {subscription.interval}
        </div>
      </div>

      {/* Next Charge */}
      {subscription.next_charge && (
        <div className="text-xs text-muted mb-2">
          Next charge: {formatNextCharge(subscription.next_charge)}
        </div>
      )}

      {/* Notes */}
      {subscription.notes && (
        <div className="text-xs text-muted mt-2 pt-2 border-t border-border/40">
          {subscription.notes}
        </div>
      )}
    </div>
  )
}
