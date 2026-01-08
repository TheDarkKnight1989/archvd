'use client'

import { useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'
import { PRESET_PURCHASE_SOURCES } from '@/lib/inventory-v4/types'

// =============================================================================
// FILTER TYPES
// =============================================================================

export type PriceMode = 'standard' | 'consigned' | 'sell_now'
export type ProfitFilter = 'all' | 'profitable' | 'losing'
export type StatusFilter = 'all' | 'listed' | 'unlisted'
export type MarketPlatform = 'all' | 'stockx' | 'alias' | 'both'
export type Region = 'UK' | 'EU' | 'US'

export interface InventoryV4Filters {
  search: string
  status: StatusFilter
  platform: MarketPlatform
  region: Region
  priceMode: PriceMode
  source: string | 'all'
  profit: ProfitFilter
  sizes: string[]
  brands: string[]
  perPage: number
}

export const DEFAULT_FILTERS: InventoryV4Filters = {
  search: '',
  status: 'all',
  platform: 'all',
  region: 'UK',
  priceMode: 'standard',
  source: 'all',
  profit: 'all',
  sizes: [],
  brands: [],
  perPage: 25,
}

// =============================================================================
// PERSISTENCE HELPERS
// =============================================================================

const REGION_STORAGE_KEY = 'archvd_inventory_region'

/**
 * Load persisted region from localStorage.
 * Returns the stored region or the default if not found/invalid.
 */
export function loadPersistedRegion(): Region {
  if (typeof window === 'undefined') return DEFAULT_FILTERS.region
  try {
    const stored = localStorage.getItem(REGION_STORAGE_KEY)
    if (stored && ['UK', 'EU', 'US'].includes(stored)) {
      return stored as Region
    }
  } catch {
    // localStorage not available
  }
  return DEFAULT_FILTERS.region
}

/**
 * Save region to localStorage for persistence across sessions.
 */
export function persistRegion(region: Region): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(REGION_STORAGE_KEY, region)
  } catch {
    // localStorage not available
  }
}

// =============================================================================
// FILTER OPTIONS
// =============================================================================

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'listed', label: 'Listed' },
  { value: 'unlisted', label: 'Unlisted' },
]

const PLATFORM_OPTIONS: { value: MarketPlatform; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'stockx', label: 'StockX' },
  { value: 'alias', label: 'Alias' },
  { value: 'both', label: 'Both' },
]

const REGION_OPTIONS: { value: Region; label: string }[] = [
  { value: 'UK', label: 'UK' },
  { value: 'EU', label: 'EU' },
  { value: 'US', label: 'US' },
]

const PRICE_MODE_OPTIONS: { value: PriceMode; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'consigned', label: 'Consigned' },
  { value: 'sell_now', label: 'Sell Now' },
]

const PROFIT_OPTIONS: { value: ProfitFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'profitable', label: 'Profitable' },
  { value: 'losing', label: 'Losing' },
]

const PER_PAGE_OPTIONS = [25, 50, 100]

// =============================================================================
// TOOLBAR COMPONENT
// =============================================================================

interface InventoryV4ToolbarProps {
  filters: InventoryV4Filters
  onFiltersChange: (filters: InventoryV4Filters) => void
  availableBrands: string[]
  availableSizes: string[]
  customSources?: string[]
  totalItems?: number
  filteredItems?: number
  className?: string
}

