'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Archive, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase/client'
import { TableBase, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/TableBase'
import useRequireAuth from '@/hooks/useRequireAuth'

interface IncompleteItem {
  id: string
  sku: string
  brand?: string
  model?: string
  image_url?: string
  status: string
  purchase_price?: number
  purchase_total?: number
  market_value?: number
  custom_market_value?: number
  category?: string
  reasons: string[]
}

export default function IncompleteItemsPage() {
  const { user, loading: authLoading } = useRequireAuth()
  const router = useRouter()
  const [items, setItems] = useState<IncompleteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  const fetchIncompleteItems = async () => {
    if (!user) return

    setLoading(true)

    // Fetch all inventory items (excluding sold and archived)
    const { data: allItems, error: itemsError } = await supabase
      .from('Inventory')
      .select('*')
      .in('status', ['active', 'listed', 'worn'])
      .eq('user_id', user.id)

    if (itemsError) {
      console.error('Failed to fetch items:', itemsError)
      setLoading(false)
      return
    }

    // Fetch market links
    const { data: marketLinks, error: linksError } = await supabase
      .from('inventory_market_links')
      .select('inventory_id, provider')

    if (linksError) {
      console.error('Failed to fetch market links:', linksError)
    }

    // Identify incomplete items
    const incomplete: IncompleteItem[] = []

    for (const item of allItems || []) {
      const reasons: string[] = []

      // Check for missing product info
      if (!item.brand || !item.model) {
        reasons.push('missing_product_info')
      }

      if (!item.image_url) {
        reasons.push('missing_image')
      }

      // Check listed items with no value
      if (item.status === 'listed') {
        const purchaseTotal = item.purchase_total || item.purchase_price || 0
        const hasMarketData = item.market_value || item.custom_market_value

        if (purchaseTotal === 0 && !hasMarketData) {
          reasons.push('listed_no_value')
        }
      }

      // Check for market link
      const hasMarketLink = marketLinks?.some(link => link.inventory_id === item.id)
      if (['sneaker', 'apparel', 'accessory'].includes(item.category?.toLowerCase()) && !hasMarketLink) {
        reasons.push('no_market_link')
      }

      if (reasons.length > 0) {
        incomplete.push({ ...item, reasons })
      }
    }

    setItems(incomplete)
    setLoading(false)
  }

  useEffect(() => {
    if (user) {
      fetchIncompleteItems()
    }
  }, [user])

  const handleArchiveAll = async () => {
    if (!confirm(`Archive ${items.length} incomplete items?`)) return

    setProcessing(true)

    const itemIds = items.map(item => item.id)
    const { error } = await supabase
      .from('Inventory')
      .update({ status: 'archived' })
      .in('id', itemIds)

    if (error) {
      alert('Failed to archive items: ' + error.message)
    } else {
      alert('Items archived successfully!')
      router.push('/portfolio/inventory')
    }

    setProcessing(false)
  }

  const handleArchiveItem = async (itemId: string) => {
    setProcessing(true)

    const { error } = await supabase
      .from('Inventory')
      .update({ status: 'archived' })
      .eq('id', itemId)

    if (error) {
      alert('Failed to archive item: ' + error.message)
    } else {
      setItems(items.filter(item => item.id !== itemId))
    }

    setProcessing(false)
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Permanently delete this item? This cannot be undone.')) return

    setProcessing(true)

    const { error } = await supabase
      .from('Inventory')
      .delete()
      .eq('id', itemId)

    if (error) {
      alert('Failed to delete item: ' + error.message)
    } else {
      setItems(items.filter(item => item.id !== itemId))
    }

    setProcessing(false)
  }

  const formatReasons = (reasons: string[]) => {
    const labels: Record<string, string> = {
      missing_product_info: 'Missing Brand/Model',
      missing_image: 'No Image',
      listed_no_value: 'Listed with No Value',
      no_market_link: 'No Market Link',
    }

    return reasons.map(r => labels[r] || r)
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-[1600px] px-3 md:px-6 lg:px-8 py-4 md:py-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-dim">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="mx-auto max-w-[1600px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-fg tracking-tight relative inline-block">
            Incomplete Items
            <span className="absolute bottom-0 left-0 w-16 h-px bg-accent/30"></span>
          </h1>
          <p className="text-sm text-dim mt-1">
            Items with missing product information or market data
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchIncompleteItems}
            disabled={loading || processing}
            className="bg-elev-2 border-border hover:bg-elev-3"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>

          {items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleArchiveAll}
              disabled={processing}
              className="bg-elev-2 border-border hover:bg-elev-3 hover:border-warning/40"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive All
            </Button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-lg border border-border bg-elev-1 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <div className="text-fg font-medium mb-1">Why are items marked as incomplete?</div>
          <div className="text-dim space-y-1">
            <div>• Missing brand, model, or product image</div>
            <div>• Listed items with no purchase total and no market data</div>
            <div>• Sneakers/apparel without market links for price tracking</div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-dim">Loading incomplete items...</div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center min-h-[400px] rounded-2xl border border-border bg-elev-1">
          <div className="text-center px-6 py-12">
            <div className="text-accent text-5xl mb-4">✓</div>
            <h3 className="text-xl font-semibold text-fg mb-2">All items are complete!</h3>
            <p className="text-sm text-dim">No incomplete items found in your inventory.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-elev-1 overflow-hidden">
          <TableBase>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Image</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead align="right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id} index={index}>
                  <TableCell>
                    <div className="text-sm font-mono text-fg">{item.sku}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-fg">
                      {item.brand || <span className="text-dim italic">Missing</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-fg">
                      {item.model || <span className="text-dim italic">Missing</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.sku}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-elev-2 flex items-center justify-center text-xs text-dim">
                        No Image
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {formatReasons(item.reasons).map((reason, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="text-xs bg-warning/10 text-warning border-warning/30"
                        >
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchiveItem(item.id)}
                        disabled={processing}
                        className="text-xs"
                      >
                        <Archive className="h-3.5 w-3.5 mr-1" />
                        Archive
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={processing}
                        className="text-xs text-error hover:text-error hover:bg-error/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableBase>
        </div>
      )}
    </div>
  )
}
