/**
 * StockX Products API
 * Product search, details, and variant size mapping
 *
 * @deprecated This file is DEPRECATED. Use catalog.ts instead.
 *
 * MIGRATION GUIDE:
 * - searchProducts() → StockxCatalogService.searchProducts()
 * - getProductBySku() → StockxCatalogService.searchProducts(sku) then getProduct()
 * - getProductBySlug() → No direct equivalent, use search
 *
 * WHY DEPRECATED:
 * - Duplicates functionality from catalog.ts
 * - Non-directive compliant data shapes
 * - Returns null on errors instead of throwing
 * - catalog.ts is the official, maintained service
 */

import { getStockxClient } from './client'
import { isStockxMockMode } from '@/lib/config/stockx'

// ============================================================================
// Types
// ============================================================================

export interface StockxProduct {
  id: string
  sku: string
  slug: string
  brand: string
  name: string
  model?: string
  colorway?: string
  imageUrl?: string
  retailPrice?: number
  releaseDate?: string
  description?: string
  meta?: Record<string, any>
}

export interface StockxProductVariant {
  id: string
  productId: string
  size: string
  sizeType: 'US' | 'UK' | 'EU' | 'JP'
  available: boolean
}

export interface StockxProductDetails extends StockxProduct {
  variants: StockxProductVariant[]
}

export interface StockxSearchResult {
  products: StockxProduct[]
  total: number
  page: number
  limit: number
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_PRODUCTS: StockxProduct[] = [
  {
    id: 'mock-stockx-001',
    sku: 'DD1391-100',
    slug: 'nike-dunk-low-panda-2021',
    brand: 'Nike',
    name: 'Nike Dunk Low Panda (2021)',
    model: 'Dunk Low',
    colorway: 'White/Black',
    imageUrl: 'https://images.stockx.com/images/Nike-Dunk-Low-Panda.jpg',
    retailPrice: 110,
    releaseDate: '2021-03-10',
    meta: { source: 'mock' },
  },
  {
    id: 'mock-stockx-002',
    sku: 'DZ5485-612',
    slug: 'air-jordan-1-high-og-university-red',
    brand: 'Jordan',
    name: 'Air Jordan 1 High OG University Red',
    model: 'Air Jordan 1',
    colorway: 'University Red',
    imageUrl: 'https://images.stockx.com/images/Air-Jordan-1-University-Red.jpg',
    retailPrice: 170,
    releaseDate: '2023-05-20',
    meta: { source: 'mock' },
  },
]

// ============================================================================
// Products API
// ============================================================================

/**
 * Search for products by query
 */
export async function searchProducts(
  query: string,
  options: {
    page?: number
    limit?: number
    userId?: string
    currencyCode?: string
  } = {}
): Promise<StockxSearchResult> {
  const { page = 1, limit = 20, userId, currencyCode } = options

  // Mock mode
  if (isStockxMockMode()) {
    console.log('[StockX Products] Mock search', { query, page, limit, currencyCode })

    const filtered = MOCK_PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase()) ||
      p.brand.toLowerCase().includes(query.toLowerCase())
    )

    return {
      products: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      limit,
    }
  }

  // Real API - Use v2 catalog/search endpoint with user's OAuth tokens
  const client = getStockxClient(userId)

  try {
    // Build URL with optional currencyCode parameter
    let url = `/v2/catalog/search?query=${encodeURIComponent(query)}&pageNumber=${page}&pageSize=${limit}`
    if (currencyCode) {
      url += `&currencyCode=${currencyCode}`
    }

    const response = await client.request<any>(url)

    // Map StockX v2 response to our format
    // V2 uses: products[], productId, styleId, title, productAttributes{}
    const items = response.products || response.data || []
    const products: StockxProduct[] = items.map((item: any) => ({
      id: item.productId || item.id || item.uuid,
      sku: item.styleId || item.sku,
      slug: item.urlKey || item.slug,
      brand: item.brand,
      name: item.title || item.name,
      model: item.model || item.productAttributes?.model,
      colorway: item.productAttributes?.colorway || item.colorway,
      imageUrl: item.media?.imageUrl || item.image,
      retailPrice: item.productAttributes?.retailPrice || item.retailPrice,
      releaseDate: item.productAttributes?.releaseDate || item.releaseDate,
      meta: item,
    }))

    return {
      products,
      total: response.count || response.pagination?.total || products.length,
      page: response.pageNumber || page,
      limit: response.pageSize || limit,
    }
  } catch (error) {
    console.error('[StockX Products] Search failed:', error)
    throw error
  }
}