export function InventoryV4Toolbar({
  filters,
  onFiltersChange,
  availableBrands,
  availableSizes,
  customSources = [],
  totalItems,
  filteredItems,
  className,
}: InventoryV4ToolbarProps) {
  // Count active filters
  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== '' ||
      filters.status !== 'all' ||
      filters.platform !== 'all' ||
      filters.region !== 'UK' ||
      filters.priceMode !== 'standard' ||
      filters.source !== 'all' ||
      filters.profit !== 'all' ||
      filters.sizes.length > 0 ||
      filters.brands.length > 0
    )
  }, [filters])

  const updateFilter = <K extends keyof InventoryV4Filters>(
    key: K,
    value: InventoryV4Filters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange(DEFAULT_FILTERS)
  }

  // All source options (presets + custom)
  const allSources = useMemo(() => {
    const sources = [...PRESET_PURCHASE_SOURCES] as string[]
    customSources.forEach((s) => {
      if (!sources.includes(s)) {
        sources.push(s)
      }
    })
    return sources
  }, [customSources])

  return (
    <div className={cn('space-y-2', className)}>
      {/* Row 1: Search, Status, Platform, Region, Price Mode */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-8 h-8 text-sm"
          />
          {filters.search && (
            <button
              onClick={() => updateFilter('search', '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status */}
        <Select
          value={filters.status}
          onValueChange={(v) => updateFilter('status', v as StatusFilter)}
        >
          <SelectTrigger className="w-[100px] h-8 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Platform */}
        <Select
          value={filters.platform}
          onValueChange={(v) => updateFilter('platform', v as MarketPlatform)}
        >
          <SelectTrigger className="w-[100px] h-8 text-sm">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            {PLATFORM_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Region */}
        <Select
          value={filters.region}
          onValueChange={(v) => updateFilter('region', v as Region)}
        >
          <SelectTrigger className="w-[80px] h-8 text-sm">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            {REGION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Price Mode */}
        <Select
          value={filters.priceMode}
          onValueChange={(v) => updateFilter('priceMode', v as PriceMode)}
        >
          <SelectTrigger className="w-[110px] h-8 text-sm">
            <SelectValue placeholder="Price Mode" />
          </SelectTrigger>
          <SelectContent>
            {PRICE_MODE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Spacer + Item count */}
        <div className="flex-1" />
        {filteredItems !== undefined && totalItems !== undefined && (
          <span className="text-xs text-muted-foreground">
            {filteredItems === totalItems
              ? `${totalItems} items`
              : `${filteredItems} of ${totalItems}`}
          </span>
        )}
      </div>

      {/* Row 2: Source, Profit, Size, Brand, Per Page, Clear */}
      <div className="flex items-center gap-2">
        {/* Source */}
        <Select
          value={filters.source}
          onValueChange={(v) => updateFilter('source', v)}
        >
          <SelectTrigger className="w-[130px] h-8 text-sm">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <DropdownMenuSeparator />
            {allSources.map((source) => (
              <SelectItem key={source} value={source}>
                {source}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Profit */}
        <Select
          value={filters.profit}
          onValueChange={(v) => updateFilter('profit', v as ProfitFilter)}
        >
          <SelectTrigger className="w-[100px] h-8 text-sm">
            <SelectValue placeholder="Profit" />
          </SelectTrigger>
          <SelectContent>
            {PROFIT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Size Multi-Select */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-sm gap-1 min-w-[80px]">
              Size
              {filters.sizes.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary/10 rounded">
                  {filters.sizes.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-32 max-h-64 overflow-y-auto">
            <DropdownMenuLabel className="text-xs">Filter by Size</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableSizes.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No sizes
              </div>
            ) : (
              availableSizes.map((size) => (
                <DropdownMenuCheckboxItem
                  key={size}
                  checked={filters.sizes.includes(size)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updateFilter('sizes', [...filters.sizes, size])
                    } else {
                      updateFilter('sizes', filters.sizes.filter((s) => s !== size))
                    }
                  }}
                >
                  {size}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Brand Multi-Select */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-sm gap-1 min-w-[80px]">
              Brand
              {filters.brands.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary/10 rounded">
                  {filters.brands.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-40 max-h-64 overflow-y-auto">
            <DropdownMenuLabel className="text-xs">Filter by Brand</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableBrands.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No brands
              </div>
            ) : (
              availableBrands.map((brand) => (
                <DropdownMenuCheckboxItem
                  key={brand}
                  checked={filters.brands.includes(brand)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updateFilter('brands', [...filters.brands, brand])
                    } else {
                      updateFilter('brands', filters.brands.filter((b) => b !== brand))
                    }
                  }}
                >
                  {brand}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Per Page */}
        <Select
          value={filters.perPage.toString()}
          onValueChange={(v) => updateFilter('perPage', parseInt(v))}
        >
          <SelectTrigger className="w-[70px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PER_PAGE_OPTIONS.map((n) => (
              <SelectItem key={n} value={n.toString()}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 text-sm text-muted-foreground hover:text-foreground"
          >
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  )
}
