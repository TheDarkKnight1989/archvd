'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

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

interface SubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription: Subscription | null
  onSuccess: () => void
}

export function SubscriptionDialog({
  open,
  onOpenChange,
  subscription,
  onSuccess,
}: SubscriptionDialogProps) {
  const [name, setName] = useState('')
  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState('')
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')
  const [nextCharge, setNextCharge] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load subscription data when editing
  useEffect(() => {
    if (subscription) {
      setName(subscription.name)
      setVendor(subscription.vendor || '')
      setAmount(subscription.amount.toString())
      setInterval(subscription.interval)
      setNextCharge(subscription.next_charge?.split('T')[0] || '')
      setNotes(subscription.notes || '')
    } else {
      // Reset form for new subscription
      setName('')
      setVendor('')
      setAmount('')
      setInterval('monthly')
      setNextCharge('')
      setNotes('')
    }
  }, [subscription, open])

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Please enter a subscription name')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setIsSubmitting(true)

    try {
      const data = {
        name: name.trim(),
        vendor: vendor.trim() || null,
        amount: parseFloat(amount),
        currency: 'GBP',
        interval,
        next_charge: nextCharge || null,
        notes: notes.trim() || null,
        is_active: true,
        subscription_currency: 'GBP', // Default to GBP, will be configurable later
      }

      if (subscription) {
        // Update existing
        const response = await fetch(`/api/subscriptions/${subscription.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update subscription')
        }

        toast.success('Subscription updated')
      } else {
        // Create new
        const response = await fetch('/api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to add subscription')
        }

        toast.success('Subscription added')
      }

      onSuccess()
    } catch (error: any) {
      console.error('[SubscriptionDialog] Error:', error)
      toast.error(error.message || 'Failed to save subscription')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] w-full rounded-2xl border border-border bg-elev-2 shadow-soft p-6 md:p-7">
        <DialogHeader className="pb-4 border-b border-border/40">
          <DialogTitle className="text-xl font-bold text-fg">
            {subscription ? 'Edit Subscription' : 'Add Subscription'}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="name" className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
              Subscription Name <span className="text-accent">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Netflix, Spotify, Adobe"
              className="h-10 text-sm bg-elev-1 border-border text-fg rounded-lg px-3 focus:ring-focus transition-boutique"
              autoFocus
            />
          </div>

          {/* Vendor */}
          <div>
            <Label htmlFor="vendor" className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
              Vendor/Provider
            </Label>
            <Input
              id="vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Optional"
              className="h-10 text-sm bg-elev-1 border-border text-fg rounded-lg px-3 focus:ring-focus transition-boutique"
            />
          </div>

          {/* Amount & Interval */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount" className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
                Amount (£) <span className="text-accent">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-10 text-sm bg-elev-1 border-border text-fg rounded-lg px-3 num text-right tabular-nums focus:ring-focus transition-boutique"
              />
            </div>

            <div>
              <Label htmlFor="interval" className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
                Interval <span className="text-accent">*</span>
              </Label>
              <Select value={interval} onValueChange={(v: 'monthly' | 'annual') => setInterval(v)}>
                <SelectTrigger className="h-10 text-sm bg-elev-1 border-border text-fg rounded-lg px-3 focus:ring-focus transition-boutique">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-elev-1 border-border">
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Next Charge Date */}
          <div>
            <Label htmlFor="nextCharge" className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
              Next Charge Date
            </Label>
            <Input
              id="nextCharge"
              type="date"
              value={nextCharge}
              onChange={(e) => setNextCharge(e.target.value)}
              className="h-10 text-sm bg-elev-1 border-border text-fg rounded-lg px-3 font-mono focus:ring-focus transition-boutique"
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
              className="text-sm bg-elev-1 border-border text-fg rounded-lg px-3 py-2 resize-none focus:ring-focus transition-boutique"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="border-border"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim() || !amount || parseFloat(amount) <= 0}
            className="bg-accent text-black hover:bg-accent-600 shadow-soft"
          >
            {isSubmitting ? 'Saving...' : subscription ? 'Update' : 'Add'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
