'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Button } from '@/components/ui/button'
import { Plus, Share2, Trash2, ExternalLink, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface SellList {
  id: string
  name: string
  share_token: string
  allow_comments: boolean
  show_market_prices: boolean
  allow_offers: boolean
  allow_asking_prices: boolean
  created_at: string
}

export default function SellListsPage() {
  const { user } = useRequireAuth()
  const router = useRouter()
  const [lists, setLists] = useState<SellList[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetchLists()
    }
  }, [user])

  const fetchLists = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/sell-lists')
      if (!res.ok) throw new Error('Failed to fetch sell lists')
      const data = await res.json()
      setLists(data.sellLists || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return

    setDeleting(id)
    try {
      const res = await fetch(`/api/sell-lists/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete sell list')
      await fetchLists()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setDeleting(null)
    }
  }

  const copyShareLink = (shareToken: string) => {
    const url = `${window.location.origin}/sell/${shareToken}`
    navigator.clipboard.writeText(url)
    // You could add a toast notification here
    alert('Share link copied to clipboard!')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-fg mb-2">Sell Lists</h1>
            <p className="text-muted">Create shareable lists of items to send to buyers</p>
          </div>
          <Button
            onClick={() => router.push('/portfolio/inventory')}
            className="bg-accent text-fg hover:bg-accent-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create from Inventory
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
            {error}
          </div>
        )}

        {/* Lists Grid */}
        {lists.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px] rounded-2xl border border-border bg-surface shadow-soft">
            <div className="text-center px-6 py-16 max-w-md">
              <div className="inline-block mb-6">
                <Share2 className="h-16 w-16 mx-auto text-muted" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-semibold text-fg mb-3">
                No sell lists yet
              </h3>
              <p className="text-sm text-muted mb-8 leading-relaxed">
                Create your first sell list from your inventory. Share a link with buyers to showcase items you want to sell.
              </p>
              <Button
                onClick={() => router.push('/portfolio/inventory')}
                className="bg-accent text-fg hover:bg-accent-600"
              >
                <Plus className="h-5 w-5 mr-2" />
                Go to Inventory
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lists.map((list) => (
              <div
                key={list.id}
                className="rounded-xl border border-border bg-surface p-6 shadow-soft hover:shadow-md transition-all duration-200"
              >
                {/* List Name */}
                <h3 className="text-lg font-semibold text-fg mb-4 truncate">
                  {list.name}
                </h3>

                {/* Settings Pills */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {list.allow_comments && (
                    <span className="px-2 py-1 text-xs rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Comments
                    </span>
                  )}
                  {list.show_market_prices && (
                    <span className="px-2 py-1 text-xs rounded-md bg-green-500/10 text-green-400 border border-green-500/20">
                      Market Prices
                    </span>
                  )}
                  {list.allow_offers && (
                    <span className="px-2 py-1 text-xs rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      Offers
                    </span>
                  )}
                  {list.allow_asking_prices && (
                    <span className="px-2 py-1 text-xs rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Asking Prices
                    </span>
                  )}
                </div>

                {/* Created Date */}
                <p className="text-xs text-muted mb-6">
                  Created {formatDistanceToNow(new Date(list.created_at), { addSuffix: true })}
                </p>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => router.push(`/sell-lists/${list.id}`)}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-border text-fg hover:bg-elev-3"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Manage
                  </Button>
                  <Button
                    onClick={() => copyShareLink(list.share_token)}
                    variant="outline"
                    size="sm"
                    className="border-border text-fg hover:bg-elev-3"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(list.id, list.name)}
                    disabled={deleting === list.id}
                    variant="outline"
                    size="sm"
                    className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                  >
                    {deleting === list.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
