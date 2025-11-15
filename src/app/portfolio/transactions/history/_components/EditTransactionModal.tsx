'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import Image from 'next/image'
import type { TxRow } from '@/lib/transactions/types'

interface EditTransactionModalProps {
  transaction: TxRow
  onClose: () => void
  onSave: () => void
}

export function EditTransactionModal({ transaction, onClose, onSave }: EditTransactionModalProps) {
  const [qty, setQty] = useState(transaction.qty.toString())
  const [unitPrice, setUnitPrice] = useState(transaction.unit_price.toString())
  const [fees, setFees] = useState((transaction.fees || 0).toString())
  const [occurredAt, setOccurredAt] = useState(
    transaction.occurredAt.split('T')[0]
  )
  const [notes, setNotes] = useState(transaction.notes || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Calculate total
  const qtyNum = parseInt(qty) || 0
  const priceNum = parseFloat(unitPrice) || 0
  const feesNum = parseFloat(fees) || 0
  const total = qtyNum * priceNum

  const handleSave = async () => {
    if (!qty || !unitPrice || !occurredAt) {
      toast.error('Please fill in all required fields')
      return
    }

    if (qtyNum <= 0 || priceNum <= 0) {
      toast.error('Quantity and price must be greater than 0')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/transactions/item/${transaction.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qty: qtyNum,
          unit_price: priceNum,
          fees: feesNum,
          occurred_at: `${occurredAt}T00:00:00Z`,
          notes: notes || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update transaction')
      }

      toast.success('Transaction updated successfully')
      onSave()
    } catch (err: any) {
      console.error('[EditTransactionModal] Save error:', err)
      toast.error(err.message || 'Failed to update transaction')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/transactions/item/${transaction.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete transaction')
      }

      toast.success('Transaction deleted successfully')
      onSave()
    } catch (err: any) {
      console.error('[EditTransactionModal] Delete error:', err)
      toast.error(err.message || 'Failed to delete transaction')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="qty">Quantity *</Label>
              <Input
                id="qty"
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="bg-bg border-border text-fg"
              />
            </div>

            <div>
              <Label htmlFor="unitPrice">Unit Price * (GBP)</Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="bg-bg border-border text-fg"
              />
            </div>

            <div>
              <Label htmlFor="fees">Fees (GBP)</Label>
              <Input
                id="fees"
                type="number"
                step="0.01"
                min="0"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                className="bg-bg border-border text-fg"
              />
            </div>

            <div>
              <Label htmlFor="occurredAt">Date *</Label>
              <Input
                id="occurredAt"
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="bg-bg border-border text-fg"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="bg-bg border-border text-fg resize-none"
                placeholder="Add any notes about this transaction..."
              />
            </div>
          </div>

          {/* Right: Preview */}
          <div className="space-y-4">
            <div className="bg-elev-1 border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-muted mb-3">Transaction Preview</h3>

              {/* Product Image & Info */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative h-16 w-16 rounded-md overflow-hidden bg-elev-2 flex-shrink-0">
                  <Image
                    src={transaction.image_url || '/images/placeholders/product.svg'}
                    alt={transaction.title || 'Product'}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-fg truncate">
                    {transaction.title || 'Unknown Product'}
                  </div>
                  {transaction.sku && (
                    <div className="text-xs text-muted truncate">{transaction.sku}</div>
                  )}
                  {transaction.size_uk && (
                    <div className="text-xs text-muted">Size: UK{transaction.size_uk}</div>
                  )}
                </div>
              </div>

              {/* Calculated Values */}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Type:</span>
                  <span className="text-fg font-medium capitalize">{transaction.type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Quantity:</span>
                  <span className="text-fg font-mono">{qtyNum}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Unit Price:</span>
                  <span className="text-fg font-mono">£{priceNum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Fees:</span>
                  <span className="text-fg font-mono">£{feesNum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium border-t border-border pt-2 mt-2">
                  <span className="text-fg">Total:</span>
                  <span className="text-fg font-mono">£{total.toFixed(2)}</span>
                </div>
                {transaction.platform && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Platform:</span>
                    <span className="text-fg">{transaction.platform}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={isDeleting || isSubmitting}
            className="border-danger text-danger hover:bg-danger/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting || isDeleting}
              className="border-border text-fg hover:bg-elev-2"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSubmitting || isDeleting}
              className="bg-accent text-fg hover:bg-accent/90"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
