'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

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

      // Fetch user's listings with enrichment
      let query = supabase
        .from('stockx_listings')
        .select(`
          id,
          user_id,
          stockx_listing_id,
          stockx_product_id,
          stockx_variant_id,
          product_id,
          variant_id,
          amount,
          currency_code,
          status,
          expires_at,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      // Enrich with market data, inventory, and pending operations
      const enrichedListings = await Promise.all(
        (data || []).map(async (listing: any) => {
          // Convert amount (cents) to ask_price (dollars)
          const askPrice = listing.amount / 100

          // Fetch inventory data via inventory_market_links
          const { data: linkData } = await supabase
            .from('inventory_market_links')
            .select(`
              item_id,
              Inventory (
                sku,
                size_uk,
                image_url,
                brand,
                model,
                colorway
              )
            `)
            .eq('stockx_product_id', listing.stockx_product_id)
            .eq('stockx_variant_id', listing.stockx_variant_id)
            .single()

          const inventory = linkData?.Inventory
          const inventoryId = linkData?.item_id

          // Fetch market price for this listing
          const { data: marketPrice } = await supabase
            .from('stockx_market_latest')
            .select('lowest_ask, highest_bid')
            .eq('stockx_product_id', listing.stockx_product_id)
            .eq('stockx_variant_id', listing.stockx_variant_id)
            .eq('currency_code', listing.currency_code)
            .single()

          // Check for pending operations
          const { data: pendingJob } = await supabase
            .from('stockx_batch_jobs')
            .select('id, job_type, status, error_message')
            .eq('user_id', listing.user_id)
            .in('status', ['PENDING', 'IN_PROGRESS'])
            .contains('metadata', { listingId: listing.stockx_listing_id })
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          // PHASE 3.3: Market price = highest_bid ?? lowest_ask ?? null
          const computedMarketPrice = marketPrice?.highest_bid ?? marketPrice?.lowest_ask ?? null

          return {
            ...listing,
            ask_price: askPrice,
            inventory_id: inventoryId,
            sku: inventory?.sku,
            size_uk: inventory?.size_uk,
            image_url: inventory?.image_url,
            product_name: inventory ? `${inventory.brand || ''} ${inventory.model || ''}`.trim() : undefined,
            market_price: computedMarketPrice,
            market_lowest_ask: marketPrice?.lowest_ask,
            market_highest_bid: marketPrice?.highest_bid,
            pending_operation: pendingJob ? {
              job_id: pendingJob.id,
              job_type: pendingJob.job_type,
              status: pendingJob.status,
              error_message: pendingJob.error_message,
            } : undefined,
          }
        })
      )

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
        throw new Error(data.error || 'Failed to create listing')
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
        throw new Error(data.error || 'Failed to update listing')
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
        throw new Error(data.error || 'Failed to delete listing')
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
        throw new Error(data.error || 'Failed to activate listing')
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
      const response = await fetch('/api/stockx/listings/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      })

      // Check if response has content before parsing JSON
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        // Provide more specific error messages
        const errorMsg = data.error || 'Failed to delete listing'

        // Check for common StockX API errors
        if (errorMsg.includes('can not perform this action') || response.status === 400) {
          throw new Error('This listing cannot be deleted. It may already be sold, inactive, or in a pending state. Try refreshing the page to see the current status.')
        }

        throw new Error(errorMsg)
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