/**
 * Get product details by SKU
 */
export async function getProductBySku(
  sku: string,
  options: {
    userId?: string
    currencyCode?: string
  } = {}
): Promise<StockxProductDetails | null> {
  const { userId, currencyCode } = options
  // Mock mode
  if (isStockxMockMode()) {
    console.log('[StockX Products] Mock get product', { sku })

    const product = MOCK_PRODUCTS.find(
      p => p.sku.toLowerCase() === sku.toLowerCase()
    )

    if (!product) {
      return null
    }

    // Mock variants
    const variants: StockxProductVariant[] = [
      { id: `${product.id}-uk8`, productId: product.id, size: '8', sizeType: 'UK', available: true },
      { id: `${product.id}-uk9`, productId: product.id, size: '9', sizeType: 'UK', available: true },
      { id: `${product.id}-uk10`, productId: product.id, size: '10', sizeType: 'UK', available: true },
      { id: `${product.id}-uk11`, productId: product.id, size: '11', sizeType: 'UK', available: true },
    ]

    return {
      ...product,
      variants,
    }
  }

  // Real API - Use v2 catalog/search with styleId (SKU)
  const client = getStockxClient(userId)

  try {
    // Search by SKU (v2 search supports styleId)
    let url = `/v2/catalog/search?query=${encodeURIComponent(sku)}&pageSize=1`
    if (currencyCode) {
      url += `&currencyCode=${currencyCode}`
    }
    const searchResponse = await client.request<any>(url)

    const items = searchResponse.products || searchResponse.data || []
    if (items.length === 0) {
      return null
    }

    const item = items[0]

    // If we have a product ID, fetch full details with variants
    const productId = item.productId || item.id
    if (productId) {
      try {
        const detailsResponse = await client.request<any>(
          `/v2/catalog/products/${productId}`
        )
        const detailItem = detailsResponse.data || detailsResponse

        const product: StockxProductDetails = {
          id: detailItem.productId || detailItem.id || detailItem.uuid,
          sku: detailItem.styleId || detailItem.sku,
          slug: detailItem.urlKey || detailItem.slug,
          brand: detailItem.brand,
          name: detailItem.title || detailItem.name,
          model: detailItem.model || detailItem.productAttributes?.model,
          colorway: detailItem.productAttributes?.colorway || detailItem.colorway,
          imageUrl: detailItem.media?.imageUrl || detailItem.image,
          retailPrice: detailItem.productAttributes?.retailPrice || detailItem.retailPrice,
          releaseDate: detailItem.productAttributes?.releaseDate || detailItem.releaseDate,
          meta: detailItem,
          variants: (detailItem.variants || []).map((v: any) => ({
            id: v.id || v.variantId,
            productId: detailItem.productId || detailItem.id,
            size: v.size,
            sizeType: v.sizeType || 'US',
            available: v.available !== false,
          })),
        }

        return product
      } catch (error) {
        // If details fetch fails, fall back to search result
        console.warn('[StockX Products] Failed to fetch full details, using search result')
      }
    }

    // Fallback: use search result only (without variants)
    const product: StockxProductDetails = {
      id: item.productId || item.id || item.uuid,
      sku: item.styleId || item.sku,
      slug: item.urlKey || item.slug,
      brand: item.brand,
      name: item.title || item.name,
      model: item.model || item.productAttributes?.model,
      colorway: item.productAttributes?.colorway || item.colorway,
      imageUrl: item.media?.imageUrl || item.image,
      retailPrice: item.productAttributes?.retailPrice || item.retailPrice,
      releaseDate: item.productAttributes?.releaseDate || item.releaseDate,
      meta: item,
      variants: [],
    }

    return product
  } catch (error: any) {
    if (error.message?.includes('404')) {
      return null
    }
    console.error('[StockX Products] Get product failed:', error)
    throw error
  }
}

