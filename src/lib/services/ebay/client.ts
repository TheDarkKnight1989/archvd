/**
 * eBay API Client
 * Handles OAuth client credentials flow and sold item searches via Browse API
 */

import {
  EbaySoldItem,
  EbaySoldSearchOptions,
  EbaySoldSearchResult,
  EbayItemDetails,
} from './types'
import { ebayConfig } from './config'

// ============================================================================
// Token Cache (shared across all instances)
// ============================================================================

let cachedAccessToken: string | null = null
let tokenExpiresAt: number = 0

// ============================================================================
// eBay Client
// ============================================================================

export class EbayClient {
  private readonly baseUrl: string
  private readonly tokenUrl: string

  constructor() {
    const isProd = ebayConfig.env === 'PRODUCTION'
    this.baseUrl = isProd ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com'
    this.tokenUrl = `${this.baseUrl}/identity/v1/oauth2/token`
  }

  /**
   * Get valid OAuth access token (cached, refreshed when expired)
   * Uses client credentials flow
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
      return cachedAccessToken
    }

    console.log('[eBay] Fetching new OAuth access token via client credentials')

    if (!ebayConfig.clientId || !ebayConfig.clientSecret) {
      throw new Error('[eBay] Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET')
    }

    try {
      // eBay requires Basic Auth with base64-encoded client_id:client_secret
      const credentials = Buffer.from(
        `${ebayConfig.clientId}:${ebayConfig.clientSecret}`
      ).toString('base64')

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'https://api.ebay.com/oauth/api_scope',
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[eBay] OAuth token request failed', {
          status: response.status,
          error,
        })
        throw new Error(`eBay OAuth failed: ${response.status} ${error}`)
      }

      const data = await response.json()
      cachedAccessToken = data.access_token
      const expiresIn = data.expires_in || 7200 // eBay tokens typically last 2 hours
      tokenExpiresAt = Date.now() + expiresIn * 1000

      console.log('[eBay] OAuth token obtained', {
        expiresIn: `${expiresIn}s (${Math.floor(expiresIn / 3600)}h)`,
        expiresAt: new Date(tokenExpiresAt).toISOString(),
      })

      return cachedAccessToken
    } catch (error) {
      console.error('[eBay] Failed to get OAuth token', error)
      throw error
    }
  }

  /**
   * Get full item details by item ID
   * https://developer.ebay.com/api-docs/buy/browse/resources/item/methods/getItem
   *
   * Returns complete item details including:
   * - variations[] with size-specific data
   * - shippingOptions[] with shipping costs
   * - seller info (feedbackScore, feedbackPercentage)
   * - authenticityVerification details
   */
  async getItemDetails(itemId: string, marketplaceId: string = 'EBAY_GB'): Promise<EbayItemDetails | null> {
    // Short-circuit if disabled
    if (!ebayConfig.marketDataEnabled) {
      console.info('[eBay] market data disabled, returning null')
      return null
    }

    const token = await this.getAccessToken()
    const url = `${this.baseUrl}/buy/browse/v1/item/${itemId}`

    console.log('[eBay] Fetching item details', { itemId, marketplaceId })

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        },
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[eBay] Item details request failed', {
          itemId,
          status: response.status,
          error,
        })
        return null
      }

      const data = await response.json()

      // Map to EbayItemDetails
      const itemDetails: EbayItemDetails = {
        itemId: data.itemId || itemId,
        title: data.title || '',
        price: {
          value: data.price?.value || '0',
          currency: data.price?.currency || 'GBP',
        },
        condition: data.condition,
        conditionDescription: data.conditionDescription,
        categoryId: data.categoryId,
        image: data.image ? { imageUrl: data.image.imageUrl } : undefined,
        additionalImages: data.additionalImages,
        itemEndDate: data.itemEndDate,
        localizedAspects: data.localizedAspects,
        variations: data.variations,
        shippingOptions: data.shippingOptions,
        seller: data.seller,
        // Map authenticityGuarantee to authenticityVerification
        authenticityVerification: data.authenticityGuarantee
          ? {
              description: data.authenticityGuarantee.description,
              type: 'AUTHENTICITY_GUARANTEE',
            }
          : data.qualifiedPrograms?.includes('AUTHENTICITY_GUARANTEE')
            ? { type: 'AUTHENTICITY_GUARANTEE' }
            : undefined,
      }

      console.log('[eBay] Item details fetched', {
        itemId,
        hasVariations: !!data.variations,
        variationsCount: data.variations?.length || 0,
        hasShipping: !!data.shippingOptions,
        hasSeller: !!data.seller,
      })

      return itemDetails
    } catch (error) {
      console.error('[eBay] Item details error', { itemId, error })
      return null
    }
  }

  /**
   * Search for sold items via eBay Browse API
   * https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search
   */
  async searchSold(options: EbaySoldSearchOptions): Promise<EbaySoldSearchResult> {
    // Short-circuit if disabled
    if (!ebayConfig.marketDataEnabled) {
      console.info('[eBay] market data disabled, returning empty result')
      return { items: [], totalFetched: 0, fullDetailsFetched: 0 }
    }

    const token = await this.getAccessToken()
    const limit = options.limit ?? 50
    const fetchFullDetails = options.fetchFullDetails ?? false

    // Build filters array
    const filters: string[] = []

    // Sold items filter (default true for backward compatibility)
    if (options.soldItemsOnly !== false) {
      filters.push('soldItemsOnly:true')
    }

    // Condition filter (e.g., NEW = 1000)
    if (options.conditionIds && options.conditionIds.length > 0) {
      filters.push(`conditionIds:{${options.conditionIds.join('|')}}`)
    }

    // Category filter (e.g., athletic sneakers)
    if (options.categoryIds && options.categoryIds.length > 0) {
      filters.push(`categoryIds:{${options.categoryIds.join('|')}}`)
    }

    // Qualified programs filter (e.g., AUTHENTICITY_GUARANTEE)
    // NOTE: AUTHENTICITY_GUARANTEE requires deliveryCountry AND deliveryPostalCode
    if (options.qualifiedPrograms && options.qualifiedPrograms.length > 0) {
      filters.push(`qualifiedPrograms:{${options.qualifiedPrograms.join('|')}}`)
      // eBay requires deliveryCountry and deliveryPostalCode for AUTHENTICITY_GUARANTEE
      // TODO: make these configurable based on user location
      filters.push('deliveryCountry:GB')
      filters.push('deliveryPostalCode:SW1A1AA') // London postal code
    }

    // Build the search URL with filters
    const url = new URL(`${this.baseUrl}/buy/browse/v1/item_summary/search`)
    url.searchParams.set('q', options.query)
    if (filters.length > 0) {
      url.searchParams.set('filter', filters.join(','))
    }
    url.searchParams.set('limit', String(limit))

    console.log('[eBay] Searching sold items', {
      query: options.query,
      limit,
      fetchFullDetails,
      url: url.toString(),
    })

    try {
      // STEP 1: Fetch item summaries
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_GB', // TODO: make configurable per market
        },
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[eBay] Search request failed', {
          status: response.status,
          error,
        })
        // Return empty result instead of throwing (graceful degradation)
        return { items: [], totalFetched: 0, fullDetailsFetched: 0 }
      }

      const data = await response.json()

      // Map eBay response to our EbaySoldItem format (basic info only)
      const items: EbaySoldItem[] = (data.itemSummaries || []).map((item: any) => ({
        itemId: item.itemId || '',
        title: item.title || '',
        price: parseFloat(item.price?.value || '0'),
        currency: item.price?.currency || 'GBP',
        soldAt: item.itemEndDate || new Date().toISOString(),
        conditionId: item.conditionId ? parseInt(item.conditionId) : undefined,
        categoryId: item.categoryId,
        // Check qualifiedPrograms for AG in summary
        authenticityVerification:
          item.qualifiedPrograms?.includes('AUTHENTICITY_GUARANTEE')
            ? { type: 'AUTHENTICITY_GUARANTEE' }
            : undefined,
      }))

      console.log('[eBay] Search completed (step 1)', {
        query: options.query,
        itemsFound: items.length,
      })

      // STEP 2: Optionally fetch full details for each item
      let fullDetailsFetched = 0

      if (fetchFullDetails && items.length > 0) {
        console.log(`[eBay] Fetching full details for ${items.length} items...`)

        // Fetch details for each item (sequentially to avoid rate limiting)
        for (const item of items) {
          const details = await this.getItemDetails(item.itemId, 'EBAY_GB')

          if (details) {
            // Enrich the item with full details (overwrite with full details if present)
            item.variations = details.variations
            item.shippingOptions = details.shippingOptions
            item.seller = details.seller
            // CRITICAL: Copy localizedAspects for size detection in AG listings
            ;(item as any).localizedAspects = details.localizedAspects
            // Use full details AG info if available, fallback to summary
            if (details.authenticityVerification) {
              item.authenticityVerification = details.authenticityVerification
            }
            fullDetailsFetched++
          }

          // Small delay to avoid rate limiting (200ms = 5 requests/sec)
          await new Promise((resolve) => setTimeout(resolve, 200))
        }

        console.log('[eBay] Full details fetch completed', {
          totalItems: items.length,
          detailsFetched: fullDetailsFetched,
          successRate: `${((fullDetailsFetched / items.length) * 100).toFixed(1)}%`,
        })
      }

      return {
        items,
        totalFetched: items.length,
        fullDetailsFetched,
      }
    } catch (error) {
      console.error('[eBay] Search error', error)
      // Return empty result for graceful degradation
      return { items: [], totalFetched: 0, fullDetailsFetched: 0 }
    }
  }
}
