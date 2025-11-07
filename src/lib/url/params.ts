// URL parameter parsing and serialization for table filters

export type TableParams = {
  status?: string[]
  brand?: string[]
  size_uk?: (number | string)[]
  search?: string
  sort?: { key: 'created_at' | 'market_value' | 'pl' | 'plPct'; dir: 'asc' | 'desc' }
}

/**
 * Parse URLSearchParams into TableParams
 */
export function parseParams(searchParams: URLSearchParams): TableParams {
  const params: TableParams = {}

  // Parse status (multi)
  const statusStr = searchParams.get('status')
  if (statusStr) {
    params.status = statusStr.split(',').filter(Boolean)
  }

  // Parse brand (multi)
  const brandStr = searchParams.get('brand')
  if (brandStr) {
    params.brand = brandStr.split(',').filter(Boolean)
  }

  // Parse size_uk (multi)
  const sizeStr = searchParams.get('size_uk')
  if (sizeStr) {
    params.size_uk = sizeStr.split(',').filter(Boolean).map((s) => {
      const num = parseFloat(s)
      return isNaN(num) ? s : num
    })
  }

  // Parse search
  const search = searchParams.get('search')
  if (search?.trim()) {
    params.search = search.trim()
  }

  // Parse sort
  const sortStr = searchParams.get('sort')
  if (sortStr) {
    const [key, dir] = sortStr.split(':')
    if (
      key &&
      ['created_at', 'market_value', 'pl', 'plPct'].includes(key) &&
      ['asc', 'desc'].includes(dir)
    ) {
      params.sort = {
        key: key as 'created_at' | 'market_value' | 'pl' | 'plPct',
        dir: dir as 'asc' | 'desc',
      }
    }
  }

  return params
}

/**
 * Build query string from TableParams
 */
export function buildQuery(params: TableParams): string {
  const parts: string[] = []

  if (params.status && params.status.length > 0) {
    parts.push(`status=${params.status.join(',').trim()}`)
  }

  if (params.brand && params.brand.length > 0) {
    parts.push(`brand=${params.brand.join(',').trim()}`)
  }

  if (params.size_uk && params.size_uk.length > 0) {
    parts.push(`size_uk=${params.size_uk.join(',').trim()}`)
  }

  if (params.search?.trim()) {
    parts.push(`search=${encodeURIComponent(params.search.trim())}`)
  }

  if (params.sort) {
    parts.push(`sort=${params.sort.key}:${params.sort.dir}`)
  }

  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

/**
 * Check if any filters are active
 */
export function hasActiveFilters(params: TableParams): boolean {
  return !!(
    (params.status && params.status.length > 0) ||
    (params.brand && params.brand.length > 0) ||
    (params.size_uk && params.size_uk.length > 0) ||
    params.search
  )
}
