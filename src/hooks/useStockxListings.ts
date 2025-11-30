'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { calculateStockxNetPayout } from '@/lib/market/fees'

export interface StockxListing {
  id: string
  user_id: string
  stockx_listing_id: string
  stockx_product_id: string
  stockx_variant_id: string
  product_id: string
  variant_id: string
  amount: number // Price in cents
  currency_code: string
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'MATCHED' | 'COMPLETED' | 'DELETED' | 'EXPIRED'
  expires_at?: string
  created_at: string
  updated_at: string

  // Computed fields
  ask_price?: number // Computed from amount / 100

  // Enriched fields
  inventory_id?: string
  product_name?: string
  sku?: string
  size_uk?: string
  image_url?: string
  market_price?: number | null
  market_lowest_ask?: number
  market_highest_bid?: number
  position?: string | null // Position vs market: "Best ask", "+£50", "-£20", or null
  pending_operation?: {
    job_id: string
    job_type: string
    status: string
    error_message?: string
  }
}

export interface ListingFilters {
  status?: string[]
  search?: string
}

export function useStockxListings(filters?: ListingFilters) {
  const [listings, setListings] = useState<StockxListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchListings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setListings([])
        return
      }

      // Fetch listings from inventory_market_links (source of truth)
      // Only show listings that:
      // 1. Have a stockx_listing_id (are listed on StockX)
      // 2. Have an active status (not MISSING or UNKNOWN)
      let query = supabase
        .from('inventory_market_links')
        .select(`
          id,
          user_id,
          item_id,
          stockx_listing_id,
          stockx_product_id,
          stockx_variant_id,
          stockx_listing_status,
          stockx_last_listing_sync_at,
          stockx_listing_payload,
          created_at,
          updated_at,
          Inventory (
            id,
            sku,
            size_uk,
            image_url,
            brand,
            model,
            colorway
          )
        `)
        .eq('user_id', user.id)
        .not('stockx_listing_id', 'is', null)
        .order('updated_at', { ascending: false })

      // Apply status filter - exclude MISSING listings
      if (filters?.status && filters.status.length > 0) {
        // Map UI status to StockX API statuses
        const stockxStatuses = filters.status.map(s => {
          if (s === 'ACTIVE') return 'ACTIVE'
          if (s === 'PENDING') return 'PENDING'
          if (s === 'SOLD') return 'SOLD'
          if (s === 'EXPIRED') return 'EXPIRED'
          if (s === 'CANCELLED') return 'CANCELLED'
          return s
        })
        query = query.in('stockx_listing_status', stockxStatuses)
      } else {
        // By default, exclude MISSING and UNKNOWN listings
        query = query.not('stockx_listing_status', 'in', '(MISSING,UNKNOWN)')
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      if (!data || data.length === 0) {
        setListings([])
        return
      }

      // Manual inventory fetch (workaround until FK constraint is added)
      const itemIds = [...new Set(data.map(l => l.item_id).filter(Boolean))]
      const { data: inventoryItems } = await supabase
        .from('Inventory')
        .select('id, sku, size_uk, image_url, brand, model, colorway')
        .in('id', itemIds)

      // Build inventory lookup map
      const inventoryMap = new Map()
      inventoryItems?.forEach(item => {
        inventoryMap.set(item.id, item)
      })

      // BATCH QUERY 1: Fetch all market prices at once
      const { data: allMarketPrices } = await supabase
        .from('stockx_market_latest')
        .select('stockx_product_id, stockx_variant_id, currency_code, lowest_ask, highest_bid')
        .in('stockx_product_id', [...new Set(data.map(l => l.stockx_product_id))])

      // Build lookup map: "productId:variantId:currency" -> market data
      const marketMap = new Map<string, any>()
      allMarketPrices?.forEach(market => {
        // Use GBP as default currency for now
        const key = `${market.stockx_product_id}:${market.stockx_variant_id}:${market.currency_code}`
        marketMap.set(key, {
          lowest_ask: market.lowest_ask,
          highest_bid: market.highest_bid,
        })
      })

      // BATCH QUERY 2: Fetch all pending jobs for this user
      const { data: allJobs } = await supabase
        .from('stockx_batch_jobs')
        .select('id, job_type, status, error_message, metadata')
        .eq('user_id', user.id)
        .in('status', ['PENDING', 'IN_PROGRESS'])
        .order('created_at', { ascending: false })

      // Build lookup map: listingId -> pending job
      const jobsMap = new Map<string, any>()
      allJobs?.forEach(job => {
        const listingId = job.metadata?.listingId
        if (listingId && !jobsMap.has(listingId)) {
          jobsMap.set(listingId, {
            job_id: job.id,
            job_type: job.job_type,
            status: job.status,
            error_message: job.error_message,
          })
        }
      })

      // Transform data to match expected format
      const enrichedListings = data.map((link: any) => {
        // Extract price from payload if available
        const payload = link.stockx_listing_payload

        // DEBUG: Log payload structure to understand the data
        console.log('[useStockxListings] DEBUG - Listing:', {
          listingId: link.stockx_listing_id,
          hasPayload: !!payload,
          payloadType: typeof payload,
          payload: payload
        })

        if (payload) {
          console.log('[useStockxListings] Payload structure:', {
            listingId: link.stockx_listing_id,
            keys: Object.keys(payload),
            amount: payload?.amount,
            ask: payload?.ask,
            fullPayload: payload
          })
        } else {
          console.warn('[useStockxListings] WARNING: No payload for listing:', link.stockx_listing_id)
        }

        const amount = payload?.amount || payload?.ask?.amount || 0
        // Amount is already in base currency units (pounds), not pence
        // Calculate net payout after StockX 10% seller fee
        const grossPrice = parseFloat(amount)
        const askPrice = calculateStockxNetPayout(grossPrice)
        const currencyCode = payload?.currencyCode || payload?.ask?.currencyCode || 'GBP'

        console.log('[useStockxListings] Extracted price:', {
          listingId: link.stockx_listing_id,
          amount,
          grossPrice,
          askPrice,
          currencyCode,
          note: 'askPrice is net payout after 10% StockX fee'
        })

        // Get inventory details (use manual lookup map as workaround for FK join issue)
        const inventory = inventoryMap.get(link.item_id) || link.Inventory
        const productName = inventory ? `${inventory.brand || ''} ${inventory.model || ''}`.trim() : 'Unknown Product'

        // Lookup market price (try GBP first, fall back to USD)
        let marketKey = `${link.stockx_product_id}:${link.stockx_variant_id}:GBP`
        let marketPrice = marketMap.get(marketKey)
        if (!marketPrice) {
          marketKey = `${link.stockx_product_id}:${link.stockx_variant_id}:USD`
          marketPrice = marketMap.get(marketKey)
        }

        // Lookup pending job
        const pendingJob = jobsMap.get(link.stockx_listing_id)

        // Market price = highest_bid ?? lowest_ask ?? null
        const computedMarketPrice = marketPrice?.highest_bid ?? marketPrice?.lowest_ask ?? null

        // Calculate position: Compare my ask vs current lowest ask
        let position: string | null = null
        if (askPrice > 0 && marketPrice?.lowest_ask > 0) {
          if (askPrice === marketPrice.lowest_ask) {
            position = 'Best ask'
          } else if (askPrice > marketPrice.lowest_ask) {
            const diff = askPrice - marketPrice.lowest_ask
            position = `+£${diff.toFixed(0)}`
          } else {
            const diff = marketPrice.lowest_ask - askPrice
            position = `-£${diff.toFixed(0)}`
          }
        }

        return {
          id: link.id,
          user_id: link.user_id,
          stockx_listing_id: link.stockx_listing_id,
          stockx_product_id: link.stockx_product_id,
          stockx_variant_id: link.stockx_variant_id,
          product_id: link.stockx_product_id, // For compatibility
          variant_id: link.stockx_variant_id, // For compatibility
          amount,
          currency_code: currencyCode,
          status: link.stockx_listing_status,
          expires_at: payload?.expiresAt,
          created_at: link.created_at,
          updated_at: link.updated_at,

          // Computed fields
          ask_price: askPrice,

          // Enriched fields from inventory
          inventory_id: link.item_id,
          sku: inventory?.sku,
          size_uk: inventory?.size_uk,
          image_url: inventory?.image_url,
          product_name: productName,

          // Market data
          market_price: computedMarketPrice,
          market_lowest_ask: marketPrice?.lowest_ask,
          market_highest_bid: marketPrice?.highest_bid,
          position, // Position vs market (e.g., "Best ask", "+£50", "-£20")

          // Pending operations
          pending_operation: pendingJob,
        }
      })

      // Apply search filter if provided
      let filtered = enrichedListings
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase()
        filtered = enrichedListings.filter(listing =>
          listing.sku?.toLowerCase().includes(searchLower) ||
          listing.product_name?.toLowerCase().includes(searchLower) ||
          listing.stockx_listing_id?.toLowerCase().includes(searchLower)
        )
      }

      setListings(filtered)
    } catch (err: any) {
      console.error('[useStockxListings] Error:', err)
      setError(err.message || 'Failed to fetch listings')
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  return {
    listings,
    loading,
    error,
    refetch: fetchListings,
  }
}

