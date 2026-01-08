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

      const allOrders = [
        ...(activeData.orders || []),
        ...(historicalData.orders || []),
      ]

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
  }, [])

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
      let directUrl = order?.shipment?.shippingLabelUrl || order?.shipment?.shippingDocumentUrl
      let derivedShippingId = shippingId || order?.initiatedShipments?.inbound?.displayId

      // If no shipping info in cached order, fetch full details from API
      if (!directUrl && !derivedShippingId) {
        console.log('[useStockxOrders] Fetching full order details for shipping info')
        const detailsRes = await fetch(`/api/stockx/orders/${orderNumber}`)
        if (detailsRes.ok) {
          const detailsData = await detailsRes.json()
          const fullOrder = detailsData.order
          if (fullOrder) {
            directUrl = fullOrder.shipment?.shippingLabelUrl || fullOrder.shipment?.shippingDocumentUrl
            derivedShippingId = fullOrder.initiatedShipments?.inbound?.displayId
            console.log('[useStockxOrders] Full order shipping info:', {
              directUrl,
              derivedShippingId,
              shipment: fullOrder.shipment,
              initiatedShipments: fullOrder.initiatedShipments,
            })
          }
        }
      }

      let blob: Blob

      if (directUrl) {
        // Use direct URL from order data
        const response = await fetch(directUrl)
        if (!response.ok) {
          throw new Error('Failed to download label from direct URL')
        }
        blob = await response.blob()
      } else if (derivedShippingId) {
        // Use API endpoint with shippingId
        const response = await fetch(
          `/api/stockx/orders/${orderNumber}/shipping-label?shippingId=${derivedShippingId}`
        )
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to download label')
        }
        blob = await response.blob()
      } else {
        throw new Error('Shipping label not found. Please try downloading from StockX directly.')
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stockx-label-${orderNumber}.pdf`
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
