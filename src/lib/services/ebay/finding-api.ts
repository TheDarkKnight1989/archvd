/**
 * eBay Finding API Client
 * For searching completed/sold listings with proper sold dates
 * https://developer.ebay.com/devzone/finding/Concepts/FindingAPIGuide.html
 */

import { ebayConfig } from './config'
import { EbaySoldItem, EbaySoldSearchResult } from './types'

const FINDING_API_URL = 'https://svcs.ebay.com/services/search/FindingService/v1'

export interface FindingApiSearchOptions {
  keywords: string
  limit?: number
  conditionIds?: number[]
  categoryIds?: string[]
  authenticityGuaranteeOnly?: boolean
  marketplaceId?: string
}

/**
 * Search completed items using Finding API
 * This API provides proper sold dates (sellingStatus.endTime)
 */
export async function findCompletedItems(
  options: FindingApiSearchOptions
): Promise<EbaySoldSearchResult> {
  if (!ebayConfig.marketDataEnabled) {
    console.info('[eBay Finding API] market data disabled')
    return { items: [], totalFetched: 0, fullDetailsFetched: 0 }
  }

  if (!ebayConfig.clientId) {
    throw new Error('[eBay Finding API] Missing EBAY_CLIENT_ID')
  }

  const {
    keywords,
    limit = 100,
    conditionIds = [1000],
    categoryIds,
    authenticityGuaranteeOnly = true,
    marketplaceId = 'EBAY-GB',
  } = options

  // Build Finding API URL with parameters
  const url = new URL(FINDING_API_URL)
  url.searchParams.set('OPERATION-NAME', 'findCompletedItems')
  url.searchParams.set('SERVICE-VERSION', '1.13.0')
  url.searchParams.set('SECURITY-APPNAME', ebayConfig.clientId)
  url.searchParams.set('RESPONSE-DATA-FORMAT', 'JSON')
  url.searchParams.set('REST-PAYLOAD', '')
  url.searchParams.set('keywords', keywords)
  url.searchParams.set('paginationInput.entriesPerPage', String(Math.min(limit, 100)))
  url.searchParams.set('sortOrder', 'EndTimeSoonest') // Most recent first

  // Item filters
  let filterIndex = 0

  // Filter: Completed items only
  url.searchParams.set(`itemFilter(${filterIndex}).name`, 'SoldItemsOnly')
  url.searchParams.set(`itemFilter(${filterIndex}).value`, 'true')
  filterIndex++

  // Filter: Condition IDs
  url.searchParams.set(`itemFilter(${filterIndex}).name`, 'Condition')
  conditionIds.forEach((conditionId, i) => {
    url.searchParams.set(`itemFilter(${filterIndex}).value(${i})`, String(conditionId))
  })
  filterIndex++

  // Filter: Authenticity Guarantee
  if (authenticityGuaranteeOnly) {
    url.searchParams.set(`itemFilter(${filterIndex}).name`, 'AuthenticityVerificationProgram')
    url.searchParams.set(`itemFilter(${filterIndex}).value`, 'true')
    filterIndex++
  }

  // Filter: Categories
  if (categoryIds && categoryIds.length > 0) {
    categoryIds.forEach((categoryId, i) => {
      url.searchParams.set(`categoryId(${i})`, categoryId)
    })
  }

  console.log('[eBay Finding API] Searching:', {
    keywords,
    limit,
    url: url.toString().substring(0, 200) + '...',
  })

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-EBAY-SOA-GLOBAL-ID': marketplaceId,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[eBay Finding API] Request failed', {
        status: response.status,
        error,
      })
      return { items: [], totalFetched: 0, fullDetailsFetched: 0 }
    }

    const data = await response.json()

    // Check for API errors
    if (data.errorMessage) {
      console.error('[eBay Finding API] API error', data.errorMessage)
      return { items: [], totalFetched: 0, fullDetailsFetched: 0 }
    }

    // Extract items from Finding API response
    const searchResult = data.findCompletedItemsResponse?.[0]
    const items = searchResult?.searchResult?.[0]?.item || []

    console.log('[eBay Finding API] Found items:', items.length)

    // Map Finding API items to our format
    const mappedItems: EbaySoldItem[] = items.map((item: any) => {
      const sellingStatus = item.sellingStatus?.[0]
      const listingInfo = item.listingInfo?.[0]
      const shippingInfo = item.shippingInfo?.[0]

      return {
        itemId: item.itemId?.[0] || '',
        title: item.title?.[0] || '',
        price: parseFloat(sellingStatus?.currentPrice?.[0]?.__value__ || '0'),
        currency: sellingStatus?.currentPrice?.[0]?.['@currencyId'] || 'GBP',
        // THIS IS THE KEY FIX: Use endTime for actual sold date
        soldAt: listingInfo?.endTime?.[0] || new Date().toISOString(),
        conditionId: parseInt(item.condition?.[0]?.conditionId?.[0] || '0'),
        categoryId: item.primaryCategory?.[0]?.categoryId?.[0],
        // Finding API includes shipping in the response
        shippingCost: parseFloat(shippingInfo?.shippingServiceCost?.[0]?.__value__ || '0'),
        // Note: Finding API doesn't include detailed item aspects or variations
        // We'd need to fetch full details separately if needed
      }
    })

    return {
      items: mappedItems,
      totalFetched: mappedItems.length,
      fullDetailsFetched: 0, // Finding API doesn't include full details
    }
  } catch (error) {
    console.error('[eBay Finding API] Error', error)
    return { items: [], totalFetched: 0, fullDetailsFetched: 0 }
  }
}