/**
 * Hook for performing listing operations
 */
export function useListingOperations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createListing = async (params: {
    inventoryItemId: string
    askPrice: number
    currency?: string
    expiryDays?: number
  }) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stockx/listings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      const data = await response.json()

      if (!response.ok) {
        // Include details from API response for better error messages
        const errorMessage = data.details
          ? `${data.error}: ${data.details}`
          : (data.error || 'Failed to create listing')
        throw new Error(errorMessage)
      }

      return data
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const updateListing = async (params: {
    listingId: string
    askPrice?: number
    expiryDays?: number
  }) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stockx/listings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      const data = await response.json()

      if (!response.ok) {
        // Include details from API response for better error messages
        const errorMessage = data.details
          ? `${data.error}: ${data.details}`
          : (data.error || 'Failed to update listing')
        throw new Error(errorMessage)
      }

      return data
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const deleteListing = async (listingId: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stockx/listings/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Include details from API response for better error messages
        const errorMessage = data.details
          ? `${data.error}: ${data.details}`
          : (data.error || 'Failed to delete listing')
        throw new Error(errorMessage)
      }

      return data
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const activateListing = async (listingId: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stockx/listings/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Include details from API response for better error messages
        const errorMessage = data.details
          ? `${data.error}: ${data.details}`
          : (data.error || 'Failed to activate listing')
        throw new Error(errorMessage)
      }

      return data
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const deactivateListing = async (listingId: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stockx/listings/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Include details from API response for better error messages
        const errorMessage = data.details
          ? `${data.error}: ${data.details}`
          : (data.error || 'Failed to deactivate listing')
        throw new Error(errorMessage)
      }

      return data
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    createListing,
    updateListing,
    deleteListing,
    activateListing,
    deactivateListing,
    loading,
    error,
  }
}

/**
 * Calculate StockX fees (client-side utility)
 */
export function calculateListingFees(askPrice: number, sellerLevel: number = 1) {
  const SELLER_LEVEL_FEES: Record<number, number> = {
    1: 0.090, // 9.0%
    2: 0.085, // 8.5%
    3: 0.080, // 8.0%
    4: 0.075, // 7.5%
    5: 0.070, // 7.0%
  }

  const PROCESSING_FEE_RATE = 0.03 // 3.0%

  const transactionFeeRate = SELLER_LEVEL_FEES[sellerLevel] || SELLER_LEVEL_FEES[1]
  const transactionFee = Math.round(askPrice * transactionFeeRate * 100) / 100
  const processingFee = Math.round(askPrice * PROCESSING_FEE_RATE * 100) / 100
  const totalFee = transactionFee + processingFee
  const netPayout = askPrice - totalFee

  return {
    askPrice,
    transactionFee,
    transactionFeeRate,
    processingFee,
    processingFeeRate: PROCESSING_FEE_RATE,
    totalFee,
    netPayout,
    sellerLevel,
  }
}
