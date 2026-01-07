'use client'

/**
 * Style Catalog Admin Page
 * WHY: Manage universal product catalog and provider mappings
 */

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ExternalLink, Check, X, Search, Plus, RefreshCw, AlertCircle, Clock, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'

interface StyleCatalogRow {
  style_id: string
  brand: string
  name: string
  colorway: string | null
  gender: string | null
  product_category: string | null
  stockx_product_id: string | null
  stockx_url_key: string | null
  alias_catalog_id: string | null
  created_at: string
  updated_at: string
}

interface FailedSyncJob {
  style_id: string
  provider: 'alias' | 'stockx'
  last_error: string | null
  completed_at: string
  attempts: number
}

interface Stats {
  total: number
  withStockX: number
  withAlias: number
  withBoth: number
}

type FilterMode = 'all' | 'needsAlias' | 'hasAlias' | 'hasBoth' | 'failed'

// Helper: Filter products by search query and filter mode
function filterProducts(
  products: StyleCatalogRow[],
  query: string,
  filterMode: FilterMode
): StyleCatalogRow[] {
  // Apply filter mode first - use stockx_url_key (what we set) not stockx_product_id (legacy)
  let filtered = products

  switch (filterMode) {
    case 'needsAlias':
      filtered = products.filter(p => p.stockx_url_key && !p.alias_catalog_id)
      break
    case 'hasAlias':
      filtered = products.filter(p => p.alias_catalog_id)
      break
    case 'hasBoth':
      filtered = products.filter(p => p.stockx_url_key && p.alias_catalog_id)
      break
    case 'all':
    default:
      filtered = products
  }

  // Then apply search query
  if (!query.trim()) {
    return filtered
  }

  const lowerQuery = query.toLowerCase()
  return filtered.filter(
    p =>
      p.style_id.toLowerCase().includes(lowerQuery) ||
      p.brand?.toLowerCase().includes(lowerQuery) ||
      p.name?.toLowerCase().includes(lowerQuery) ||
      p.colorway?.toLowerCase().includes(lowerQuery)
  )
}

