/**
 * Attach Receipt Modal Component
 * Quick modal to attach receipts to existing expenses
 */

'use client'

import { useState } from 'react'
import { X, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReceiptUploader } from './ReceiptUploader'
import { cn } from '@/lib/utils/cn'

interface AttachReceiptModalProps {
  expenseId: string
  expenseDescription: string
  existingReceipts: any[]
  onClose: () => void
  onUpload: (file: File) => Promise<void>
  onDelete: (receiptId: string) => Promise<void>
}

export function AttachReceiptModal({
  expenseId,
  expenseDescription,
  existingReceipts,
  onClose,
  onUpload,
  onDelete,
}: AttachReceiptModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-[#111111]/95 backdrop-blur-md border border-border/50 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-fg">Attach Receipts</h2>
            <p className="text-sm text-muted mt-0.5">{expenseDescription}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-elev-2 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-dim" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          <ReceiptUploader
            expenseId={expenseId}
            receipts={existingReceipts}
            onUpload={onUpload}
            onDelete={onDelete}
          />
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex justify-end flex-shrink-0">
          <Button onClick={onClose} variant="outline" className="border-border">
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
