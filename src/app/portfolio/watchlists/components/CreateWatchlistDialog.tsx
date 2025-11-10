'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface CreateWatchlistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string) => Promise<void>
}

export function CreateWatchlistDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateWatchlistDialogProps) {
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    // Validation
    if (!name.trim()) {
      setError('Watchlist name is required')
      return
    }

    if (name.length > 100) {
      setError('Watchlist name must be 100 characters or less')
      return
    }

    setCreating(true)
    setError('')

    try {
      await onCreate(name.trim())
      setName('')
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || 'Failed to create watchlist')
    } finally {
      setCreating(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !creating) {
      setName('')
      setError('')
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Watchlist</DialogTitle>
          <DialogDescription>
            Give your watchlist a name to organize your tracked SKUs
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="watchlist-name">Watchlist Name</Label>
            <Input
              id="watchlist-name"
              placeholder="e.g., Grails, Summer 2025, Jordan 1s"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creating) {
                  handleCreate()
                }
              }}
              disabled={creating}
              className="bg-elev-1 border-border focus:border-accent-400 focus:ring-accent-400/20"
              maxLength={100}
              aria-label="Watchlist name"
              autoFocus
            />
            {error && (
              <p className="text-sm text-danger">{error}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="bg-accent-400 text-black hover:bg-accent-500"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
