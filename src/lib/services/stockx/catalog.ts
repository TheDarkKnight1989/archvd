/**
 * StockX Catalog Service
 * Handles product search, GTIN lookups, and variant fetching
 */

import { StockxClient, getStockxClient } from './client'
import { createClient } from '@/lib/supabase/server'
import type {
  StockxProduct,
  StockxVariant,
  StockxMarketData,
  StockxProductEntity,
  StockxVariantEntity,
  StockxMarketSnapshot,
} from '@/lib/stockx/types'

// ============================================================================
// API Response Types (StockX v2 actual responses)
// ============================================================================

interface StockxSearchResponse {
  results: Array<{
    node: {
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
    }
  }>
  pageInfo: {
    hasNextPage: boolean
    endCursor: string
  }
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
  }
  marketData?: {
    currencyCode: string
    lowestAsk?: number
    highestBid?: number
    lastSale?: number
    salesLast72Hours?: number
  }
}

// ============================================================================
// Catalog Service
// ============================================================================

export class StockxCatalogService {
  private client: StockxClient

  constructor(userId?: string) {
    this.client = getStockxClient(userId)
  }

  /**
   * Search StockX catalog by query (SKU, style ID, or name)
   */
  async searchProducts(query: string, limit: number = 10): Promise<StockxProduct[]> {
    console.log('[StockX Catalog] Searching for:', { query, limit })

    try {
      const response = await this.client.request<StockxSearchResponse>(
        `/v2/catalog/search?query=${encodeURIComponent(query)}&limit=${limit}`
      )

      if (!response.results || response.results.length === 0) {
        console.log('[StockX Catalog] No results found')
        return []
      }

      const products = response.results.map((result) => this.normalizeProduct(result.node))
      console.log('[StockX Catalog] Found products:', products.length)
      return products
    } catch (error) {
      console.error('[StockX Catalog] Search error:', error)
      throw error
    }
  }

  /**
   * Get product by StockX product ID
   */
  async getProduct(productId: string): Promise<StockxProduct | null> {
    console.log('[StockX Catalog] Fetching product:', productId)

    try {
      const response = await this.client.request<StockxProductResponse>(
        `/v2/catalog/products/${productId}`
      )

      return this.normalizeProduct(response)
    } catch (error) {
      console.error('[StockX Catalog] Get product error:', error)
      return null
    }
  }

  /**
   * Lookup product and variant by GTIN (barcode)
   */
  async lookupByGTIN(gtin: string): Promise<{
    product: StockxProduct
    variant: StockxVariant
    marketData?: StockxMarketData
  } | null> {
    console.log('[StockX Catalog] Looking up GTIN:', gtin)

    try {
      const response = await this.client.request<StockxGTINResponse>(
        `/v2/catalog/variants/gtin/${gtin}`
      )

      const product = this.normalizeProduct(response.product)
      const variant = this.normalizeVariant(response.variant, response.product.id)

      let marketData: StockxMarketData | undefined
      if (response.marketData) {
        marketData = {
          productId: product.productId,
          variantId: variant.variantId,
          currencyCode: response.marketData.currencyCode,
          lowestAsk: response.marketData.lowestAsk,
          highestBid: response.marketData.highestBid,
          lastSalePrice: response.marketData.lastSale,
          salesLast72Hours: response.marketData.salesLast72Hours,
        }
      }

      console.log('[StockX Catalog] GTIN lookup success:', {
        product: product.styleId,
        variant: variant.variantValue,
      })

      return { product, variant, marketData }
    } catch (error) {
      console.error('[StockX Catalog] GTIN lookup error:', error)
      return null
    }
  }

  /**
   * Get all variants for a product
   */
  async getProductVariants(productId: string): Promise<StockxVariant[]> {
    console.log('[StockX Catalog] Fetching variants for:', productId)

    try {
      const response = await this.client.request<StockxProductResponse>(
        `/v2/catalog/products/${productId}`
      )

      if (!response.variants) {
        return []
      }

      return response.variants.map((v) => this.normalizeVariant(v, productId))
    } catch (error) {
      console.error('[StockX Catalog] Get variants error:', error)
      return []
    }
  }

