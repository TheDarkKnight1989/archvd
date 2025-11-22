/**
 * StockX Catalog Service
 * DIRECTIVE COMPLIANT: API-only operations, no database, strict validation
 *
 * Handles:
 * - Product search (GET /v2/catalog/search)
 * - Product fetch (GET /v2/catalog/products/{productId})
 * - GTIN lookups (GET /v2/catalog/variants/gtin/{gtin})
 * - Variant fetching (GET /v2/catalog/products/{productId}/variants)
 */

import { StockxClient, getStockxClient } from './client'
import { withStockxRetry } from './retry'

// ============================================================================
// DIRECTIVE SECTION 3: DATA SHAPE REQUIREMENTS
// ============================================================================

export interface StockxProduct {
  productId: string
  styleId: string
  productName: string
  brand: string
  image: string | null
  // Extended fields (not in directive but needed for app)
  colorway?: string
  retailPrice?: number
  releaseDate?: string
  category?: string
  gender?: string
  condition?: string
  traits?: any
}

export interface StockxVariant {
  variantId: string
  variantName: string
  variantValue: string
  gtin: string | null
  // Extended fields
  gtins?: string[]
  hidden?: boolean
  sizeChart?: {
    category: string
    baseCategory: string
    baseType: string
    displayOptions: string[]
  }
}

export interface StockxMarketData {
  lowestAsk: number | null
  highestBid: number | null
  salesLast72h: number | null
  volume30d: number | null
  currencyCode: string
}

// ============================================================================
// API RESPONSE TYPES (StockX v2 raw responses)
// ============================================================================

interface StockxSearchResponse {
  count: number
  pageSize: number
  pageNumber: number
  hasNextPage: boolean
  products: Array<{
    productId: string
    urlKey: string
    styleId: string | null
    productType: string
    title: string | null
    brand: string | null
    productAttributes: {
      gender?: string | null
      season?: string | null
      releaseDate?: string | null
      retailPrice?: number | null
      colorway?: string | null
      color?: string | null
    }
    sizeChart?: {
      availableConversions?: Array<{
        name: string | null
        type: string | null
      }>
      defaultConversion?: {
        name: string | null
        type: string | null
      }
    }
    isFlexEligible?: boolean
    isDirectEligible?: boolean
  }>
}

interface StockxProductResponse {
  id: string
  styleId: string
  title: string
  brand: string
  description?: string
  colorway?: string
  retailPrice?: number
  releaseDate?: string
  media?: {
    thumbUrl?: string
    imageUrl?: string
  }
  productCategory?: string
  gender?: string
  condition?: string
  traits?: any
  variants?: Array<{
    id: string
    size: string
    gtins?: string[]
    hidden?: boolean
  }>
}

interface StockxGTINResponse {
  product: StockxProductResponse
  variant: {
    id: string
    size: string
    gtins?: string[]
    hidden?: boolean
    sizeChart?: {
      category: string
      baseCategory: string
      baseType: string
      displayOptions: string[]
    }
  }
  marketData?: {
    currencyCode: string
    lowestAsk?: number
    highestBid?: number
    salesLast72Hours?: number
  }
}

interface StockxVariantsResponse {
  variants?: Array<{
    id: string
    variantId?: string
    size?: string
    variantValue?: string
    gtins?: string[]
    hidden?: boolean
    sizeChart?: {
      category: string
      baseCategory: string
      baseType: string
      displayOptions: string[]
    }
  }>
  data?: Array<any>
}

// ============================================================================
// DEV MODE LOGGING
// ============================================================================

const isDev = process.env.NODE_ENV === 'development'

function logDevRequest(endpoint: string, params?: any) {
  if (isDev) {
    console.log('[StockX Catalog] REQUEST:', { endpoint, params })
  }
}

function logDevResponse(endpoint: string, responseSchema: any) {
  if (isDev) {
    console.log('[StockX Catalog] RESPONSE SCHEMA:', {
      endpoint,
      keys: Object.keys(responseSchema),
      sample: responseSchema,
    })
  }
}

// ============================================================================
// VALIDATION HELPERS (DIRECTIVE SECTION 4)
// ============================================================================

function validateProduct(raw: any, source: string): void {
  const missing: string[] = []

  if (!raw.productId && !raw.id) missing.push('productId/id')
  if (!raw.styleId) missing.push('styleId')
  if (!raw.title) missing.push('title')
  if (!raw.brand) missing.push('brand')

  if (missing.length > 0) {
    throw new Error(
      `[StockX Catalog] Missing required product fields from ${source}: ${missing.join(', ')}\n` +
      `Raw response: ${JSON.stringify(raw, null, 2)}`
    )
  }
}