export default function StyleCatalogAdminPage() {
  const [products, setProducts] = useState<StyleCatalogRow[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, withStockX: 0, withAlias: 0, withBoth: 0 })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Failed sync jobs (for retry functionality)
  const [failedJobs, setFailedJobs] = useState<FailedSyncJob[]>([])
  const [retryingJob, setRetryingJob] = useState<{ styleId: string; provider: string } | null>(null)

  // Add Style form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [addFormSaving, setAddFormSaving] = useState(false)
  const [newStyle, setNewStyle] = useState({
    style_id: '',
    stockx_url_key: '',
    alias_catalog_id: '',
  })

  // Debounce ref for realtime updates
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync Controls state
  // Use sessionStorage to persist sync state across page refreshes
  const [syncRunning, setSyncRunning] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('admin_sync_running')
      return stored === 'true'
    }
    return false
  })
  const [lastSync, setLastSync] = useState<{ timestamp: string; stats: string } | null>(null)
  const [syncProgress, setSyncProgress] = useState<{
    total: number
    completed: number
    success: number
    failed: number
    currentSku: string | null
    percent: number
  } | null>(null)

  // Derived filtered products (useMemo instead of state to avoid drift)
  const filteredProducts = useMemo(() => {
    // First apply basic filters
    let result = filterProducts(products, searchQuery, filterMode === 'failed' ? 'all' : filterMode)

    // Then apply failed filter if selected (needs access to failedJobs)
    if (filterMode === 'failed') {
      const failedStyleIds = new Set(failedJobs.map(j => j.style_id))
      result = result.filter(p => failedStyleIds.has(p.style_id))
    }

    return result
  }, [products, searchQuery, filterMode, failedJobs])

  const loadData = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('inventory_v4_style_catalog')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to load catalog:', error)
      setLoading(false)
      return
    }

    if (data) {
      const rows = data as StyleCatalogRow[]
      setProducts(rows)
      // filteredProducts is derived via useMemo - no need to set it

      // Calculate stats - use stockx_url_key (what we set) not stockx_product_id (legacy)
      const total = rows.length
      const withStockX = rows.filter(p => p.stockx_url_key).length
      const withAlias = rows.filter(p => p.alias_catalog_id).length
      const withBoth = rows.filter(p => p.stockx_url_key && p.alias_catalog_id).length

      setStats({ total, withStockX, withAlias, withBoth })
    }

    setLoading(false)
  }

  // Load failed sync jobs (within last 7 days, max retries exhausted)
  const loadFailedJobs = async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('inventory_v4_sync_queue')
      .select('style_id, provider, last_error, completed_at, attempts')
      .eq('status', 'failed')
      .gte('completed_at', sevenDaysAgo)
      .or('max_attempts.eq.0,attempts.gte.max_attempts')
      .order('completed_at', { ascending: false })

    if (!error && data) {
      setFailedJobs(data as FailedSyncJob[])
    }
  }

  // Retry a failed sync job (reset to pending)
  const handleRetryJob = async (styleId: string, provider: 'alias' | 'stockx') => {
    setRetryingJob({ styleId, provider })

    try {
      // Update failed job to pending, reset attempts
      const { error } = await supabase
        .from('inventory_v4_sync_queue')
        .update({
          status: 'pending',
          attempts: 0,
          max_attempts: 3,
          last_error: null,
          next_retry_at: new Date().toISOString(),
          completed_at: null
        })
        .eq('style_id', styleId)
        .eq('provider', provider)
        .eq('status', 'failed')

      if (error) {
        // If no failed job exists, insert a new pending job
        const { error: insertError } = await supabase
          .from('inventory_v4_sync_queue')
          .insert({
            style_id: styleId,
            provider,
            status: 'pending'
          })

        if (insertError) {
          // Likely unique constraint - job already pending/processing
          toast.info(`${provider} sync already queued for ${styleId}`)
        } else {
          toast.success(`Queued ${provider} sync for ${styleId}`)
        }
      } else {
        toast.success(`Reset ${provider} sync for ${styleId}`)
      }

      // Reload failed jobs
      loadFailedJobs()
    } catch (err) {
      console.error('Retry error:', err)
      toast.error('Failed to retry sync')
    } finally {
      setRetryingJob(null)
    }
  }

  // Helper to check if a style has a recent failure for a provider
  const getFailedJob = (styleId: string, provider: 'alias' | 'stockx') => {
    return failedJobs.find(j => j.style_id === styleId && j.provider === provider)
  }

  // Simplified handlers - useMemo auto-updates filteredProducts
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleFilterChange = useCallback((mode: FilterMode) => {
    setFilterMode(mode)
  }, [])

  const startEditing = (styleId: string, currentValue: string | null) => {
    setEditingId(styleId)
    setEditValue(currentValue || '')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditValue('')
  }

  const toggleAddForm = () => {
    setShowAddForm(!showAddForm)
    // Reset form when opening
    if (!showAddForm) {
      setNewStyle({
        style_id: '',
        stockx_url_key: '',
        alias_catalog_id: '',
      })
    }
  }

  const handleAddStyle = async () => {
    const { style_id, stockx_url_key, alias_catalog_id } = newStyle

    // Validation
    if (!style_id.trim()) {
      toast.error('Style ID is required')
      return
    }
    if (!/^[A-Za-z0-9-_./]+$/.test(style_id)) {
      toast.error('Style ID contains invalid characters')
      return
    }
    // FIX 1: Require at least one provider mapping for new styles
    if (!stockx_url_key.trim() && !alias_catalog_id.trim()) {
      toast.error('To auto-sync market data, you need at least a StockX URL or GOAT URL.')
      return
    }

    setAddFormSaving(true)

    // Parse StockX URL if full URL is provided
    let cleanedStockxKey = stockx_url_key.trim()
    if (cleanedStockxKey) {
      try {
        const url = new URL(cleanedStockxKey)
        if (url.hostname.includes('stockx.com')) {
          // Extract the last part of the pathname (the URL key)
          const pathParts = url.pathname.split('/').filter(Boolean)
          cleanedStockxKey = pathParts[pathParts.length - 1] || cleanedStockxKey
        }
      } catch {
        // Not a valid URL, assume it's already just the key
      }

      // Check for duplicate StockX URL
      const { data: existing } = await supabase
        .from('inventory_v4_style_catalog')
        .select('style_id')
        .eq('stockx_url_key', cleanedStockxKey)
        .maybeSingle()

      if (existing) {
        toast.error(`This StockX product is already linked to ${existing.style_id}`)
        setAddFormSaving(false)
        return
      }
    }

    // Parse GOAT URL if full URL is provided
    let cleanedAliasId = alias_catalog_id.trim()
    if (cleanedAliasId) {
      try {
        const url = new URL(cleanedAliasId)
        if (url.hostname.includes('goat.com')) {
          // Extract the last part of the pathname (the catalog ID)
          // e.g., https://www.goat.com/sneakers/yeezy-boost-350-v2-by1604 → yeezy-boost-350-v2-by1604
          const pathParts = url.pathname.split('/').filter(Boolean)
          cleanedAliasId = pathParts[pathParts.length - 1] || cleanedAliasId
        }
      } catch {
        // Not a valid URL, assume it's already just the catalog ID
      }

      // Check for duplicate Alias catalog ID
      const { data: existing } = await supabase
        .from('inventory_v4_style_catalog')
        .select('style_id')
        .eq('alias_catalog_id', cleanedAliasId)
        .maybeSingle()

      if (existing) {
        toast.error(`This GOAT product is already linked to ${existing.style_id}`)
        setAddFormSaving(false)
        return
      }
    }

    // Normalize style_id: trim + uppercase (consistent with V4 add-item endpoint)
    const normalizedStyleId = style_id.trim().toUpperCase()

    const { data, error } = await supabase
      .from('inventory_v4_style_catalog')
      .insert({
        style_id: normalizedStyleId,
        stockx_url_key: cleanedStockxKey || null,
        alias_catalog_id: cleanedAliasId || null,
      })
      .select()
      .single()

    if (error) {
      toast.error(`Failed to add style: ${error.message}`)
      setAddFormSaving(false)
      return
    }

    // Success - update local state (useMemo handles filteredProducts)
    const newRow = data as StyleCatalogRow
    const updated = [newRow, ...products]
    setProducts(updated)

    // Recalculate stats - use stockx_url_key (what we set) not stockx_product_id (legacy)
    const total = updated.length
    const withStockX = updated.filter(p => p.stockx_url_key).length
    const withAlias = updated.filter(p => p.alias_catalog_id).length
    const withBoth = updated.filter(p => p.stockx_url_key && p.alias_catalog_id).length
    setStats({ total, withStockX, withAlias, withBoth })

    toast.success('Style added successfully')
    setAddFormSaving(false)
    setShowAddForm(false)
    setNewStyle({
      style_id: '',
      stockx_url_key: '',
      alias_catalog_id: '',
    })
  }

  const saveAliasId = async (styleId: string) => {
    const trimmedValue = editValue.trim()

    // Basic validation: no spaces, reasonable length, URL-safe characters
    // Loosened from ^[a-z0-9-]+$ to allow underscores, dots, and mixed case (some providers use different formats)
    if (trimmedValue && (trimmedValue.length > 200 || /\s/.test(trimmedValue))) {
      toast.error('Invalid format. Must be under 200 chars with no spaces.')
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('inventory_v4_style_catalog')
      .update({ alias_catalog_id: trimmedValue || null })
      .eq('style_id', styleId)

    if (error) {
      toast.error(`Failed to update: ${error.message}`)
      setSaving(false)
      return
    }

    // Update local state (useMemo handles filteredProducts)
    const updated = products.map(p =>
      p.style_id === styleId ? { ...p, alias_catalog_id: trimmedValue || null } : p
    )
    setProducts(updated)

    // Recalculate stats - use stockx_url_key (what we set) not stockx_product_id (legacy)
    const withAlias = updated.filter(p => p.alias_catalog_id).length
    const withBoth = updated.filter(p => p.stockx_url_key && p.alias_catalog_id).length
    setStats(prev => ({
      ...prev,
      withAlias,
      withBoth,
    }))

    toast.success(`Updated ${styleId}`)
    setSaving(false)
    cancelEditing()
  }

  const handleDelete = async (styleId: string) => {
    // Confirm before deleting
    if (!window.confirm(`Delete "${styleId}" from the style catalog?\n\nThis will also remove any pending sync jobs for this style.`)) {
      return
    }

    setDeletingId(styleId)

    try {
      const res = await fetch(`/api/v4/style/delete?styleId=${encodeURIComponent(styleId)}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to delete style')
        return
      }

      // Update local state
      const updated = products.filter(p => p.style_id !== styleId)
      setProducts(updated)

      // Recalculate stats
      const total = updated.length
      const withStockX = updated.filter(p => p.stockx_url_key).length
      const withAlias = updated.filter(p => p.alias_catalog_id).length
      const withBoth = updated.filter(p => p.stockx_url_key && p.alias_catalog_id).length
      setStats({ total, withStockX, withAlias, withBoth })

      toast.success(`Deleted ${styleId}${data.syncJobsRemoved > 0 ? ` (${data.syncJobsRemoved} sync jobs removed)` : ''}`)
    } catch (err) {
      console.error('Delete error:', err)
      toast.error('Failed to delete style')
    } finally {
      setDeletingId(null)
    }
  }

  // Sync Controls: Load sync status (running progress or last completed)
  const loadSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sync-catalog')
      if (res.ok) {
        const data = await res.json()

        // Update progress if sync is running
        if (data.running && data.progress) {
          setSyncProgress(data.progress)
        } else {
          setSyncProgress(null)
        }

        // Update last sync if available
        if (data.lastSync) {
          setLastSync({
            timestamp: data.lastSync.completed_at,
            stats: `${data.lastSync.success_count}/${data.lastSync.total_items} synced`
          })
        }
      }
    } catch (err) {
      console.error('Failed to load sync status:', err)
    }
  }, [])

  // Alias for backward compatibility
  const loadLastSync = loadSyncStatus

  // Sync Controls: Start bulk sync (SYNCHRONOUS - waits for completion)
  const startSync = async (mode: 'all' | 'missing' | 'force') => {
    if (syncRunning) {
      toast.warning('Sync is already in progress')
      return
    }

    setSyncRunning(true)
    sessionStorage.setItem('admin_sync_running', 'true')
    const modeLabel = mode === 'all' ? 'stale items' : mode === 'force' ? 'force refresh all' : 'missing only'
    toast.info(`Starting sync (${modeLabel})...`)

    try {
      const res = await fetch('/api/admin/sync-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, platform: 'both' })
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Sync failed')
        return
      }

      // Sync completed (synchronous response)
      if (data.success) {
        toast.success(data.message || 'Sync completed!')
      } else {
        toast.warning(`Sync completed with errors: ${data.failed} failed`)
      }

      // Refresh data
      loadLastSync()
      loadData()
    } catch (err) {
      console.error('Sync error:', err)
      toast.error('Sync failed - check console')
    } finally {
      setSyncRunning(false)
      sessionStorage.removeItem('admin_sync_running')
    }
  }

  // Warn user if they try to leave during sync
  useEffect(() => {
    if (!syncRunning) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'Sync is in progress. Leaving will cancel it. Are you sure?'
      return e.returnValue
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [syncRunning])

  // Poll for progress while sync is running
  useEffect(() => {
    if (!syncRunning) return

    // Poll every 2 seconds for progress
    const interval = setInterval(() => {
      loadSyncStatus()
    }, 2000)

    return () => clearInterval(interval)
  }, [syncRunning, loadSyncStatus])

  useEffect(() => {
    loadData()
    loadLastSync()
    loadFailedJobs()

    // Set up real-time subscription for changes (debounced to avoid spam during bulk updates)
    const channel = supabase
      .channel('style-catalog-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_v4_style_catalog',
        },
        () => {
          // Debounce realtime updates (500ms) to prevent spam during bulk backfills
          if (realtimeDebounceRef.current) {
            clearTimeout(realtimeDebounceRef.current)
          }
          realtimeDebounceRef.current = setTimeout(() => {
            console.log('Style catalog changed, reloading...')
            loadData()
          }, 500)
        }
      )
      .subscribe()

    return () => {
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current)
      }
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Style Catalog</h1>
        <div className="flex gap-2">
          <Button onClick={toggleAddForm} variant={showAddForm ? "secondary" : "default"}>
            <Plus className="h-4 w-4 mr-2" />
            Add Style
          </Button>
          <Button onClick={loadData} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Add Style Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Style</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Required field */}
              <div className="space-y-2">
                <Label htmlFor="style_id">
                  Style ID (SKU) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="style_id"
                  placeholder="DD1391-100"
                  value={newStyle.style_id}
                  onChange={(e) => setNewStyle({ ...newStyle, style_id: e.target.value })}
                  disabled={addFormSaving}
                  className="font-mono"
                />
              </div>

              {/* Provider mappings - at least one required */}
              <p className="text-sm text-muted-foreground">
                Paste a StockX URL or GOAT URL and we'll auto-sync product, sizes and prices in the background.
              </p>

              <div className="space-y-2">
                <Label htmlFor="alias_catalog_id">GOAT URL</Label>
                <Input
                  id="alias_catalog_id"
                  placeholder="https://www.goat.com/sneakers/yeezy-boost-350-v2-by1604"
                  value={newStyle.alias_catalog_id}
                  onChange={(e) => setNewStyle({ ...newStyle, alias_catalog_id: e.target.value })}
                  disabled={addFormSaving}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">Paste the full GOAT URL - we'll extract the catalog ID automatically</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stockx_url_key">StockX URL</Label>
                <Input
                  id="stockx_url_key"
                  placeholder="https://stockx.com/nike-dunk-low-panda or just the slug"
                  value={newStyle.stockx_url_key}
                  onChange={(e) => setNewStyle({ ...newStyle, stockx_url_key: e.target.value })}
                  disabled={addFormSaving}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">Paste the full URL from your browser - we'll extract the key automatically</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <Button onClick={handleAddStyle} disabled={addFormSaving}>
                {addFormSaving ? 'Adding...' : 'Add Style'}
              </Button>
              <Button onClick={toggleAddForm} variant="outline" disabled={addFormSaving}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Sync Controls</CardTitle>
            {lastSync && !syncRunning && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Last sync: {new Date(lastSync.timestamp).toLocaleString()} ({lastSync.stats})
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {syncRunning ? (
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
                    <span className="font-medium">
                      {syncProgress ? `Syncing: ${syncProgress.currentSku || '...'}` : 'Starting sync...'}
                    </span>
                  </div>
                  <span className="font-mono text-muted-foreground">
                    {syncProgress ? `${syncProgress.completed}/${syncProgress.total}` : '0/0'}
                  </span>
                </div>

                {/* Progress Bar Track */}
                <div className="relative h-4 w-full overflow-hidden rounded-full bg-black/10 border border-black/20">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(syncProgress?.percent || 0, 2)}%` }}
                  />
                  {/* Pulse animation overlay when syncing */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-emerald-500 font-medium">
                    ✓ {syncProgress?.success || 0} synced
                  </span>
                  {(syncProgress?.failed ?? 0) > 0 && (
                    <span className="text-red-500 font-medium">
                      ✗ {syncProgress?.failed} failed
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {syncProgress?.percent || 0}% complete
                  </span>
                </div>
              </div>

              <p className="text-xs text-amber-500 font-medium">
                ⚠️ Do not leave this page - sync will be cancelled if you navigate away
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => startSync('all')} variant="default" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Sync Stale Items
                </Button>
                <Button onClick={() => startSync('force')} variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Force Refresh All
                </Button>
                <Button onClick={() => startSync('missing')} variant="ghost" className="gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Sync Missing Only
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Sync Stale</strong>: Skips items synced within last 6 hours •
                <strong className="ml-1">Force Refresh</strong>: Re-syncs everything regardless
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Total Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">With StockX</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.withStockX}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">With Alias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.withAlias}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Both Providers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.withBoth}</div>
            </CardContent>
          </Card>
        </div>

        {/* Sync Hint Text */}
        <p className="text-xs text-gray-500 italic">
          This catalog syncs product data from multiple providers. StockX IDs are populated automatically via backfill scripts.
          Alias catalog IDs can be edited manually here or synced via API.
        </p>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle>Products ({filteredProducts.length})</CardTitle>
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by SKU, brand, name, or colorway..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Filter:</span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={filterMode === 'all' ? 'default' : 'outline'}
                  onClick={() => handleFilterChange('all')}
                  className="h-8"
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={filterMode === 'needsAlias' ? 'default' : 'outline'}
                  onClick={() => handleFilterChange('needsAlias')}
                  className="h-8"
                >
                  Needs Alias
                </Button>
                <Button
                  size="sm"
                  variant={filterMode === 'hasAlias' ? 'default' : 'outline'}
                  onClick={() => handleFilterChange('hasAlias')}
                  className="h-8"
                >
                  Has Alias
                </Button>
                <Button
                  size="sm"
                  variant={filterMode === 'hasBoth' ? 'default' : 'outline'}
                  onClick={() => handleFilterChange('hasBoth')}
                  className="h-8"
                >
                  Both Providers
                </Button>
                <Button
                  size="sm"
                  variant={filterMode === 'failed' ? 'default' : 'outline'}
                  onClick={() => handleFilterChange('failed')}
                  className={`h-8 ${failedJobs.length > 0 ? 'text-red-400 border-red-500/50' : ''}`}
                >
                  Failed ({failedJobs.length})
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProducts.length === 0 ? (
            <p className="text-sm text-gray-500">
              {searchQuery ? 'No products match your search' : 'No products in catalog'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="border-b bg-gray-950/70 backdrop-blur">
                  <tr className="text-left">
                    <th className="p-3">Style ID</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Brand</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Colorway</th>
                    <th className="p-3 text-center">StockX</th>
                    <th className="p-3">Alias Catalog ID</th>
                    <th className="p-3">Sync Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product, index) => {
                    const hasStockX = !!product.stockx_url_key
                    const hasAlias = !!product.alias_catalog_id
                    const hasBoth = hasStockX && hasAlias
                    const hasNeither = !hasStockX && !hasAlias
                    return (
                    <tr
                      key={product.style_id}
                      className={`
                        border-b
                        ${index % 2 === 0 ? 'bg-gray-900/40' : 'bg-gray-900/20'}
                        hover:bg-gray-800
                        ${hasNeither ? 'ring-1 ring-red-500/40 bg-red-500/5' : ''}
                      `}
                    >
                      <td className="p-3 font-mono text-xs font-semibold text-gray-100">{product.style_id}</td>
                      <td className="p-3">
                        {hasBoth ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                            Synced
                          </span>
                        ) : hasNeither ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                            Not linked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                            Partial
                          </span>
                        )}
                      </td>
                      <td className="p-3">{product.brand || '—'}</td>
                      <td className="p-3 max-w-[300px] truncate">{product.name || '—'}</td>
                      <td className="p-3 text-xs text-gray-400 whitespace-normal">{product.colorway || '—'}</td>
                      <td className="p-3 text-center">
                        {product.stockx_url_key ? (
                          <a
                            href={`https://stockx.com/${product.stockx_url_key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-green-600 hover:underline"
                          >
                            <Check className="h-4 w-4" />
                          </a>
                        ) : (
                          <X className="h-4 w-4 text-gray-300 mx-auto" />
                        )}
                      </td>
                      <td className="p-3">
                        {editingId === product.style_id ? (
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !saving) {
                                saveAliasId(product.style_id)
                              } else if (e.key === 'Escape' && !saving) {
                                cancelEditing()
                              }
                            }}
                            placeholder="catalog-id-slug"
                            className="h-8 text-xs font-mono"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            {product.alias_catalog_id ? (
                              <>
                                <span className="font-mono text-xs font-semibold text-gray-100">
                                  {product.alias_catalog_id}
                                </span>
                                <a
                                  href={`https://www.goat.com/sneakers/${product.alias_catalog_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline ml-2"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </>
                            ) : (
                              <span className="text-gray-400 text-xs">Not set</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {(() => {
                          const aliasFailure = getFailedJob(product.style_id, 'alias')
                          const stockxFailure = getFailedJob(product.style_id, 'stockx')
                          const hasAnyFailure = aliasFailure || stockxFailure

                          if (!hasAnyFailure) {
                            return <span className="text-gray-500 text-xs">—</span>
                          }

                          return (
                            <div className="flex flex-col gap-1">
                              {aliasFailure && (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 cursor-help"
                                    title={aliasFailure.last_error || 'Unknown error'}
                                  >
                                    <AlertCircle className="h-3 w-3" />
                                    Alias
                                  </span>
                                  <Button
                                    onClick={() => handleRetryJob(product.style_id, 'alias')}
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 px-1.5 text-[10px] text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                                    disabled={retryingJob?.styleId === product.style_id && retryingJob?.provider === 'alias'}
                                  >
                                    {retryingJob?.styleId === product.style_id && retryingJob?.provider === 'alias' ? (
                                      <RefreshCw className="h-3 w-3 animate-spin" />
                                    ) : (
                                      'Retry'
                                    )}
                                  </Button>
                                </div>
                              )}
                              {stockxFailure && (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 cursor-help"
                                    title={stockxFailure.last_error || 'Unknown error'}
                                  >
                                    <AlertCircle className="h-3 w-3" />
                                    StockX
                                  </span>
                                  <Button
                                    onClick={() => handleRetryJob(product.style_id, 'stockx')}
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 px-1.5 text-[10px] text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                                    disabled={retryingJob?.styleId === product.style_id && retryingJob?.provider === 'stockx'}
                                  >
                                    {retryingJob?.styleId === product.style_id && retryingJob?.provider === 'stockx' ? (
                                      <RefreshCw className="h-3 w-3 animate-spin" />
                                    ) : (
                                      'Retry'
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          {editingId === product.style_id ? (
                            <>
                              <Button
                                onClick={() => saveAliasId(product.style_id)}
                                size="sm"
                                variant="default"
                                className="h-7 px-2"
                                disabled={saving}
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                onClick={cancelEditing}
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                disabled={saving}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={() => startEditing(product.style_id, product.alias_catalog_id)}
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                              >
                                Edit
                              </Button>
                              <Button
                                onClick={() => handleDelete(product.style_id)}
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                disabled={deletingId === product.style_id}
                              >
                                {deletingId === product.style_id ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
