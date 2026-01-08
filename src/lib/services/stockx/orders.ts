/**
 * StockX Orders Service
 * Handles order/sales operations for fulfilled listings
 *
 * Key endpoints (all use /v2/ prefix like other selling endpoints):
 * - GET /v2/selling/orders/active - List active orders
 * - GET /v2/selling/orders/history - List historical orders
 * - GET /v2/selling/orders/{orderNumber} - Get order details
 */

import { getStockxClient } from './client'
import { withStockxRetry } from './retry'

// Active order statuses
export type ActiveOrderStatus =
  | 'CREATED'
  | 'CCAUTHORIZATIONFAILED'
  | 'SHIPPED'
  | 'RECEIVED'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'PAYOUTPENDING'
  | 'PAYOUTCOMPLETED'
  | 'SYSTEMFULFILLED'
  | 'PAYOUTFAILED'
  | 'SUSPENDED'
  | 'PENDING'

// Historical order statuses
export type HistoricalOrderStatus =
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DELIVERED'

export type OrderStatus = ActiveOrderStatus | HistoricalOrderStatus | string

export interface Order {
  askId: string
  orderNumber: string
  listingId: string | null
  amount: string
  currencyCode: string | null
  createdAt: string | null
  updatedAt: string | null
  variant: {
    variantId: string
    variantName: string
    variantValue: string | null
  }
  product: {
    productId: string
    productName: string | null
    styleId: string | null
  }
  status: OrderStatus
  shipment: {
    shipByDate: string | null
    trackingNumber: string | null
    trackingUrl: string | null
    carrierCode: string | null
    shippingLabelUrl: string | null
    shippingDocumentUrl: string | null
  } | null
  initiatedShipments?: {
    inbound: {
      displayId: string
      inventoryType: 'STANDARD' | 'FLEX' | 'DFS' | 'DIRECT'
    }
  } | null
  authenticationDetails?: {
    status: string | null
    failureNotes: string | null
  } | null
  payout?: {
    totalPayout: string
    salePrice: string
    totalAdjustments: string
    currencyCode: string
    adjustments: Array<{
      adjustmentType: string
      amount: string
      percentage: string
    }>
  } | null
}

/**
 * Map raw API status to UI-friendly tab
 */
export type OrderTab = 'needs_shipping' | 'in_progress' | 'completed'

export function getOrderTab(status: OrderStatus): OrderTab {
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

export class StockxOrdersService {
  private client

  constructor(userId: string) {
    this.client = getStockxClient(userId)
  }

  /**
   * Get all orders (active or historical)
   * GET /v2/selling/orders/active or /v2/selling/orders/history
   * Note: All StockX selling endpoints use /v2/ prefix
   */
  async getOrders(
    status: 'ACTIVE' | 'HISTORICAL' = 'ACTIVE',
    pageSize = 100
  ): Promise<Order[]> {
    console.log('[StockX Orders] Fetching orders:', { status, pageSize })

    // All selling endpoints use /v2/ prefix (same as listings, batch, etc.)
    const endpoint = status === 'ACTIVE'
      ? `/v2/selling/orders/active?pageSize=${pageSize}`
      : `/v2/selling/orders/history?pageSize=${pageSize}`

    const response = await withStockxRetry(
      () =>
        this.client.request<{ orders: Order[] }>(
          endpoint,
          { method: 'GET' }
        ),
      { label: `Get ${status} orders` }
    )

    return response.orders || []
  }

  /**
   * Get single order details by order number
   * GET /v2/selling/orders/{orderNumber}
   */
  async getOrder(orderNumber: string): Promise<Order> {
    console.log('[StockX Orders] Fetching order:', orderNumber)

    const response = await withStockxRetry(
      () =>
        this.client.request<Order>(`/v2/selling/orders/${orderNumber}`, {
          method: 'GET',
        }),
      { label: `Get order: ${orderNumber}` }
    )

    return response
  }

  /**
   * Get shipping label/document for an order
   * GET /v2/selling/orders/{orderNumber}/shipping-document/{shippingId}
   *
   * Returns PDF by default
   */
  async getShippingDocument(
    orderNumber: string,
    shippingId: string
  ): Promise<Blob> {
    const endpoint = `/v2/selling/orders/${orderNumber}/shipping-document/${shippingId}`
    console.log('[StockX Orders] Fetching shipping document:', {
      orderNumber,
      shippingId,
      fullEndpoint: endpoint,
      fullUrl: `https://api.stockx.com${endpoint}`,
    })

    const response = await withStockxRetry(
      () =>
        this.client.request<Blob>(
          endpoint,
          {
            method: 'GET',
            headers: {
              Accept: 'application/pdf',
            },
          }
        ),
      { label: `Get shipping label: ${orderNumber}/${shippingId}` }
    )

    console.log('[StockX Orders] Shipping document response type:', typeof response, response instanceof Blob ? 'is Blob' : 'not Blob')

    return response
  }

  /**
   * Get active orders (orders awaiting shipment)
   */
  async getActiveOrders(): Promise<Order[]> {
    return this.getOrders('ACTIVE')
  }

  /**
   * Get historical orders (completed/delivered orders)
   */
  async getHistoricalOrders(): Promise<Order[]> {
    return this.getOrders('HISTORICAL')
  }
}

/**
 * Get orders service instance
 */
export function getOrdersService(userId: string): StockxOrdersService {
  return new StockxOrdersService(userId)
}
