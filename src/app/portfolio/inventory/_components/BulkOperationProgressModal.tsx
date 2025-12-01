/**
 * Bulk Operation Progress Modal
 * Shows real-time progress for bulk StockX operations
 */

'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'

export interface BulkOperationResult {
  total: number
  processed: number
  successful: number
  failed: number
  skipped: number
  inProgress: boolean
  errors: string[]
}

interface BulkOperationProgressModalProps {
  open: boolean
  onClose: () => void
  operation: 'pause' | 'activate' | 'reprice'
  result: BulkOperationResult
}

export function BulkOperationProgressModal({
  open,
  onClose,
  operation,
  result
}: BulkOperationProgressModalProps) {
  const operationLabels = {
    pause: 'Pausing',
    activate: 'Activating',
    reprice: 'Repricing'
  }

  const operationPastLabels = {
    pause: 'Paused',
    activate: 'Activated',
    reprice: 'Repriced'
  }

  return (
    <Dialog open={open} onOpenChange={result.inProgress ? undefined : onClose}>
      <DialogContent
        className="bg-elev-2/95 backdrop-blur-md shadow-xl max-w-md"
        onInteractOutside={(e) => {
          if (result.inProgress) {
            e.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {result.inProgress
              ? `${operationLabels[operation]} StockX Listings...`
              : `Bulk ${operationPastLabels[operation]} Complete`
            }
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Progress</span>
              <span className="font-mono text-fg">
                {result.processed} / {result.total}
              </span>
            </div>
            <div className="w-full bg-elev-1 rounded-full h-2 overflow-hidden">
              <div
                className="bg-accent h-full transition-all duration-300 ease-out"
                style={{ width: `${result.total > 0 ? (result.processed / result.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Results Summary */}
          <div className="bg-elev-1 border border-border/50 rounded-lg p-4 space-y-2">
            {result.successful > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-fg">
                  <span className="font-semibold">{result.successful}</span> successful
                </span>
              </div>
            )}

            {result.failed > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-fg">
                  <span className="font-semibold">{result.failed}</span> failed
                </span>
              </div>
            )}

            {result.skipped > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-yellow-400" />
                <span className="text-fg">
                  <span className="font-semibold">{result.skipped}</span> skipped (no StockX listing)
                </span>
              </div>
            )}

            {result.inProgress && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 text-accent animate-spin" />
                <span className="text-muted">Processing...</span>
              </div>
            )}
          </div>

          {/* Error Messages */}
          {result.errors.length > 0 && !result.inProgress && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-red-400">Errors:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {result.errors.slice(0, 5).map((error, i) => (
                  <p key={i} className="text-xs text-red-400/80">
                    • {error}
                  </p>
                ))}
                {result.errors.length > 5 && (
                  <p className="text-xs text-red-400/60 italic">
                    +{result.errors.length - 5} more errors
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Close Button */}
          {!result.inProgress && (
            <Button
              onClick={onClose}
              className="w-full"
            >
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