/**
 * Get product details by slug
 */
export async function getProductBySlug(
  slug: string,
  options: {
    userId?: string
    currencyCode?: string
  } = {}
): Promise<StockxProductDetails | null> {
  const { userId, currencyCode } = options
  // Mock mode
  if (isStockxMockMode()) {
    console.log('[StockX Products] Mock get product by slug', { slug })

    const product = MOCK_PRODUCTS.find(
      p => p.slug.toLowerCase() === slug.toLowerCase()
    )

    if (!product) {
      return null
    }

    const variants: StockxProductVariant[] = [
      { id: `${product.id}-uk8`, productId: product.id, size: '8', sizeType: 'UK', available: true },
      { id: `${product.id}-uk9`, productId: product.id, size: '9', sizeType: 'UK', available: true },
      { id: `${product.id}-uk10`, productId: product.id, size: '10', sizeType: 'UK', available: true },
      { id: `${product.id}-uk11`, productId: product.id, size: '11', sizeType: 'UK', available: true },
    ]

    return {
      ...product,
      variants,
    }
  }

  // Real API - Use v2 catalog/search with slug/urlKey
  const client = getStockxClient(userId)

  try {
    // Search by slug (convert slug to search query)
    const searchQuery = slug.replace(/-/g, ' ')
    let url = `/v2/catalog/search?query=${encodeURIComponent(searchQuery)}&pageSize=5`
    if (currencyCode) {
      url += `&currencyCode=${currencyCode}`
    }
    const searchResponse = await client.request<any>(url)

    const items = searchResponse.products || searchResponse.data || []

    // Find exact slug match
    const item = items.find((p: any) =>
      (p.urlKey || p.slug)?.toLowerCase() === slug.toLowerCase()
    )

    if (!item) {
      return null
    }

    // If we have a product ID, fetch full details with variants
    const productId = item.productId || item.id
    if (productId) {
      try {
        const detailsResponse = await client.request<any>(
          `/v2/catalog/products/${productId}`
        )
        const detailItem = detailsResponse.data || detailsResponse

        const product: StockxProductDetails = {
          id: detailItem.productId || detailItem.id || detailItem.uuid,
          sku: detailItem.styleId || detailItem.sku,
          slug: detailItem.urlKey || detailItem.slug,
          brand: detailItem.brand,
          name: detailItem.title || detailItem.name,
          model: detailItem.model || detailItem.productAttributes?.model,
          colorway: detailItem.productAttributes?.colorway || detailItem.colorway,
          imageUrl: detailItem.media?.imageUrl || detailItem.image,
          retailPrice: detailItem.productAttributes?.retailPrice || detailItem.retailPrice,
          releaseDate: detailItem.productAttributes?.releaseDate || detailItem.releaseDate,
          meta: detailItem,
          variants: (detailItem.variants || []).map((v: any) => ({
            id: v.id || v.variantId,
            productId: detailItem.productId || detailItem.id,
            size: v.size,
            sizeType: v.sizeType || 'US',
            available: v.available !== false,
          })),
        }

        return product
      } catch (error) {
        console.warn('[StockX Products] Failed to fetch full details, using search result')
      }
    }

    // Fallback: use search result only (without variants)
    const product: StockxProductDetails = {
      id: item.productId || item.id || item.uuid,
      sku: item.styleId || item.sku,
      slug: item.urlKey || item.slug,
      brand: item.brand,
      name: item.title || item.name,
      model: item.model || item.productAttributes?.model,
      colorway: item.productAttributes?.colorway || item.colorway,
      imageUrl: item.media?.imageUrl || item.image,
      retailPrice: item.productAttributes?.retailPrice || item.retailPrice,
      releaseDate: item.productAttributes?.releaseDate || item.releaseDate,
      meta: item,
      variants: [],
    }

    return product
  } catch (error: any) {
    if (error.message?.includes('404')) {
      return null
    }
    console.error('[StockX Products] Get product by slug failed:', error)
    throw error
  }
}
