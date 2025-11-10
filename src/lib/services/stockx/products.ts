/**
 * StockX Products API
 * Product search, details, and variant size mapping
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
  } = {}
): Promise<StockxSearchResult> {
  const { page = 1, limit = 20 } = options

  // Mock mode
  if (isStockxMockMode()) {
    console.log('[StockX Products] Mock search', { query, page, limit })

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

  // Real API
  const client = getStockxClient()

  try {
    const response = await client.request<any>(
      `/v1/products/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
    )

    // Map StockX response to our format
    const products: StockxProduct[] = (response.data || []).map((item: any) => ({
      id: item.id || item.uuid,
      sku: item.styleId || item.sku,
      slug: item.urlKey || item.slug,
      brand: item.brand,
      name: item.title || item.name,
      model: item.model,
      colorway: item.colorway,
      imageUrl: item.media?.imageUrl || item.image,
      retailPrice: item.retailPrice,
      releaseDate: item.releaseDate,
      meta: item,
    }))

    return {
      products,
      total: response.pagination?.total || products.length,
      page,
      limit,
    }
  } catch (error) {
    console.error('[StockX Products] Search failed:', error)
    throw error
  }
}

/**
 * Get product details by SKU
 */
export async function getProductBySku(sku: string): Promise<StockxProductDetails | null> {
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

  // Real API
  const client = getStockxClient()

  try {
    const response = await client.request<any>(`/v1/products/${encodeURIComponent(sku)}`)

    const item = response.data || response

    const product: StockxProductDetails = {
      id: item.id || item.uuid,
      sku: item.styleId || item.sku,
      slug: item.urlKey || item.slug,
      brand: item.brand,
      name: item.title || item.name,
      model: item.model,
      colorway: item.colorway,
      imageUrl: item.media?.imageUrl || item.image,
      retailPrice: item.retailPrice,
      releaseDate: item.releaseDate,
      meta: item,
      variants: (item.variants || []).map((v: any) => ({
        id: v.id,
        productId: item.id,
        size: v.size,
        sizeType: v.sizeType || 'US',
        available: v.available !== false,
      })),
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
export async function getProductBySlug(slug: string): Promise<StockxProductDetails | null> {
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

  // Real API
  const client = getStockxClient()

  try {
    const response = await client.request<any>(`/v1/products/slug/${encodeURIComponent(slug)}`)

    const item = response.data || response

    const product: StockxProductDetails = {
      id: item.id || item.uuid,
      sku: item.styleId || item.sku,
      slug: item.urlKey || item.slug,
      brand: item.brand,
      name: item.title || item.name,
      model: item.model,
      colorway: item.colorway,
      imageUrl: item.media?.imageUrl || item.image,
      retailPrice: item.retailPrice,
      releaseDate: item.releaseDate,
      meta: item,
      variants: (item.variants || []).map((v: any) => ({
        id: v.id,
        productId: item.id,
        size: v.size,
        sizeType: v.sizeType || 'US',
        available: v.available !== false,
      })),
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