function validateVariant(raw: any, source: string): void {
  const missing: string[] = []

  if (!raw.id && !raw.variantId) missing.push('id/variantId')
  if (!raw.size && !raw.variantValue) missing.push('size/variantValue')

  if (missing.length > 0) {
    throw new Error(
      `[StockX Catalog] Missing required variant fields from ${source}: ${missing.join(', ')}\n` +
      `Raw response: ${JSON.stringify(raw, null, 2)}`
    )
  }
}

// ============================================================================
// CATALOG SERVICE
// ============================================================================

export class StockxCatalogService {
  private client: StockxClient

  constructor(userId?: string) {
    this.client = getStockxClient(userId)
  }

  /**
   * Search StockX catalog by query (SKU, style ID, or name)
   * API: GET /v2/catalog/search
   */
  async searchProducts(
    query: string,
    options: { limit?: number; currencyCode?: string; pageNumber?: number } = {}
  ): Promise<StockxProduct[]> {
    const { limit = 10, currencyCode, pageNumber = 1 } = options

    // FIX: V2 API uses 'pageSize' not 'limit', and requires 'pageNumber'
    let url = `/v2/catalog/search?query=${encodeURIComponent(query)}&pageSize=${limit}&pageNumber=${pageNumber}`
    if (currencyCode) {
      url += `&currencyCode=${currencyCode}`
    }

    logDevRequest(url, { query, pageSize: limit, pageNumber, currencyCode })

    try {
      const response = await withStockxRetry(
        () => this.client.request<StockxSearchResponse>(url),
        { label: `Search products: ${query}` }
      )

      logDevResponse(url, response)

      if (!response.products) {
        throw new Error(
          `[StockX Catalog] Invalid search response: missing 'products' field\n` +
          `Response: ${JSON.stringify(response, null, 2)}`
        )
      }

      if (response.products.length === 0) {
        console.log('[StockX Catalog] No results found for query:', query)
        return []
      }

      const products = response.products.map((product) => {
        validateProduct(product, 'search')
        return this.normalizeProduct(product)
      })

      console.log('[StockX Catalog] Found products:', products.length)
      return products
    } catch (error) {
      console.error('[StockX Catalog] Search error:', error)
      throw error
    }
  }

  /**
   * Get product by StockX product ID
   * API: GET /v2/catalog/products/{productId}
   */
  async getProduct(productId: string): Promise<StockxProduct> {
    if (!productId) {
      throw new Error('[StockX Catalog] productId is required')
    }

    const url = `/v2/catalog/products/${productId}`
    logDevRequest(url, { productId })

    try {
      const response = await withStockxRetry(
        () => this.client.request<StockxProductResponse>(url),
        { label: `Get product: ${productId}` }
      )

      logDevResponse(url, response)

      validateProduct(response, 'getProduct')

      const normalized = this.normalizeProduct(response)

      console.log('[StockX Catalog] Fetched product:', {
        productId: normalized.productId,
        styleId: normalized.styleId,
        productName: normalized.productName,
      })

      return normalized
    } catch (error: any) {
      if (error.message?.includes('404')) {
        throw new Error(`[StockX Catalog] Product not found: ${productId}`)
      }
      console.error('[StockX Catalog] Get product error:', error)
      throw error
    }
  }

  /**
   * Lookup product and variant by GTIN (barcode)
   * API: GET /v2/catalog/variants/gtin/{gtin}
   */
  async lookupByGTIN(
    gtin: string,
    currencyCode?: string
  ): Promise<{
    product: StockxProduct
    variant: StockxVariant
    marketData?: StockxMarketData
  }> {
    if (!gtin) {
      throw new Error('[StockX Catalog] gtin is required')
    }

    let url = `/v2/catalog/variants/gtin/${gtin}`
    if (currencyCode) {
      url += `?currencyCode=${currencyCode}`
    }

    logDevRequest(url, { gtin, currencyCode })

    try {
      const response = await withStockxRetry(
        () => this.client.request<StockxGTINResponse>(url),
        { label: `Lookup GTIN: ${gtin}` }
      )

      logDevResponse(url, response)

      if (!response.product) {
        throw new Error(
          `[StockX Catalog] Invalid GTIN response: missing 'product' field\n` +
          `Response: ${JSON.stringify(response, null, 2)}`
        )
      }

      if (!response.variant) {
        throw new Error(
          `[StockX Catalog] Invalid GTIN response: missing 'variant' field\n` +
          `Response: ${JSON.stringify(response, null, 2)}`
        )
      }

      validateProduct(response.product, 'lookupByGTIN')
      validateVariant(response.variant, 'lookupByGTIN')

      const product = this.normalizeProduct(response.product)
      const variant = this.normalizeVariant(response.variant, response.product.id)

      let marketData: StockxMarketData | undefined
      if (response.marketData) {
        marketData = {
          lowestAsk: response.marketData.lowestAsk ?? null,
          highestBid: response.marketData.highestBid ?? null,
          salesLast72h: response.marketData.salesLast72Hours ?? null,
          volume30d: null, // Not provided in GTIN response
          currencyCode: response.marketData.currencyCode,
        }
      }

      console.log('[StockX Catalog] GTIN lookup success:', {
        product: product.styleId,
        variant: variant.variantValue,
      })

      return { product, variant, marketData }
    } catch (error: any) {
      if (error.message?.includes('404')) {
        throw new Error(`[StockX Catalog] GTIN not found: ${gtin}`)
      }
      console.error('[StockX Catalog] GTIN lookup error:', error)
      throw error
    }
  }

