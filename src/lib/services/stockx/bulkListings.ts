/**
 * Bulk StockX Listing Operations
 * Fans out to individual endpoints using Promise.allSettled
 */

export interface BulkListingItem {
  id: string
  stockxListingId: string | null
  sku: string
  productName: string
}

export interface BulkOperationProgress {
  total: number
  processed: number
  successful: number
  failed: number
  errors: string[]
}

type ProgressCallback = (progress: BulkOperationProgress) => void

/**
 * Bulk pause (deactivate) StockX listings
 * Calls individual deactivate endpoint for each listing
 */
export async function bulkPauseListings(
  items: BulkListingItem[],
  onProgress?: ProgressCallback
): Promise<BulkOperationProgress> {
  const progress: BulkOperationProgress = {
    total: items.length,
    processed: 0,
    successful: 0,
    failed: 0,
    errors: []
  }

  const results = await Promise.allSettled(
    items.map(async (item) => {
      if (!item.stockxListingId) {
        throw new Error('No StockX listing ID')
      }

      const response = await fetch('/api/stockx/listings/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: item.stockxListingId })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error || error.details || `HTTP ${response.status}`)
      }

      return response.json()
    })
  )

  // Process results
  results.forEach((result, index) => {
    progress.processed++

    if (result.status === 'fulfilled') {
      progress.successful++
    } else {
      progress.failed++
      const item = items[index]
      progress.errors.push(`${item.sku}: ${result.reason.message}`)
    }

    if (onProgress) {
      onProgress({ ...progress })
    }
  })

  return progress
}

/**
 * Bulk activate StockX listings
 * Calls individual activate endpoint for each listing
 */
export async function bulkActivateListings(
  items: BulkListingItem[],
  onProgress?: ProgressCallback
): Promise<BulkOperationProgress> {
  const progress: BulkOperationProgress = {
    total: items.length,
    processed: 0,
    successful: 0,
    failed: 0,
    errors: []
  }

  const results = await Promise.allSettled(
    items.map(async (item) => {
      if (!item.stockxListingId) {
        throw new Error('No StockX listing ID')
      }

      const response = await fetch('/api/stockx/listings/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: item.stockxListingId })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error || error.details || `HTTP ${response.status}`)
      }

      return response.json()
    })
  )

  // Process results
  results.forEach((result, index) => {
    progress.processed++

    if (result.status === 'fulfilled') {
      progress.successful++
    } else {
      progress.failed++
      const item = items[index]
      progress.errors.push(`${item.sku}: ${result.reason.message}`)
    }

    if (onProgress) {
      onProgress({ ...progress })
    }
  })

  return progress
}

/**
 * Bulk reprice (update) StockX listings
 * Calls individual update endpoint for each listing with the same ask price
 */
export async function bulkRepriceListings(
  items: BulkListingItem[],
  askPrice: number,
  onProgress?: ProgressCallback
): Promise<BulkOperationProgress> {
  const progress: BulkOperationProgress = {
    total: items.length,
    processed: 0,
    successful: 0,
    failed: 0,
    errors: []
  }

  const results = await Promise.allSettled(
    items.map(async (item) => {
      if (!item.stockxListingId) {
        throw new Error('No StockX listing ID')
      }

      const response = await fetch('/api/stockx/listings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: item.stockxListingId,
          askPrice,
          currencyCode: 'GBP'
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error || error.details || `HTTP ${response.status}`)
      }

      return response.json()
    })
  )

  // Process results
  results.forEach((result, index) => {
    progress.processed++

    if (result.status === 'fulfilled') {
      progress.successful++
    } else {
      progress.failed++
      const item = items[index]
      progress.errors.push(`${item.sku}: ${result.reason.message}`)
    }

    if (onProgress) {
      onProgress({ ...progress })
    }
  })

  return progress
}
