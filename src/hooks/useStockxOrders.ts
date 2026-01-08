'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Order, OrderStatus, OrderTab } from '@/lib/services/stockx/orders'

export interface UseStockxOrdersOptions {
  tab?: OrderTab
  autoRefresh?: boolean
  refreshInterval?: number // ms
}

export interface OrdersState {
  orders: Order[]
  loading: boolean
  error: string | null
  errorCode: 'mock_mode' | 'not_connected' | 'api_error' | null
  lastSyncedAt: string | null
  syncing: boolean
}

/**
 * Map API status to UI tab
 */
function getOrderTab(status: OrderStatus): OrderTab {
  switch (status) {
    // Needs shipping - order created, waiting for seller to ship
    case 'CREATED':
    case 'PENDING':
    case 'CCAUTHORIZATIONFAILED':
      return 'needs_shipping'
    // In progress - shipped, at StockX for authentication
    case 'SHIPPED':
    case 'RECEIVED':
    case 'AUTHENTICATING':
    case 'AUTHENTICATED':
    case 'PAYOUTPENDING':
      return 'in_progress'
    // Completed - done or failed states
    case 'PAYOUTCOMPLETED':
    case 'SYSTEMFULFILLED':
    case 'COMPLETED':
    case 'DELIVERED':
    case 'CANCELLED':
    case 'PAYOUTFAILED':
    case 'SUSPENDED':
      return 'completed'
    default:
      return 'needs_shipping'
  }
}

/**
 * Hook for fetching and managing StockX orders
 */
