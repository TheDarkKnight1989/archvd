'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useCurrency } from '@/hooks/useCurrency'
import {
  Calendar,
  Search,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  Loader2,
  Bookmark,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils/cn'
import { ReleaseCard, ReleaseCardSkeleton } from '@/components/ReleaseCard'
import { toast } from 'sonner'
import { AddToWatchlistPicker } from './components/AddToWatchlistPicker'

type Release = {
  id: string
  source: string
  external_id: string
  title: string
  brand: string
  model: string
  colorway: string | null
  sku: string | null
  release_date: string | null
  price_gbp: number | null
  image_url: string | null
  product_url: string | null
  retailers: Array<{ name: string; url: string }> | null
  status: 'upcoming' | 'dropped' | 'tba'
  created_at: string
  updated_at: string
}

const BRAND_FILTERS = ['All', 'Nike', 'Jordan', 'Adidas', 'New Balance', 'Asics', 'Vans']
const STATUS_FILTERS = ['all', 'upcoming', 'dropped', 'tba'] as const

export default function ReleasesPage() {
  useRequireAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { convert, format } = useCurrency()

  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get initial state from URL
  const [filterBrand, setFilterBrand] = useState(searchParams.get('brand') || 'All')
  const [filterStatus, setFilterStatus] = useState<typeof STATUS_FILTERS[number]>(
    (searchParams.get('status') as typeof STATUS_FILTERS[number]) || 'all'
  )
  const [filterDateFrom, setFilterDateFrom] = useState(searchParams.get('from') || '')
  const [filterDateTo, setFilterDateTo] = useState(searchParams.get('to') || '')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')

  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [watchlistPickerOpen, setWatchlistPickerOpen] = useState(false)

  // Handle deep-link to release modal
  useEffect(() => {
    const releaseId = searchParams.get('release')
    if (releaseId && releases.length > 0) {
      const release = releases.find((r) => r.id === releaseId)
      if (release) {
        setSelectedRelease(release)
        setModalOpen(true)
      }
    }
  }, [searchParams, releases])

  useEffect(() => {
    fetchReleases()
  }, [filterBrand, filterStatus, filterDateFrom, filterDateTo])

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()

    if (filterBrand !== 'All') params.set('brand', filterBrand)
    if (filterStatus !== 'all') params.set('status', filterStatus)
    if (filterDateFrom) params.set('from', filterDateFrom)
    if (filterDateTo) params.set('to', filterDateTo)
    if (searchQuery) params.set('q', searchQuery)

    const queryString = params.toString()
    router.replace(`/portfolio/releases${queryString ? `?${queryString}` : ''}`, {
      scroll: false,
    })
  }, [filterBrand, filterStatus, filterDateFrom, filterDateTo, searchQuery, router])

  const fetchReleases = async () => {
    setLoading(true)
    setError(null)

    try {
      // Build query params
      const params = new URLSearchParams()
      if (filterBrand !== 'All') {
        params.set('brand', filterBrand)
      }
      if (filterStatus !== 'all') {
        params.set('status', filterStatus)
      }
      if (filterDateFrom) {
        params.set('from', filterDateFrom)
      }
      if (filterDateTo) {
        params.set('to', filterDateTo)
      }
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim())
      }
      params.set('limit', '100')

      const response = await fetch(`/api/releases?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch releases')
      }

      const data = await response.json()
      setReleases(data.items || [])
    } catch (err: any) {
      console.error('[Releases] Fetch error:', err)
      setError(err.message || 'Failed to fetch releases')
      setReleases([])
      toast.error('Failed to load releases')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setSyncing(true)
    toast.info('Syncing releases from thedropdate.com...')

    try {
      const response = await fetch('/api/releases/ingest/thedropdate?pages=3', {
        method: 'GET',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Sync failed')
      }

      const result = await response.json()

      toast.success(
        `${result.items_inserted + result.items_updated} releases updated`,
        { duration: 5000 }
      )

      // Refresh the list
      await fetchReleases()
    } catch (err: any) {
      console.error('[Releases] Sync error:', err)
      toast.error(err.message || 'Failed to sync releases')
    } finally {
      setSyncing(false)
    }
  }

  const handleSearch = () => {
    fetchReleases()
  }

  const handleCardClick = (release: Release) => {
    setSelectedRelease(release)
    setModalOpen(true)

    // Update URL with deep-link
    const params = new URLSearchParams(searchParams.toString())
    params.set('release', release.id)
    router.replace(`/portfolio/releases?${params.toString()}`, { scroll: false })
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedRelease(null)

    // Remove deep-link from URL
    const params = new URLSearchParams(searchParams.toString())
    params.delete('release')
    const queryString = params.toString()
    router.replace(`/portfolio/releases${queryString ? `?${queryString}` : ''}`, { scroll: false })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'TBA'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatRelativeDate = (dateString: string | null) => {
    if (!dateString) return 'TBA'

    const date = new Date(dateString)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      const absDays = Math.abs(diffDays)
      if (absDays === 0) return 'Today'
      if (absDays === 1) return 'Yesterday'
      if (absDays < 7) return `${absDays} days ago`
      if (absDays < 30) return `${Math.floor(absDays / 7)} weeks ago`
      return `${Math.floor(absDays / 30)} months ago`
    } else {
      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Tomorrow'
      if (diffDays < 7) return `In ${diffDays} days`
      if (diffDays < 30) return `In ${Math.floor(diffDays / 7)} weeks`
      return `In ${Math.floor(diffDays / 30)} months`
    }
  }

  const clearDateFilters = () => {
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  // Filter releases by search query (client-side for instant feedback)
  const filteredReleases = releases.filter((release) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      release.title.toLowerCase().includes(query) ||
      release.brand.toLowerCase().includes(query) ||
      release.model.toLowerCase().includes(query) ||
      release.sku?.toLowerCase().includes(query)
    )
  })

  const activeFilterCount =
    (filterBrand !== 'All' ? 1 : 0) +
    (filterStatus !== 'all' ? 1 : 0) +
    (filterDateFrom ? 1 : 0) +
    (filterDateTo ? 1 : 0) +
    (searchQuery ? 1 : 0)

  return (
    <div className="mx-auto max-w-[1280px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 text-fg">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg relative inline-block">
            Releases
            <span className="absolute bottom-0 left-0 w-16 h-0.5 bg-accent opacity-40"></span>
          </h1>
          <p className="text-sm text-dim mt-1">
            Sneaker releases from thedropdate.com • Auto-synced daily at 06:00 UTC
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={syncing}
          variant="outline"
          className="bg-elev-1 border-border hover:bg-elev-2 shadow-soft transition-boutique"
        >
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">{syncing ? 'Syncing...' : 'Refresh Data'}</span>
        </Button>
      </div>

      {/* Filters Section */}
      <Card elevation="soft" className="p-4 space-y-4">
        {/* Brand Pills */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted font-medium">Brand:</span>
          <div className="flex flex-wrap gap-2 flex-1">
            {BRAND_FILTERS.map((brand) => (
              <button
                key={brand}
                onClick={() => setFilterBrand(brand)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-boutique',
                  'border border-border bg-elev-1 hover:bg-elev-2 shadow-soft',
                  filterBrand === brand && 'bg-accent-200 text-fg border-accent/50'
                )}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>

        {/* Status Segments */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted font-medium">Status:</span>
          <div className="inline-flex bg-elev-2 rounded-lg p-1 border border-border">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-boutique',
                  filterStatus === status
                    ? 'bg-accent text-black shadow-soft'
                    : 'text-muted hover:text-fg'
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted font-medium">Date:</span>
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="date-from" className="text-xs text-muted">
                From
              </Label>
              <Input
                id="date-from"
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-[150px] bg-elev-1 border-border focus:ring-focus text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="date-to" className="text-xs text-muted">
                To
              </Label>
              <Input
                id="date-to"
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-[150px] bg-elev-1 border-border focus:ring-focus text-sm"
              />
            </div>
            {(filterDateFrom || filterDateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDateFilters}
                className="mt-5 h-8 w-8 p-0 text-muted hover:text-fg"
                aria-label="Clear date filters"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            type="text"
            placeholder="Search releases by name, brand, model, or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10 bg-elev-1 border-border focus:ring-focus transition-boutique"
          />
        </div>

        {/* Active Filters Summary */}
        {activeFilterCount > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-xs text-muted">
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterBrand('All')
                setFilterStatus('all')
                setFilterDateFrom('')
                setFilterDateTo('')
                setSearchQuery('')
              }}
              className="text-xs text-accent hover:text-accent-600"
            >
              Clear all filters
            </Button>
          </div>
        )}
      </Card>

      {/* Error State */}
      {error && (
        <Card className="p-6 border-danger/50 bg-danger/10">
          <p className="text-danger font-medium">{error}</p>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ReleaseCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredReleases.length === 0 && (
        <Card elevation="soft" className="p-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-dim mb-4" />
          <p className="text-fg font-medium">No releases found</p>
          <p className="text-sm text-dim mt-2">
            {searchQuery.trim()
              ? 'Try adjusting your search or filters'
              : 'Click "Refresh Data" to sync releases from thedropdate.com'}
          </p>
        </Card>
      )}

      {/* Releases Grid */}
      {!loading && filteredReleases.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted">
              Showing {filteredReleases.length} release{filteredReleases.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReleases.map((release) => (
              <div
                key={release.id}
                onClick={() => handleCardClick(release)}
                className="cursor-pointer"
              >
                <ReleaseCard
                  imageUrl={release.image_url || '/placeholder-release.png'}
                  name={release.model}
                  brand={release.brand}
                  colorway={release.colorway ?? undefined}
                  releaseDateISO={release.release_date ?? undefined}
                  retailers={
                    release.retailers?.map((r) => ({
                      name: r.name,
                      href: r.url,
                    })) || []
                  }
                  sku={release.sku || undefined}
                  remindable={false}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Release Details Modal */}
      <Dialog open={modalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-2xl">
          {selectedRelease && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-4">
                  {selectedRelease.image_url && (
                    <img
                      src={selectedRelease.image_url}
                      alt={selectedRelease.title}
                      className="h-24 w-24 rounded-lg object-cover border border-border"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-accent text-black text-xs font-semibold">
                        {selectedRelease.brand}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {selectedRelease.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {selectedRelease.source}
                      </Badge>
                    </div>
                    <DialogTitle className="text-xl">
                      {selectedRelease.title}
                    </DialogTitle>
                    {selectedRelease.colorway && (
                      <DialogDescription>{selectedRelease.colorway}</DialogDescription>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="p-4 space-y-4">
                {/* Release Date */}
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-sm text-muted">Release Date</span>
                  <div className="text-right">
                    <p className="text-sm text-fg font-mono">
                      {formatDate(selectedRelease.release_date)}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {formatRelativeDate(selectedRelease.release_date)}
                    </p>
                  </div>
                </div>

                {/* Price */}
                {selectedRelease.price_gbp && (
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <span className="text-sm text-muted">Retail Price</span>
                    <span className="text-sm text-fg font-mono">
                      {format(convert(selectedRelease.price_gbp, 'GBP'))}
                    </span>
                  </div>
                )}

                {/* SKU */}
                {selectedRelease.sku && (
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <span className="text-sm text-muted">SKU</span>
                    <Link
                      href={`/portfolio/market?sku=${selectedRelease.sku}`}
                      onClick={() => handleCloseModal()}
                      className="group flex items-center gap-2 text-sm font-mono text-fg hover:text-accent transition-colors"
                    >
                      {selectedRelease.sku}
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </div>
                )}

                {/* Retailers */}
                {selectedRelease.retailers && selectedRelease.retailers.length > 0 && (
                  <div className="pt-2">
                    <p className="text-sm text-muted mb-3">
                      Available at ({selectedRelease.retailers.length})
                    </p>
                    <div className="space-y-2">
                      {selectedRelease.retailers.map((retailer, idx) => (
                        <a
                          key={idx}
                          href={retailer.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center justify-between p-3 bg-elev-2 hover:bg-elev-1 border border-border hover:border-accent-400/50 rounded-lg transition-all"
                        >
                          <span className="text-sm text-fg">{retailer.name}</span>
                          <ExternalLink className="h-4 w-4 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-row justify-between">
                <div className="flex items-center gap-2">
                  {selectedRelease.product_url && (
                    <a
                      href={selectedRelease.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-accent hover:text-accent-600 transition-colors"
                    >
                      <span>View on {selectedRelease.source}</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedRelease.sku && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setWatchlistPickerOpen(true)
                      }}
                      className="border-accent/50 text-accent hover:bg-accent/10"
                    >
                      <Bookmark className="h-4 w-4 mr-2" />
                      Add to Watchlist
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleCloseModal}>
                    Close
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add to Watchlist Picker */}
      {selectedRelease?.sku && (
        <AddToWatchlistPicker
          open={watchlistPickerOpen}
          onOpenChange={setWatchlistPickerOpen}
          sku={selectedRelease.sku}
          defaultTargetPrice={selectedRelease.price_gbp || undefined}
        />
      )}
    </div>
  )
}
