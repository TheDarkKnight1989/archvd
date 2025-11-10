'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import {
  Bookmark,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import { WatchlistTable } from './components/WatchlistTable'
import { WatchlistAlertsTable } from './components/WatchlistAlertsTable'
import { CreateWatchlistDialog } from './components/CreateWatchlistDialog'
import { RenameWatchlistDialog } from './components/RenameWatchlistDialog'
import { DeleteWatchlistDialog } from './components/DeleteWatchlistDialog'

type Watchlist = {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

export default function WatchlistsPage() {
  useRequireAuth()
  const router = useRouter()

  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [selectedWatchlist, setSelectedWatchlist] = useState<Watchlist | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'items' | 'alerts'>('items')

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [watchlistToEdit, setWatchlistToEdit] = useState<Watchlist | null>(null)
  const [watchlistToDelete, setWatchlistToDelete] = useState<Watchlist | null>(null)

  useEffect(() => {
    fetchWatchlists()
  }, [])

  const fetchWatchlists = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/watchlists')

      if (!response.ok) {
        throw new Error('Failed to fetch watchlists')
      }

      const data = await response.json()
      setWatchlists(data.watchlists || [])

      // Auto-select first watchlist if none selected
      if (!selectedWatchlist && data.watchlists?.length > 0) {
        setSelectedWatchlist(data.watchlists[0])
      }
    } catch (err: any) {
      console.error('[Watchlists] Fetch error:', err)
      setError(err.message || 'Failed to fetch watchlists')
      toast.error('Failed to load watchlists')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateWatchlist = async (name: string) => {
    try {
      const response = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create watchlist')
      }

      const data = await response.json()

      // Optimistic update
      setWatchlists((prev) => [data.watchlist, ...prev])
      setSelectedWatchlist(data.watchlist)

      toast.success(`Created watchlist "${name}"`)
      setCreateDialogOpen(false)
    } catch (err: any) {
      console.error('[Watchlists] Create error:', err)
      toast.error(err.message || 'Failed to create watchlist')
      throw err
    }
  }

  const handleRenameWatchlist = async (id: string, newName: string) => {
    try {
      const response = await fetch(`/api/watchlists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to rename watchlist')
      }

      const data = await response.json()

      // Optimistic update
      setWatchlists((prev) =>
        prev.map((w) => (w.id === id ? data.watchlist : w))
      )

      if (selectedWatchlist?.id === id) {
        setSelectedWatchlist(data.watchlist)
      }

      toast.success(`Renamed to "${newName}"`)
      setRenameDialogOpen(false)
      setWatchlistToEdit(null)
    } catch (err: any) {
      console.error('[Watchlists] Rename error:', err)
      toast.error(err.message || 'Failed to rename watchlist')
      throw err
    }
  }

  const handleDeleteWatchlist = async (id: string) => {
    try {
      const response = await fetch(`/api/watchlists/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete watchlist')
      }

      // Optimistic update
      setWatchlists((prev) => prev.filter((w) => w.id !== id))

      // If deleted watchlist was selected, select another
      if (selectedWatchlist?.id === id) {
        const remaining = watchlists.filter((w) => w.id !== id)
        setSelectedWatchlist(remaining.length > 0 ? remaining[0] : null)
      }

      toast.success('Watchlist deleted')
      setDeleteDialogOpen(false)
      setWatchlistToDelete(null)
    } catch (err: any) {
      console.error('[Watchlists] Delete error:', err)
      toast.error('Failed to delete watchlist')
      throw err
    }
  }

  const openRenameDialog = (watchlist: Watchlist) => {
    setWatchlistToEdit(watchlist)
    setRenameDialogOpen(true)
  }

  const openDeleteDialog = (watchlist: Watchlist) => {
    setWatchlistToDelete(watchlist)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="mx-auto max-w-[1600px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 text-fg">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg relative inline-block">
            Watchlists
            <span className="absolute bottom-0 left-0 w-16 h-0.5 bg-accent opacity-40"></span>
          </h1>
          <p className="text-sm text-dim mt-1">
            Track SKUs and get notified when prices meet your targets
          </p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          variant="default"
          className="bg-accent text-black hover:bg-accent-600 transition-boutique shadow-soft"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Watchlist
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="p-6 border-danger/50 bg-danger/10">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-danger" />
            <p className="text-danger font-medium">{error}</p>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      )}

      {/* Empty State */}
      {!loading && watchlists.length === 0 && (
        <Card elevation={1} className="p-12 text-center">
          <Bookmark className="h-12 w-12 mx-auto text-dim mb-4" />
          <p className="text-fg font-medium">No watchlists yet</p>
          <p className="text-sm text-dim mt-2 mb-4">
            Create your first watchlist to start tracking SKUs and price targets
          </p>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            variant="outline"
            className="border-accent/50 text-accent hover:bg-accent/10"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Watchlist
          </Button>
        </Card>
      )}

      {/* Watchlists Grid */}
      {!loading && watchlists.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar: Watchlist List */}
          <div className="lg:col-span-1 space-y-2">
            <p className="text-xs text-muted font-medium uppercase tracking-wide px-3 mb-2">
              Your Watchlists ({watchlists.length})
            </p>
            {watchlists.map((watchlist) => (
              <Card
                key={watchlist.id}
                elevation={selectedWatchlist?.id === watchlist.id ? 2 : 1}
                className={cn(
                  'p-4 cursor-pointer transition-boutique group',
                  selectedWatchlist?.id === watchlist.id
                    ? 'border-accent/50 bg-accent/5'
                    : 'hover:border-accent/30 hover:bg-elev-2'
                )}
                onClick={() => setSelectedWatchlist(watchlist)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Bookmark
                        className={cn(
                          'h-4 w-4 flex-shrink-0',
                          selectedWatchlist?.id === watchlist.id
                            ? 'text-accent fill-accent'
                            : 'text-muted'
                        )}
                      />
                      <p className="text-sm font-medium text-fg truncate">
                        {watchlist.name}
                      </p>
                    </div>
                    <p className="text-xs text-muted mt-1 pl-6">
                      Created{' '}
                      {new Date(watchlist.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                  {selectedWatchlist?.id === watchlist.id && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-elev-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          openRenameDialog(watchlist)
                        }}
                        aria-label="Rename watchlist"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-danger/10 hover:text-danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDeleteDialog(watchlist)
                        }}
                        aria-label="Delete watchlist"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Right Panel: Watchlist Items Table or Alerts */}
          <div className="lg:col-span-3">
            {selectedWatchlist ? (
              <Card elevation={1} className="overflow-hidden">
                {/* Tab Navigation */}
                <div className="flex border-b border-white/10">
                  <button
                    onClick={() => setActiveTab('items')}
                    className={cn(
                      'flex-1 px-4 py-3 text-sm font-medium transition-colors relative',
                      activeTab === 'items'
                        ? 'text-accent bg-accent/5'
                        : 'text-white/60 hover:text-white/80 hover:bg-white/5'
                    )}
                  >
                    <Bookmark className="inline-block w-4 h-4 mr-2 -mt-0.5" />
                    Items
                    {activeTab === 'items' && (
                      <span className="absolute bottom-0 left-0 w-full h-0.5 bg-accent" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('alerts')}
                    className={cn(
                      'flex-1 px-4 py-3 text-sm font-medium transition-colors relative',
                      activeTab === 'alerts'
                        ? 'text-accent bg-accent/5'
                        : 'text-white/60 hover:text-white/80 hover:bg-white/5'
                    )}
                  >
                    <AlertCircle className="inline-block w-4 h-4 mr-2 -mt-0.5" />
                    Alerts
                    {activeTab === 'alerts' && (
                      <span className="absolute bottom-0 left-0 w-full h-0.5 bg-accent" />
                    )}
                  </button>
                </div>

                {/* Tab Content */}
                <div className="p-4">
                  {activeTab === 'items' ? (
                    <WatchlistTable
                      watchlistId={selectedWatchlist.id}
                      watchlistName={selectedWatchlist.name}
                      onItemAdded={fetchWatchlists}
                    />
                  ) : (
                    <WatchlistAlertsTable currency="GBP" />
                  )}
                </div>
              </Card>
            ) : (
              <Card elevation={1} className="p-12 text-center">
                <ChevronRight className="h-12 w-12 mx-auto text-dim mb-4" />
                <p className="text-fg font-medium">Select a watchlist</p>
                <p className="text-sm text-dim mt-2">
                  Choose a watchlist from the left to view its items
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Create Watchlist Dialog */}
      <CreateWatchlistDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateWatchlist}
      />

      {/* Rename Watchlist Dialog */}
      <RenameWatchlistDialog
        open={renameDialogOpen}
        onOpenChange={(open) => {
          setRenameDialogOpen(open)
          if (!open) setWatchlistToEdit(null)
        }}
        watchlist={watchlistToEdit}
        onRename={handleRenameWatchlist}
      />

      {/* Delete Watchlist Dialog */}
      <DeleteWatchlistDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setWatchlistToDelete(null)
        }}
        watchlist={watchlistToDelete}
        onDelete={handleDeleteWatchlist}
      />
    </div>
  )
}
