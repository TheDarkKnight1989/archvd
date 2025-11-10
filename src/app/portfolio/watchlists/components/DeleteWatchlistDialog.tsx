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
import { Loader2, AlertTriangle } from 'lucide-react'

interface DeleteWatchlistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  watchlist: { id: string; name: string } | null
  onDelete: (id: string) => Promise<void>
}

export function DeleteWatchlistDialog({
  open,
  onOpenChange,
  watchlist,
  onDelete,
}: DeleteWatchlistDialogProps) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!watchlist) return

    setDeleting(true)

    try {
      await onDelete(watchlist.id)
    } catch (err) {
      // Error handling is done in parent
    } finally {
      setDeleting(false)
    }
  }

  if (!watchlist) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/10">
              <AlertTriangle className="h-5 w-5 text-danger" />
            </div>
            <div>
              <DialogTitle>Delete Watchlist</DialogTitle>
              <DialogDescription className="mt-1">
                This action cannot be undone
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-fg">
            Are you sure you want to delete <span className="font-semibold">"{watchlist.name}"</span>?
          </p>
          <p className="text-sm text-muted mt-2">
            All items in this watchlist will also be removed.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
            className="bg-danger hover:bg-danger/90"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Watchlist'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
