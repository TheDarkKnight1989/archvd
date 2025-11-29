'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useCurrency } from '@/hooks/useCurrency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft, Share2, Trash2, Loader2, Save,
  X, Copy, CheckCircle, MessageCircle, DollarSign
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface SellListItem {
  id: string
  asking_price: number | null
  position: number
  inventory_item: {
    id: string
    sku: string | null
    brand: string | null
    model: string | null
    colorway: string | null
    size: string | null
    size_uk: number | null
    category: string
    condition: string | null
  }
}

interface SellListDetail {
  id: string
  name: string
  share_token: string
  allow_comments: boolean
  show_market_prices: boolean
  allow_offers: boolean
  allow_asking_prices: boolean
  created_at: string
  updated_at: string
  items: SellListItem[]
  interactions_count: number
}

export default function SellListDetailPage() {
  const { user } = useRequireAuth()
  const router = useRouter()
  const params = useParams()
  const { format } = useCurrency()

  const listId = params?.id as string

  const [list, setList] = useState<SellListDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Editable state
  const [name, setName] = useState('')
  const [settings, setSettings] = useState({
    allow_comments: false,
    show_market_prices: false,
    allow_offers: false,
    allow_asking_prices: false,
  })
  const [askingPrices, setAskingPrices] = useState<Record<string, string>>({})
  const [editingPrice, setEditingPrice] = useState<string | null>(null)

  useEffect(() => {
    if (user && listId) {
      fetchList()
    }
  }, [user, listId])

  const fetchList = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/sell-lists/${listId}/detail`)
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/sell-lists')
          return
        }
        throw new Error('Failed to fetch sell list')
      }
      const data = await res.json()
      const sellList = data.sellList
      setList(sellList)
      setName(sellList.name)
      setSettings({
        allow_comments: sellList.allow_comments,
        show_market_prices: sellList.show_market_prices,
        allow_offers: sellList.allow_offers,
        allow_asking_prices: sellList.allow_asking_prices,
      })

      // Initialize asking prices
      const prices: Record<string, string> = {}
      sellList.items.forEach((item: SellListItem) => {
        if (item.asking_price !== null) {
          prices[item.id] = item.asking_price.toString()
        }
      })
      setAskingPrices(prices)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/sell-lists/${listId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...settings }),
      })
      if (!res.ok) throw new Error('Failed to update sell list')
      await fetchList()
      alert('Settings saved!')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateAskingPrice = async (itemId: string) => {
    const priceStr = askingPrices[itemId]
    const price = priceStr ? parseFloat(priceStr) : null

    try {
      const res = await fetch(`/api/sell-lists/${listId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asking_price: price }),
      })
      if (!res.ok) throw new Error('Failed to update asking price')
      setEditingPrice(null)
      await fetchList()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleRemoveItem = async (itemId: string, itemName: string) => {
    if (!confirm(`Remove "${itemName}" from this list?`)) return

    try {
      const res = await fetch(`/api/sell-lists/${listId}/items/${itemId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to remove item')
      await fetchList()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const copyShareLink = () => {
    if (!list) return
    const url = `${window.location.origin}/sell/${list.share_token}`
    navigator.clipboard.writeText(url)
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

  if (!list) {
    return null
  }

  const getItemTitle = (item: SellListItem['inventory_item']) => {
    return [item.brand, item.model, item.colorway].filter(Boolean).join(' ') || item.sku || 'Untitled Item'
  }

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.push('/sell-lists')}
              variant="outline"
              size="sm"
              className="border-border text-fg hover:bg-elev-3"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-fg">{list.name}</h1>
              <p className="text-sm text-muted mt-1">
                {list.items.length} item{list.items.length !== 1 ? 's' : ''} •
                Created {formatDistanceToNow(new Date(list.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <Button
            onClick={copyShareLink}
            className="bg-accent text-fg hover:bg-accent-600"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Copy Share Link
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Panel */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-border bg-surface p-6 shadow-soft sticky top-6">
              <h2 className="text-lg font-semibold text-fg mb-4">Settings</h2>

              <div className="space-y-4">
                {/* List Name */}
                <div>
                  <Label htmlFor="list-name" className="text-fg mb-2">
                    List Name
                  </Label>
                  <Input
                    id="list-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-elev-3 border-border text-fg"
                  />
                </div>

                {/* Settings Toggles */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allow-comments" className="text-fg cursor-pointer">
                      Allow Comments
                    </Label>
                    <Switch
                      id="allow-comments"
                      checked={settings.allow_comments}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, allow_comments: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-market" className="text-fg cursor-pointer">
                      Show Market Prices
                    </Label>
                    <Switch
                      id="show-market"
                      checked={settings.show_market_prices}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, show_market_prices: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="allow-offers" className="text-fg cursor-pointer">
                      Allow Offers
                    </Label>
                    <Switch
                      id="allow-offers"
                      checked={settings.allow_offers}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, allow_offers: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="allow-asking" className="text-fg cursor-pointer">
                      Allow Asking Prices
                    </Label>
                    <Switch
                      id="allow-asking"
                      checked={settings.allow_asking_prices}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, allow_asking_prices: checked })
                      }
                    />
                  </div>
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="w-full bg-accent text-fg hover:bg-accent-600 mt-6"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>

                {/* Stats */}
                {list.interactions_count > 0 && (
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <MessageCircle className="h-4 w-4" />
                      {list.interactions_count} interaction{list.interactions_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items List */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-surface shadow-soft overflow-hidden">
              <div className="p-6 border-b border-border">
                <h2 className="text-lg font-semibold text-fg">Items</h2>
              </div>

              {list.items.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-muted mb-4">No items in this list yet</p>
                  <Button
                    onClick={() => router.push('/portfolio/inventory')}
                    variant="outline"
                    className="border-border text-fg hover:bg-elev-3"
                  >
                    Add from Inventory
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {list.items.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-elev-2/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-fg truncate">
                            {getItemTitle(item.inventory_item)}
                          </h3>
                          <div className="flex gap-3 mt-1 text-sm text-muted">
                            {item.inventory_item.sku && (
                              <span>SKU: {item.inventory_item.sku}</span>
                            )}
                            {item.inventory_item.size_uk && (
                              <span>UK {item.inventory_item.size_uk}</span>
                            )}
                            {item.inventory_item.condition && (
                              <span className="capitalize">{item.inventory_item.condition}</span>
                            )}
                          </div>

                          {/* Asking Price */}
                          {settings.allow_asking_prices && (
                            <div className="mt-3">
                              {editingPrice === item.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={askingPrices[item.id] || ''}
                                    onChange={(e) =>
                                      setAskingPrices({ ...askingPrices, [item.id]: e.target.value })
                                    }
                                    placeholder="Price"
                                    className="w-32 h-8 bg-elev-3 border-border text-fg text-sm"
                                  />
                                  <Button
                                    onClick={() => handleUpdateAskingPrice(item.id)}
                                    size="sm"
                                    className="h-8 bg-green-500 text-white hover:bg-green-600"
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    onClick={() => setEditingPrice(null)}
                                    size="sm"
                                    variant="outline"
                                    className="h-8 border-border text-fg hover:bg-elev-3"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingPrice(item.id)}
                                  className="flex items-center gap-2 text-sm text-fg hover:text-accent transition-colors"
                                >
                                  <DollarSign className="h-4 w-4" />
                                  {item.asking_price
                                    ? `Asking: ${format(item.asking_price)}`
                                    : 'Set asking price'
                                  }
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={() => handleRemoveItem(item.id, getItemTitle(item.inventory_item))}
                          size="sm"
                          variant="outline"
                          className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
