'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus, Download, RefreshCw, Upload, Filter, Search, ArrowUpDown, X, Check } from 'lucide-react'
import type { TableParams } from '@/lib/url/params'
import { cn } from '@/lib/utils/cn'

interface ToolbarFiltersProps {
  onQuickAdd?: () => void
  onBulkImport?: () => void
  onExport?: () => void
  onRefreshPricing?: () => void
  isRefreshing?: boolean
  // Filter props
  params: TableParams
  onParamsChange: (params: TableParams) => void
  brands: string[]
  sizes: string[]
}

const STATUS_OPTIONS = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'sold', label: 'Sold' },
  { value: 'reserved', label: 'Reserved' },
]

const SORT_OPTIONS = [
  { key: 'created_at', label: 'Date Added' },
  { key: 'market_value', label: 'Market Value' },
  { key: 'pl', label: 'P/L (£)' },
  { key: 'plPct', label: 'P/L (%)' },
] as const

export function ToolbarFilters({
  onQuickAdd,
  onBulkImport,
  onExport,
  onRefreshPricing,
  isRefreshing,
  params,
  onParamsChange,
  brands,
  sizes,
}: ToolbarFiltersProps) {
  const [search, setSearch] = useState(params.search || '')
  const [searchDebounced, setSearchDebounced] = useState(params.search || '')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Update params when debounced search changes
  useEffect(() => {
    if (searchDebounced !== params.search) {
      onParamsChange({ ...params, search: searchDebounced || undefined })
    }
  }, [searchDebounced])

  const toggleStatus = (status: string) => {
    const current = params.status || []
    const next = current.includes(status) ? current.filter((s) => s !== status) : [...current, status]
    onParamsChange({ ...params, status: next.length > 0 ? next : undefined })
  }

  const toggleBrand = (brand: string) => {
    const current = params.brand || []
    const next = current.includes(brand) ? current.filter((b) => b !== brand) : [...current, brand]
    onParamsChange({ ...params, brand: next.length > 0 ? next : undefined })
  }

  const toggleSize = (size: string) => {
    const current = params.size_uk || []
    const next = current.includes(size) ? current.filter((s) => s !== size) : [...current, size]
    onParamsChange({ ...params, size_uk: next.length > 0 ? next : undefined })
  }

  const setSort = (key: typeof SORT_OPTIONS[number]['key']) => {
    const currentDir = params.sort?.key === key ? params.sort.dir : 'desc'
    const newDir = currentDir === 'desc' ? 'asc' : 'desc'
    onParamsChange({ ...params, sort: { key, dir: newDir } })
  }

  const clearFilters = () => {
    setSearch('')
    setSearchDebounced('')
    onParamsChange({})
  }

  const hasFilters =
    (params.status && params.status.length > 0) ||
    (params.brand && params.brand.length > 0) ||
    (params.size_uk && params.size_uk.length > 0) ||
    !!params.search

  const activeFilterCount =
    (params.status?.length || 0) + (params.brand?.length || 0) + (params.size_uk?.length || 0) + (params.search ? 1 : 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto snap-x pb-2 md:pb-0">
          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 pr-3 rounded-xl border border-border bg-bg text-sm text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-focus w-40 md:w-48"
            />
          </div>

          {/* Status Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 snap-start">
                <Filter className="h-4 w-4 mr-2" />
                Status
                {params.status && params.status.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-md bg-accent text-black text-xs font-medium">
                    {params.status.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56">
              <div className="space-y-2">
                <p className="text-sm font-medium text-fg">Filter by Status</p>
                {STATUS_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer hover:bg-surface rounded-lg p-2 transition-colors"
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center',
                        params.status?.includes(option.value)
                          ? 'bg-accent border-accent'
                          : 'border-border bg-bg'
                      )}
                    >
                      {params.status?.includes(option.value) && <Check className="h-3 w-3 text-black" />}
                    </div>
                    <input
                      type="checkbox"
                      checked={params.status?.includes(option.value)}
                      onChange={() => toggleStatus(option.value)}
                      className="sr-only"
                    />
                    <span className="text-sm text-fg">{option.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Brand Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 snap-start">
                <Filter className="h-4 w-4 mr-2" />
                Brand
                {params.brand && params.brand.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-md bg-accent text-black text-xs font-medium">
                    {params.brand.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 max-h-80 overflow-y-auto">
              <div className="space-y-2">
                <p className="text-sm font-medium text-fg">Filter by Brand</p>
                {brands.length === 0 ? (
                  <p className="text-xs text-dim py-2">No brands available</p>
                ) : (
                  brands.map((brand) => (
                    <label
                      key={brand}
                      className="flex items-center gap-2 cursor-pointer hover:bg-surface rounded-lg p-2 transition-colors"
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center',
                          params.brand?.includes(brand) ? 'bg-accent border-accent' : 'border-border bg-bg'
                        )}
                      >
                        {params.brand?.includes(brand) && <Check className="h-3 w-3 text-black" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={params.brand?.includes(brand)}
                        onChange={() => toggleBrand(brand)}
                        className="sr-only"
                      />
                      <span className="text-sm text-fg">{brand}</span>
                    </label>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Size Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 snap-start">
                <Filter className="h-4 w-4 mr-2" />
                Size
                {params.size_uk && params.size_uk.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-md bg-accent text-black text-xs font-medium">
                    {params.size_uk.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 max-h-80 overflow-y-auto">
              <div className="space-y-2">
                <p className="text-sm font-medium text-fg">Filter by Size</p>
                {sizes.length === 0 ? (
                  <p className="text-xs text-dim py-2">No sizes available</p>
                ) : (
                  sizes.map((size) => (
                    <label
                      key={size}
                      className="flex items-center gap-2 cursor-pointer hover:bg-surface rounded-lg p-2 transition-colors"
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center',
                          params.size_uk?.includes(size) ? 'bg-accent border-accent' : 'border-border bg-bg'
                        )}
                      >
                        {params.size_uk?.includes(size) && <Check className="h-3 w-3 text-black" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={params.size_uk?.includes(size)}
                        onChange={() => toggleSize(size)}
                        className="sr-only"
                      />
                      <span className="text-sm text-fg">{size}</span>
                    </label>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Sort */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 snap-start">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Sort
                {params.sort && <span className="ml-2 text-xs text-muted">·</span>}
                {params.sort && (
                  <span className="ml-1 text-xs text-accent">
                    {SORT_OPTIONS.find((o) => o.key === params.sort!.key)?.label}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56">
              <div className="space-y-2">
                <p className="text-sm font-medium text-fg">Sort by</p>
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setSort(option.key)}
                    className={cn(
                      'w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface transition-colors text-left',
                      params.sort?.key === option.key && 'bg-surface2'
                    )}
                  >
                    <span className="text-sm text-fg">{option.label}</span>
                    {params.sort?.key === option.key && (
                      <span className="text-xs text-muted">{params.sort.dir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Clear Filters */}
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="shrink-0">
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="max-md:hidden"
            onClick={onRefreshPricing}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Pricing'}
          </Button>
          <Button variant="outline" size="sm" className="max-md:hidden" onClick={onBulkImport}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button variant="outline" size="sm" className="max-md:hidden" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm" onClick={onQuickAdd} className="max-md:w-full">
            <Plus className="h-4 w-4 mr-2" />
            Quick Add
          </Button>
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {params.status?.map((status) => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface2 border border-border text-xs text-fg hover:bg-surface transition-colors"
            >
              <span>{STATUS_OPTIONS.find((o) => o.value === status)?.label}</span>
              <X className="h-3 w-3" />
            </button>
          ))}
          {params.brand?.map((brand) => (
            <button
              key={brand}
              onClick={() => toggleBrand(brand)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface2 border border-border text-xs text-fg hover:bg-surface transition-colors"
            >
              <span>{brand}</span>
              <X className="h-3 w-3" />
            </button>
          ))}
          {params.size_uk?.map((size) => (
            <button
              key={size}
              onClick={() => toggleSize(String(size))}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface2 border border-border text-xs text-fg hover:bg-surface transition-colors"
            >
              <span>UK {size}</span>
              <X className="h-3 w-3" />
            </button>
          ))}
          {params.search && (
            <button
              onClick={() => {
                setSearch('')
                setSearchDebounced('')
                onParamsChange({ ...params, search: undefined })
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface2 border border-border text-xs text-fg hover:bg-surface transition-colors"
            >
              <span>"{params.search}"</span>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