  /**
   * Save product and variants to database
   */
  async saveToDatabase(
    product: StockxProduct,
    variants?: StockxVariant[]
  ): Promise<{ productId: string; variantIds: string[] }> {
    console.log('[StockX Catalog] Saving to database:', {
      product: product.styleId,
      variantsCount: variants?.length || 0,
    })

    const supabase = await createClient()

    // Upsert product
    const productEntity: Omit<StockxProductEntity, 'id' | 'created_at' | 'updated_at' | 'last_synced_at'> = {
      stockx_product_id: product.productId,
      style_id: product.styleId,
      title: product.title,
      brand: product.brand,
      description: product.description,
      colorway: product.colorway,
      retail_price: product.retailPrice,
      release_date: product.releaseDate,
      image_url: product.imageUrl,
      thumb_url: product.thumbUrl,
      category: product.category,
      gender: product.gender,
      condition: product.condition,
      traits: product.traits,
    }

    const { data: savedProduct, error: productError } = await supabase
      .from('stockx_products')
      .upsert(
        {
          ...productEntity,
          last_synced_at: new Date().toISOString(),
        },
        {
          onConflict: 'stockx_product_id',
        }
      )
      .select('id')
      .single()

    if (productError) {
      console.error('[StockX Catalog] Product save error:', productError)
      throw productError
    }

    const productDbId = savedProduct.id

    // Upsert variants if provided
    const variantIds: string[] = []
    if (variants && variants.length > 0) {
      for (const variant of variants) {
        const variantEntity: Omit<
          StockxVariantEntity,
          'id' | 'created_at' | 'updated_at' | 'last_synced_at'
        > = {
          stockx_variant_id: variant.variantId,
          stockx_product_id: variant.productId,
          product_id: productDbId,
          variant_value: variant.variantValue,
          gtins: variant.gtins,
          hidden: variant.hidden,
          size_chart: variant.sizeChart,
        }

        const { data: savedVariant, error: variantError } = await supabase
          .from('stockx_variants')
          .upsert(
            {
              ...variantEntity,
              last_synced_at: new Date().toISOString(),
            },
            {
              onConflict: 'stockx_variant_id',
            }
          )
          .select('id')
          .single()

        if (variantError) {
          console.error('[StockX Catalog] Variant save error:', variantError)
          continue
        }

        variantIds.push(savedVariant.id)
      }
    }

    console.log('[StockX Catalog] Saved to database:', {
      productId: productDbId,
      variantIds,
    })

    return { productId: productDbId, variantIds }
  }

  /**
   * Normalize StockX API product response to our type
   */
  private normalizeProduct(raw: any): StockxProduct {
    return {
      productId: raw.id,
      styleId: raw.styleId,
      title: raw.title,
      brand: raw.brand,
      description: raw.description,
      colorway: raw.colorway,
      retailPrice: raw.retailPrice,
      releaseDate: raw.releaseDate,
      imageUrl: raw.media?.imageUrl,
      thumbUrl: raw.media?.thumbUrl,
      category: raw.productCategory,
      gender: raw.gender,
      condition: raw.condition || 'new',
      traits: raw.traits,
    }
  }

  /**
   * Normalize StockX API variant response to our type
   */
  private normalizeVariant(raw: any, productId: string): StockxVariant {
    return {
      variantId: raw.id,
      productId,
      variantValue: raw.size,
      gtins: raw.gtins,
      hidden: raw.hidden,
      sizeChart: raw.sizeChart,
    }
  }
}

// ============================================================================
// Service Factory
// ============================================================================

/**
 * Get catalog service instance
 */
export function getCatalogService(userId?: string): StockxCatalogService {
  return new StockxCatalogService(userId)
}
