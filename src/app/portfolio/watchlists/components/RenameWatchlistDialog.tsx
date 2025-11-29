'use client'

import { useState, useEffect } from 'react'
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

interface RenameWatchlistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  watchlist: { id: string; name: string } | null
  onRename: (id: string, newName: string) => Promise<void>
}

export function RenameWatchlistDialog({
  open,
  onOpenChange,
  watchlist,
  onRename,
}: RenameWatchlistDialogProps) {
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (watchlist) {
      setName(watchlist.name)
    }
  }, [watchlist])

  const handleRename = async () => {
    if (!watchlist) return

    // Validation
    if (!name.trim()) {
      setError('Watchlist name is required')
      return
    }

    if (name.length > 100) {
      setError('Watchlist name must be 100 characters or less')
      return
    }

    if (name.trim() === watchlist.name) {
      onOpenChange(false)
      return
    }

    setRenaming(true)
    setError('')

    try {
      await onRename(watchlist.id, name.trim())
    } catch (err: any) {
      setError(err.message || 'Failed to rename watchlist')
    } finally {
      setRenaming(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !renaming) {
      setError('')
    }
    onOpenChange(open)
  }

  if (!watchlist) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-elev-2/95 backdrop-blur-md shadow-xl">
        <DialogHeader>
          <DialogTitle>Rename Watchlist</DialogTitle>
          <DialogDescription>
            Enter a new name for "{watchlist.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rename-watchlist-name">New Name</Label>
            <Input
              id="rename-watchlist-name"
              placeholder="Enter new name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !renaming) {
                  handleRename()
                }
              }}
              disabled={renaming}
              className="bg-elev-1 border-border focus:ring-focus"
              maxLength={100}
              aria-label="New watchlist name"
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
            disabled={renaming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRename}
            disabled={renaming || !name.trim()}
            className="bg-accent text-black hover:bg-accent-600"
          >
            {renaming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Renaming...
              </>
            ) : (
              'Rename'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