export function useStockxOrders(options: UseStockxOrdersOptions = {}) {
  const { tab = 'needs_shipping', autoRefresh = false, refreshInterval = 60000 } = options

  const [state, setState] = useState<OrdersState>({
    orders: [],
    loading: true,
    error: null,
    errorCode: null,
    lastSyncedAt: null,
    syncing: false,
  })

  // Fetch full order details (has payout, shipByDate, etc.)
  const fetchOrderDetails = useCallback(async (orderNumber: string): Promise<Order | null> => {
    try {
      const res = await fetch(`/api/stockx/orders/${orderNumber}`)
      if (res.ok) {
        const data = await res.json()
        return data.order
      }
    } catch (err) {
      console.error('[useStockxOrders] Failed to fetch order details:', orderNumber, err)
    }
    return null
  }, [])

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null, errorCode: null }))

    try {
      // Fetch both active and historical in parallel
      const [activeRes, historicalRes] = await Promise.all([
        fetch('/api/stockx/orders?status=ACTIVE'),
        fetch('/api/stockx/orders?status=HISTORICAL'),
      ])

      // Determine error code from response status
      const failedRes = !activeRes.ok ? activeRes : !historicalRes.ok ? historicalRes : null

      if (failedRes) {
        const errorData = await failedRes.json().catch(() => ({}))

        // Detect specific error types
        let errorCode: OrdersState['errorCode'] = 'api_error'
        if (failedRes.status === 503 || errorData.code === 'MOCK_MODE') {
          errorCode = 'mock_mode'
        } else if (failedRes.status === 401 || errorData.code === 'NOT_CONNECTED') {
          errorCode = 'not_connected'
        }

        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorData.error || 'Failed to fetch orders',
          errorCode,
        }))
        return
      }

      const activeData = await activeRes.json()
      const historicalData = await historicalRes.json()

      let allOrders: Order[] = [
        ...(activeData.orders || []),
        ...(historicalData.orders || []),
      ]

      // Fetch full details for orders that need shipping (to get payout, shipByDate)
      // The list endpoint doesn't return these fields
      const ordersNeedingDetails = allOrders.filter(
        (o) => o.status === 'CREATED' || o.status === 'PENDING'
      )

      if (ordersNeedingDetails.length > 0) {
        console.log('[useStockxOrders] Fetching full details for', ordersNeedingDetails.length, 'orders')
        const detailPromises = ordersNeedingDetails.map((o) => fetchOrderDetails(o.orderNumber))
        const details = await Promise.all(detailPromises)

        // Merge detailed data into orders
        allOrders = allOrders.map((order) => {
          const detail = details.find((d) => d?.orderNumber === order.orderNumber)
          if (detail) {
            return { ...order, ...detail }
          }
          return order
        })
      }

      setState((prev) => ({
        ...prev,
        orders: allOrders,
        loading: false,
        errorCode: null,
        lastSyncedAt: new Date().toISOString(),
      }))
    } catch (err: any) {
      console.error('[useStockxOrders] Error:', err)
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to fetch orders',
        errorCode: 'api_error',
      }))
    }
  }, [fetchOrderDetails])

  // Sync orders (trigger fresh fetch from StockX API)
  const syncOrders = useCallback(async () => {
    setState((prev) => ({ ...prev, syncing: true, error: null }))

    try {
      const response = await fetch('/api/stockx/orders/sync', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to sync orders')
      }

      const data = await response.json()

      // Refetch after sync
      await fetchOrders()

      return data
    } catch (err: any) {
      console.error('[useStockxOrders] Sync error:', err)
      setState((prev) => ({
        ...prev,
        syncing: false,
        error: err.message || 'Failed to sync orders',
      }))
      throw err
    } finally {
      setState((prev) => ({ ...prev, syncing: false }))
    }
  }, [fetchOrders])

  // Download shipping label
  // Fetches full order details if needed to get shipping info
  const downloadLabel = useCallback(async (orderNumber: string, shippingId?: string) => {
    try {
      // Try to find order in local state first
      let order = state.orders.find(o => o.orderNumber === orderNumber)

      // Get shipping URLs from order
      let pdfUrl = order?.shipment?.shippingDocumentUrl
      let pngUrl = order?.shipment?.shippingLabelUrl

      // If no shipping info in cached order, fetch full details from API
      if (!pdfUrl && !pngUrl) {
        console.log('[useStockxOrders] Fetching full order details for shipping info')
        const detailsRes = await fetch(`/api/stockx/orders/${orderNumber}`)
        if (detailsRes.ok) {
          const detailsData = await detailsRes.json()
          const fullOrder = detailsData.order
          if (fullOrder) {
            pdfUrl = fullOrder.shipment?.shippingDocumentUrl
            pngUrl = fullOrder.shipment?.shippingLabelUrl
            console.log('[useStockxOrders] Full order shipping info:', {
              pdfUrl,
              pngUrl,
              shipment: fullOrder.shipment,
            })
          }
        }
      }

      let blob: Blob
      let filename: string

      // Extract shippingId from shippingDocumentUrl and use our API (handles auth)
      // URL format: https://api.stockx.com/v2/selling/orders/{orderNumber}/shipping-document/{shippingId}
      if (pdfUrl) {
        const urlParts = pdfUrl.split('/shipping-document/')
        const extractedShippingId = urlParts[1] || shippingId

        if (extractedShippingId) {
          console.log('[useStockxOrders] Downloading PDF via API:', {
            orderNumber,
            shippingId: extractedShippingId,
          })

          // Use our API endpoint which adds auth headers
          const response = await fetch(
            `/api/stockx/orders/${orderNumber}/shipping-label?shippingId=${extractedShippingId}`
          )

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || `Failed to download PDF: ${response.status}`)
          }

          blob = await response.blob()
          filename = `stockx-label-${orderNumber}.pdf`
        } else {
          throw new Error('Could not extract shipping ID from URL')
        }
      } else if (pngUrl) {
        // Use PNG label URL directly (pre-signed, no auth needed)
        console.log('[useStockxOrders] Downloading PNG from:', pngUrl)
        const response = await fetch(pngUrl)
        if (!response.ok) {
          throw new Error(`Failed to download PNG: ${response.status}`)
        }
        blob = await response.blob()
        filename = `stockx-label-${orderNumber}.png`
      } else {
        throw new Error('Shipping label not found. Please try downloading from StockX directly.')
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      return true
    } catch (err: any) {
      console.error('[useStockxOrders] Download label error:', err)
      throw err
    }
  }, [state.orders])

  // Auto mark sold for completed orders
  const autoMarkSold = useCallback(async () => {
    try {
      const response = await fetch('/api/stockx/orders/auto-mark-sold', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to auto mark sold')
      }

      const data = await response.json()

      // Refetch orders to update state
      await fetchOrders()

      return data.result
    } catch (err: any) {
      console.error('[useStockxOrders] Auto mark sold error:', err)
      throw err
    }
  }, [fetchOrders])

  // Filter orders by tab
  const filteredOrders = useMemo(() => {
    return state.orders.filter((order) => getOrderTab(order.status) === tab)
  }, [state.orders, tab])

  // Count orders by tab
  const counts = useMemo(() => {
    const result = {
      needs_shipping: 0,
      in_progress: 0,
      completed: 0,
    }

    for (const order of state.orders) {
      const orderTab = getOrderTab(order.status)
      result[orderTab]++
    }

    return result
  }, [state.orders])

  // Initial fetch
  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchOrders()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchOrders])

  return {
    orders: filteredOrders,
    allOrders: state.orders,
    loading: state.loading,
    error: state.error,
    errorCode: state.errorCode,
    syncing: state.syncing,
    lastSyncedAt: state.lastSyncedAt,
    counts,
    refetch: fetchOrders,
    syncOrders,
    downloadLabel,
    autoMarkSold,
  }
}
