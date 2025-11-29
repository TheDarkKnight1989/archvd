'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface SellList {
  id: string
  name: string
  created_at: string
}

interface AddToSellListModalProps {
  isOpen: boolean
  onClose: () => void
  inventoryItemIds: string[]
  onSuccess?: () => void
}

export function AddToSellListModal({
  isOpen,
  onClose,
  inventoryItemIds,
  onSuccess,
}: AddToSellListModalProps) {
  const [sellLists, setSellLists] = useState<SellList[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch sell lists when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSellLists()
      setShowCreateForm(false)
      setNewListName('')
      setError(null)
    }
  }, [isOpen])

  const fetchSellLists = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/sell-lists')
      if (!res.ok) throw new Error('Failed to fetch sell lists')
      const data = await res.json()
      setSellLists(data.sellLists || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      setError('List name is required')
      return
    }

    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/sell-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create sell list')
      }

      const data = await res.json()
      const newList = data.sellList

      // Add items to the newly created list
      await addItemsToList(newList.id)
    } catch (err: any) {
      setError(err.message)
      setCreating(false)
    }
  }

  const addItemsToList = async (sellListId: string) => {
    setAdding(true)
    setError(null)
    try {
      const res = await fetch(`/api/sell-lists/${sellListId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory_item_ids: inventoryItemIds }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add items to sell list')
      }

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAdding(false)
      setCreating(false)
    }
  }

  const handleClose = () => {
    if (!creating && !adding) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-elev-2/95 backdrop-blur-md shadow-xl border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-fg">
            Add to Sell List
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          ) : showCreateForm ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="list-name" className="text-fg mb-2">
                  List Name
                </Label>
                <Input
                  id="list-name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Summer Sale"
                  className="bg-elev-3 border-border text-fg"
                  disabled={creating}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateList()
                    }
                  }}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleCreateList}
                  disabled={creating || !newListName.trim()}
                  className="flex-1 bg-accent text-fg hover:bg-accent-600"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Create & Add Items
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewListName('')
                    setError(null)
                  }}
                  disabled={creating}
                  variant="outline"
                  className="border-border text-fg hover:bg-elev-3"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {sellLists.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">
                  No sell lists yet. Create your first one!
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {sellLists.map((list) => (
                    <button
                      key={list.id}
                      onClick={() => addItemsToList(list.id)}
                      disabled={adding}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-elev-3 hover:bg-elev-4 border border-border transition-all duration-120 text-left disabled:opacity-50"
                    >
                      <span className="text-fg font-medium">{list.name}</span>
                      {adding && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <Button
                onClick={() => setShowCreateForm(true)}
                className="w-full bg-accent text-fg hover:bg-accent-600"
                disabled={adding}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New List
              </Button>
            </div>
          )}

          {inventoryItemIds.length > 0 && (
            <p className="text-xs text-muted text-center">
              {inventoryItemIds.length} item{inventoryItemIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
