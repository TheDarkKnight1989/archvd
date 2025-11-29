/**
 * Batch Operations Component
 * Bulk actions for sales, expenses, and data management
 */

'use client'

import { useState } from 'react'
import { Layers, CheckSquare, Trash2, Download, Edit, Tag, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

interface BatchOperation {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  action: () => void
}

interface BatchOperationsProps {
  selectedItems?: any[]
  onBulkDelete?: (ids: string[]) => Promise<void>
  onBulkUpdate?: (ids: string[], updates: any) => Promise<void>
  onBulkExport?: (ids: string[]) => void
  className?: string
}

export function BatchOperations({
  selectedItems = [],
  onBulkDelete,
  onBulkUpdate,
  onBulkExport,
  className
}: BatchOperationsProps) {
  const [processing, setProcessing] = useState(false)
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkEditValues, setBulkEditValues] = useState({
    category: '',
    tags: '',
    notes: ''
  })

  const operations: BatchOperation[] = [
    {
      id: 'export',
      name: 'Export Selected',
      description: `Export ${selectedItems.length} items to CSV`,
      icon: <Download className="h-5 w-5" />,
      action: async () => {
        if (onBulkExport) {
          onBulkExport(selectedItems.map(item => item.id))
        }
      }
    },
    {
      id: 'edit',
      name: 'Bulk Edit',
      description: `Edit ${selectedItems.length} items at once`,
      icon: <Edit className="h-5 w-5" />,
      action: async () => {
        setShowBulkEdit(true)
      }
    },
    {
      id: 'tag',
      name: 'Add Tags',
      description: `Add tags to ${selectedItems.length} items`,
      icon: <Tag className="h-5 w-5" />,
      action: async () => {
        // Would show tag selector
        console.log('Add tags to', selectedItems)
      }
    },
    {
      id: 'delete',
      name: 'Delete Selected',
      description: `Permanently delete ${selectedItems.length} items`,
      icon: <Trash2 className="h-5 w-5" />,
      action: async () => {
        if (onBulkDelete && confirm(`Are you sure you want to delete ${selectedItems.length} items? This cannot be undone.`)) {
          setProcessing(true)
          await onBulkDelete(selectedItems.map(item => item.id))
          setProcessing(false)
        }
      }
    }
  ]

  const handleOperation = async (operation: BatchOperation) => {
    setSelectedOperation(operation.id)
    setProcessing(true)
    try {
      await operation.action()
    } catch (error) {
      console.error('Batch operation failed:', error)
    } finally {
      setProcessing(false)
      setSelectedOperation(null)
    }
  }

  const handleBulkUpdate = async () => {
    if (onBulkUpdate) {
      setProcessing(true)
      try {
        await onBulkUpdate(
          selectedItems.map(item => item.id),
          bulkEditValues
        )
        setShowBulkEdit(false)
        setBulkEditValues({ category: '', tags: '', notes: '' })
      } catch (error) {
        console.error('Bulk update failed:', error)
      } finally {
        setProcessing(false)
      }
    }
  }

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Layers className="h-5 w-5 text-accent" />
        <div>
          <h3 className="text-lg font-semibold text-fg">Batch Operations</h3>
          <p className="text-sm text-muted mt-0.5">Perform actions on multiple items at once</p>
        </div>
      </div>

      {/* Selection Summary */}
      <div className="mb-5 p-4 bg-accent/5 border border-accent/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="h-5 w-5 text-accent" />
            <div>
              <div className="text-sm font-semibold text-fg">
                {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'} selected
              </div>
              <div className="text-xs text-muted mt-0.5">
                {selectedItems.length === 0
                  ? 'Select items to perform batch operations'
                  : 'Choose an operation below'
                }
              </div>
            </div>
          </div>
          {selectedItems.length > 0 && (
            <div className="text-xs text-dim">
              Ready for bulk actions
            </div>
          )}
        </div>
      </div>

      {/* Bulk Edit Panel */}
      {showBulkEdit && (
        <div className="mb-5 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="text-sm font-semibold text-blue-400 mb-3">
            Bulk Edit {selectedItems.length} Items
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-dim uppercase tracking-wide mb-1 block">
                Category
              </label>
              <select
                value={bulkEditValues.category}
                onChange={(e) => setBulkEditValues({ ...bulkEditValues, category: e.target.value })}
                className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg"
              >
                <option value="">Don't change</option>
                <option value="sneakers">Sneakers</option>
                <option value="apparel">Apparel</option>
                <option value="accessories">Accessories</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-dim uppercase tracking-wide mb-1 block">
                Add Tags (comma separated)
              </label>
              <input
                type="text"
                value={bulkEditValues.tags}
                onChange={(e) => setBulkEditValues({ ...bulkEditValues, tags: e.target.value })}
                placeholder="e.g., vintage, rare, limited-edition"
                className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg"
              />
            </div>

            <div>
              <label className="text-xs text-dim uppercase tracking-wide mb-1 block">
                Add Note
              </label>
              <textarea
                value={bulkEditValues.notes}
                onChange={(e) => setBulkEditValues({ ...bulkEditValues, notes: e.target.value })}
                placeholder="Add a note to all selected items"
                rows={3}
                className="w-full px-3 py-2 bg-elev-0 border border-border rounded text-sm text-fg resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleBulkUpdate}
                disabled={processing}
                size="sm"
                className="bg-blue-500 text-white hover:bg-blue-600"
              >
                {processing ? 'Updating...' : 'Apply Changes'}
              </Button>
              <Button
                onClick={() => {
                  setShowBulkEdit(false)
                  setBulkEditValues({ category: '', tags: '', notes: '' })
                }}
                size="sm"
                variant="outline"
                className="border-border/30"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Operation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {operations.map((operation) => {
          const isDestructive = operation.id === 'delete'
          const isDisabled = selectedItems.length === 0 || processing

          return (
            <button
              key={operation.id}
              onClick={() => handleOperation(operation)}
              disabled={isDisabled}
              className={cn(
                'p-4 rounded-lg border text-left transition-all',
                isDisabled
                  ? 'bg-elev-0 border-border/30 opacity-50 cursor-not-allowed'
                  : isDestructive
                  ? 'bg-red-500/5 border-red-500/30 hover:bg-red-500/10'
                  : 'bg-elev-0 border-border/30 hover:border-accent/40 hover:bg-accent/5',
                processing && selectedOperation === operation.id && 'opacity-75'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  isDestructive ? 'bg-red-500/10 text-red-400' : 'bg-accent/10 text-accent'
                )}>
                  {operation.icon}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-fg mb-1">
                    {operation.name}
                  </div>
                  <div className="text-xs text-muted">
                    {operation.description}
                  </div>
                  {processing && selectedOperation === operation.id && (
                    <div className="text-xs text-accent mt-2">Processing...</div>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="mt-5 p-4 bg-elev-0 rounded-lg border border-border/30">
        <div className="text-sm font-semibold text-fg mb-3">Quick Actions</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            disabled={selectedItems.length === 0}
            className={cn(
              'px-3 py-2 rounded text-xs font-medium transition-colors',
              selectedItems.length === 0
                ? 'bg-dim/10 text-dim cursor-not-allowed'
                : 'bg-accent/10 text-accent hover:bg-accent/20'
            )}
          >
            <Calendar className="h-3 w-3 inline mr-1" />
            Change Date
          </button>
          <button
            disabled={selectedItems.length === 0}
            className={cn(
              'px-3 py-2 rounded text-xs font-medium transition-colors',
              selectedItems.length === 0
                ? 'bg-dim/10 text-dim cursor-not-allowed'
                : 'bg-accent/10 text-accent hover:bg-accent/20'
            )}
          >
            <Tag className="h-3 w-3 inline mr-1" />
            Remove Tags
          </button>
          <button
            disabled={selectedItems.length === 0}
            className={cn(
              'px-3 py-2 rounded text-xs font-medium transition-colors',
              selectedItems.length === 0
                ? 'bg-dim/10 text-dim cursor-not-allowed'
                : 'bg-accent/10 text-accent hover:bg-accent/20'
            )}
          >
            <Download className="h-3 w-3 inline mr-1" />
            Download PDF
          </button>
          <button
            disabled={selectedItems.length === 0}
            className={cn(
              'px-3 py-2 rounded text-xs font-medium transition-colors',
              selectedItems.length === 0
                ? 'bg-dim/10 text-dim cursor-not-allowed'
                : 'bg-accent/10 text-accent hover:bg-accent/20'
            )}
          >
            <Edit className="h-3 w-3 inline mr-1" />
            Duplicate
          </button>
        </div>
      </div>

      {/* History */}
      <div className="mt-5 p-4 bg-elev-0 rounded-lg border border-border/30">
        <div className="text-sm font-semibold text-fg mb-3">Recent Batch Operations</div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-2 border-b border-border/30">
            <div>
              <span className="text-fg">Exported 15 items to CSV</span>
              <span className="text-dim ml-2">2 hours ago</span>
            </div>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/30">
            <div>
              <span className="text-fg">Updated category for 8 items</span>
              <span className="text-dim ml-2">1 day ago</span>
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-fg">Deleted 3 items</span>
              <span className="text-dim ml-2">3 days ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
        <strong>Warning:</strong> Batch operations cannot be undone. Always review your selection before performing destructive actions like delete.
      </div>
    </div>
  )
}
