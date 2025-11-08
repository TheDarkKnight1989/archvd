'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { supabase } from '@/lib/supabase/client'
import { Calendar, Filter, ExternalLink, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils/cn'
import { ReleaseCard, ReleaseCardSkeleton } from '@/components/ReleaseCard'

type Release = {
  id: string
  brand: string
  model: string
  colorway: string | null
  release_date: string
  source: string
  source_url: string | null
  image_url: string | null
  slug: string | null
  status: string
  skus: string[] | null
  meta?: any
}

const BRANDS = ['All Brands', 'Nike', 'Jordan', 'Adidas', 'New Balance', 'Asics', 'Vans']

export default function ReleasesPage() {
  useRequireAuth()

  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterBrand, setFilterBrand] = useState('All Brands')
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    fetchReleases()
  }, [filterBrand, filterMonth])

  const fetchReleases = async () => {
    setLoading(true)
    setError(null)

    try {
      // Parse month filter
      const [year, month] = filterMonth.split('-').map(Number)
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0) // Last day of month

      let query = supabase
        .from('upcoming_releases_with_skus')
        .select('*')
        .gte('release_date', startDate.toISOString().split('T')[0])
        .lte('release_date', endDate.toISOString().split('T')[0])
        .order('release_date', { ascending: true })

      if (filterBrand !== 'All Brands') {
        query = query.ilike('brand', `%${filterBrand}%`)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        throw fetchError
      }

      setReleases(data || [])
    } catch (err: any) {
      console.error('[Releases] Fetch error:', err)
      setError(err.message || 'Failed to fetch releases')
      setReleases([])
    } finally {
      setLoading(false)
    }
  }

  const handleCardClick = (release: Release) => {
    setSelectedRelease(release)
    setModalOpen(true)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    })
  }

  const groupedByDate = releases.reduce((acc, release) => {
    const date = release.release_date
    if (!acc[date]) acc[date] = []
    acc[date].push(release)
    return acc
  }, {} as Record<string, Release[]>)

  const sortedDates = Object.keys(groupedByDate).sort()

  // Generate month options (current + next 3 months)
  const monthOptions = Array.from({ length: 4 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() + i)
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    }
  })

  return (
    <div className="mx-auto max-w-[1280px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 text-fg">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-fg relative inline-block">
          Releases
          <span className="absolute bottom-0 left-0 w-16 h-0.5 bg-accent-400 opacity-40"></span>
        </h1>
        <p className="text-sm text-dim mt-1">Upcoming sneaker launches from Nike, Size?, and Footpatrol</p>
      </div>

      {/* Filters */}
      <Card elevation={1} className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Filter className="h-4 w-4" />
            <span>Filter by:</span>
          </div>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[200px] bg-bg border-border">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-elev-2 border-border">
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterBrand} onValueChange={setFilterBrand}>
            <SelectTrigger className="w-[160px] bg-bg border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-elev-2 border-border">
              {BRANDS.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
      {!loading && releases.length === 0 && (
        <Card elevation={1} className="p-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-dim mb-4" />
          <p className="text-fg font-medium">No releases found</p>
          <p className="text-sm text-dim mt-2">Try adjusting your filters or check back later</p>
        </Card>
      )}

      {/* Releases Grid - Grouped by Date */}
      {!loading && releases.length > 0 && (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-lg font-semibold text-fg">
                  {formatDate(date)}
                </h2>
                <div className="flex-1 h-px bg-border"></div>
                <Badge variant="outline" className="text-xs">
                  {groupedByDate[date].length} release{groupedByDate[date].length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedByDate[date].map((release) => (
                  <div key={release.id} onClick={() => handleCardClick(release)} className="cursor-pointer">
                    <ReleaseCard
                      imageUrl={release.image_url || '/placeholder-release.png'}
                      name={release.model}
                      brand={release.brand}
                      colorway={release.colorway || undefined}
                      releaseDateISO={release.release_date}
                      retailers={
                        release.source
                          ? [{ name: release.source, href: release.source_url || undefined }]
                          : []
                      }
                      sku={release.skus?.[0]}
                      remindable={false}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Release Details Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          {selectedRelease && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-4">
                  {selectedRelease.image_url && (
                    <img
                      src={selectedRelease.image_url}
                      alt={`${selectedRelease.brand} ${selectedRelease.model}`}
                      className="h-24 w-24 rounded-lg object-cover border border-border"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-accent text-black text-xs font-semibold">
                        {selectedRelease.brand}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {selectedRelease.source}
                      </Badge>
                    </div>
                    <DialogTitle className="text-xl">
                      {selectedRelease.brand} {selectedRelease.model}
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
                  <span className="text-sm text-fg font-mono">
                    {new Date(selectedRelease.release_date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-sm text-muted">Status</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {selectedRelease.status}
                  </Badge>
                </div>

                {/* SKUs Section */}
                {selectedRelease.skus && selectedRelease.skus.length > 0 && (
                  <div className="pt-2">
                    <p className="text-sm text-muted mb-3">Available SKUs ({selectedRelease.skus.length})</p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedRelease.skus.map((sku, idx) => (
                        <Link
                          key={idx}
                          href={`/dashboard/market?sku=${sku}`}
                          onClick={() => setModalOpen(false)}
                          className="group flex items-center justify-between p-3 bg-elev-2 hover:bg-elev-1 border border-border hover:border-accent-400/50 rounded-lg transition-all"
                        >
                          <span className="text-sm font-mono text-fg">{sku}</span>
                          <ArrowRight className="h-4 w-4 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      ))}
                    </div>
                    <p className="text-xs text-dim mt-3 text-center">
                      Click a SKU to view market prices
                    </p>
                  </div>
                )}

                {/* No SKUs State */}
                {(!selectedRelease.skus || selectedRelease.skus.length === 0) && (
                  <div className="py-6 text-center">
                    <p className="text-sm text-dim">No SKU information available yet</p>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-row justify-between">
                {selectedRelease.source_url ? (
                  <a
                    href={selectedRelease.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-accent hover:text-accent-600 transition-colors"
                  >
                    <span>View on {selectedRelease.source}</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <div />
                )}
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