  /**
   * Get all variants for a product
   * API: GET /v2/catalog/products/{productId}/variants
   */
  async getProductVariants(productId: string): Promise<StockxVariant[]> {
    if (!productId) {
      throw new Error('[StockX Catalog] productId is required')
    }

    const url = `/v2/catalog/products/${productId}/variants`
    logDevRequest(url, { productId })

    try {
      const response = await withStockxRetry(
        () => this.client.request<StockxVariantsResponse>(url),
        { label: `Get variants: ${productId}` }
      )

      logDevResponse(url, response)

      // Response might be array directly or wrapped in variants/data field
      const variantsArray = response.variants || response.data || (Array.isArray(response) ? response : [])

      if (!Array.isArray(variantsArray)) {
        throw new Error(
          `[StockX Catalog] Invalid variants response: expected array\n` +
          `Response: ${JSON.stringify(response, null, 2)}`
        )
      }

      if (variantsArray.length === 0) {
        console.warn('[StockX Catalog] No variants found for product:', productId)
        return []
      }

      const normalizedVariants = variantsArray.map((v: any) => {
        validateVariant(v, 'getProductVariants')
        return this.normalizeVariant(v, productId)
      })

      console.log('[StockX Catalog] Fetched variants:', normalizedVariants.length)
      return normalizedVariants
    } catch (error: any) {
      if (error.message?.includes('404')) {
        throw new Error(`[StockX Catalog] Product not found: ${productId}`)
      }
      console.error('[StockX Catalog] Get variants error:', error)
      throw error
    }
  }

  /**
   * Normalize StockX API product response to directive-compliant shape
   * DIRECTIVE SECTION 3: Returns { productId, styleId, productName, brand, image }
   */
  private normalizeProduct(raw: any): StockxProduct {
    return {
      // DIRECTIVE REQUIRED FIELDS
      productId: raw.productId || raw.id,
      styleId: raw.styleId || '',
      productName: raw.title || '', // title → productName
      brand: raw.brand || '',
      image: raw.media?.imageUrl || raw.media?.thumbUrl || null, // V1 compat: imageUrl/thumbUrl → image

      // EXTENDED FIELDS (V2 API: extracted from productAttributes)
      colorway: raw.productAttributes?.colorway || raw.colorway,
      retailPrice: raw.productAttributes?.retailPrice || raw.retailPrice,
      releaseDate: raw.productAttributes?.releaseDate || raw.releaseDate,
      category: raw.productType || raw.productCategory,
      gender: raw.productAttributes?.gender || raw.gender,
      condition: raw.condition || 'new',
      traits: raw.traits,
    }
  }

  /**
   * Normalize StockX API variant response to directive-compliant shape
   * DIRECTIVE SECTION 3: Returns { variantId, variantName, variantValue, gtin }
   */
  private normalizeVariant(raw: any, productId: string): StockxVariant {
    const variantValue = raw.variantValue || raw.size || ''

    return {
      // DIRECTIVE REQUIRED FIELDS
      variantId: raw.id || raw.variantId,
      variantName: `Size ${variantValue}`, // Construct human-readable name
      variantValue: variantValue,
      gtin: raw.gtins?.[0] || null, // Primary GTIN (singular)

      // EXTENDED FIELDS
      gtins: raw.gtins, // All GTINs (plural)
      hidden: raw.hidden,
      sizeChart: raw.sizeChart,
    }
  }
}

// ============================================================================
// SERVICE FACTORY
// ============================================================================

/**
 * Get catalog service instance
 */
export function getCatalogService(userId?: string): StockxCatalogService {
  return new StockxCatalogService(userId)
}
