/**
 * StockX Orders Service
 * Handles order/sales operations for fulfilled listings
 *
 * Key endpoints:
 * - GET /v2/selling/orders - List all orders (ACTIVE or HISTORICAL)
 * - GET /v2/selling/orders/{orderId} - Get order details
 * - GET /v2/selling/orders/{orderId}/shipping-document - Get shipping label
 */

import { getStockxClient } from './client'
import { withStockxRetry } from './retry'

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED'

export interface Order {
  orderId: string
  listingId: string
  productId: string
  variantId: string
  sku: string
  size: string
  amount: {
    amount: string
    currencyCode: string
  }
  payout: {
    amount: string
    currencyCode: string
    breakdown?: {
      commissionRate?: number
      commissionAmount?: string
      processingFee?: string
      adjustments?: Array<{
        type: string
        amount: string
        description: string
      }>
    }
  }
  status: OrderStatus
  createdAt: string
  updatedAt: string
  // Ship-by deadline (critical for sellers)
  shipByDate?: string
  // Product details (denormalized from catalog)
  product?: {
    title?: string
    brand?: string
    imageUrl?: string
    styleId?: string
  }
  buyer?: {
    userId?: string
    username?: string
    region?: string
    country?: string
  }
  shipping?: {
    carrier?: string
    trackingNumber?: string
    labelUrl?: string
    shippedAt?: string
    deliveredAt?: string
  }
}

/**
 * Map raw API status to UI-friendly tab
 */
export type OrderTab = 'needs_shipping' | 'in_progress' | 'completed'

export function getOrderTab(status: OrderStatus): OrderTab {
  switch (status) {
    case 'PENDING':
    case 'CONFIRMED':
      return 'needs_shipping'
    case 'IN_TRANSIT':
      return 'in_progress'
    case 'DELIVERED':
      return 'completed'
    case 'CANCELLED':
      return 'completed' // Show cancelled in completed tab
    default:
      return 'needs_shipping'
  }
}

export interface ShippingDocument {
  documentUrl: string
  documentType: 'PDF' | 'PNG'
  carrier: string
  trackingNumber: string
  expiresAt?: string
}

export class StockxOrdersService {
  private client

  constructor(userId: string) {
    this.client = getStockxClient(userId)
  }

  /**
   * Get all orders (active or historical)
   * GET /v2/selling/orders?status={status}
   */
  async getOrders(
    status: 'ACTIVE' | 'HISTORICAL' = 'ACTIVE',
    pageSize = 100
  ): Promise<Order[]> {
    console.log('[StockX Orders] Fetching orders:', { status, pageSize })

    const response = await withStockxRetry(
      () =>
        this.client.request<{ orders: Order[] }>(
          `/v2/selling/orders?status=${status}&pageSize=${pageSize}`,
          { method: 'GET' }
        ),
      { label: `Get ${status} orders` }
    )

    return response.orders || []
  }

  /**
   * Get single order details by ID
   * GET /v2/selling/orders/{orderId}
   */
  async getOrder(orderId: string): Promise<Order> {
    console.log('[StockX Orders] Fetching order:', orderId)

    const response = await withStockxRetry(
      () =>
        this.client.request<Order>(`/v2/selling/orders/${orderId}`, {
          method: 'GET',
        }),
      { label: `Get order: ${orderId}` }
    )

    return response
  }

  /**
   * Get shipping label/document for an order
   * GET /v2/selling/orders/{orderId}/shipping-document
   *
   * Can request as PDF or JSON based on Accept header
   */
  async getShippingDocument(
    orderId: string,
    format: 'PDF' | 'JSON' = 'PDF'
  ): Promise<ShippingDocument | Blob> {
    console.log('[StockX Orders] Fetching shipping document:', {
      orderId,
      format,
    })

    if (format === 'PDF') {
      // Request PDF blob
      const response = await withStockxRetry(
        () =>
          this.client.request<Blob>(
            `/v2/selling/orders/${orderId}/shipping-document`,
            {
              method: 'GET',
              headers: {
                Accept: 'application/pdf',
              },
            }
          ),
        { label: `Get shipping label PDF: ${orderId}` }
      )

      return response
    } else {
      // Request JSON with URL
      const response = await withStockxRetry(
        () =>
          this.client.request<ShippingDocument>(
            `/v2/selling/orders/${orderId}/shipping-document`,
            {
              method: 'GET',
              headers: {
                Accept: 'application/json',
              },
            }
          ),
        { label: `Get shipping label info: ${orderId}` }
      )

      return response
    }
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
