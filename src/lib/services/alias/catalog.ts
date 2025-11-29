/**
 * Alias Catalog Service
 * Handles fetching and caching product metadata from Alias catalog API
 * Primary use: Product images, names, brands for display and slug-based URLs
 */

import { createClient } from '@supabase/supabase-js'
import { createAliasClient } from './client'
import { generateProductSlug } from '@/lib/utils/slug'
import type { AliasCatalogItem } from './types'

interface CachedCatalogItem {
  id: string
  catalog_id: string
  product_name: string
  brand: string | null
  sku: string | null
  slug: string
  image_url: string | null
  thumbnail_url: string | null
  category: string | null
  colorway: string | null
  retail_price_cents: number | null
  release_date: string | null
  created_at: string
  updated_at: string
  last_fetched_at: string
}

/**
 * Get or create a cached catalog item
 * This function will:
 * 1. Check if we have a cached version
 * 2. If not (or if stale), fetch from Alias API
 * 3. Store in alias_catalog_items table
 * 4. Return the cached item
 *
 * @param catalogId - The Alias catalog_id (e.g., "air-jordan-1-retro-high-og-dz5485-612")
 * @param options - Optional parameters
 * @returns The cached catalog item with slug
 */
export async function getCatalogItem(
  catalogId: string,
  options: {
    forceRefresh?: boolean
    maxAge?: number // Max age in milliseconds before refresh (default: 24 hours)
  } = {}
): Promise<CachedCatalogItem | null> {
  const { forceRefresh = false, maxAge = 24 * 60 * 60 * 1000 } = options

  // Initialize Supabase client with service role for database operations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Check if we have a cached version
  if (!forceRefresh) {
    const { data: cached, error } = await supabase
      .from('alias_catalog_items')
      .select('*')
      .eq('catalog_id', catalogId)
      .single()

    if (!error && cached) {
      // Check if cache is still fresh
      const lastFetched = new Date(cached.last_fetched_at).getTime()
      const now = Date.now()
      const age = now - lastFetched

      if (age < maxAge) {
        console.log(`[Catalog] Using cached item for ${catalogId} (age: ${Math.round(age / 1000 / 60)}m)`)
        return cached as CachedCatalogItem
      }

      console.log(`[Catalog] Cache stale for ${catalogId}, refreshing...`)
    }
  }

  // Fetch from Alias API
  console.log(`[Catalog] Fetching ${catalogId} from Alias API...`)
  const aliasClient = createAliasClient()

  try {
    const response = await aliasClient.getCatalogItem(catalogId)
    const item = response.catalog_item

    // Generate slug
    const slug = generateProductSlug(item.name, item.sku)

    // Prepare data for upsert
    const catalogData = {
      catalog_id: item.catalog_id,
      product_name: item.name,
      brand: item.brand || null,
      sku: item.sku || null,
      slug,
      image_url: item.main_picture_url || null,
      thumbnail_url: item.main_picture_url || null, // Use same for now, can add thumbnail later
      category: item.product_category_v2 || null,
      colorway: item.colorway || null,
      retail_price_cents: item.retail_price_cents || null,
      release_date: item.release_date || null,
      last_fetched_at: new Date().toISOString(),
    }

    // Upsert to database
    const { data: upserted, error: upsertError } = await supabase
      .from('alias_catalog_items')
      .upsert(catalogData, {
        onConflict: 'catalog_id',
        ignoreDuplicates: false,
      })
      .select()
      .single()

    if (upsertError) {
      console.error(`[Catalog] Error upserting catalog item:`, upsertError)
      throw upsertError
    }

    console.log(`[Catalog] Cached ${catalogId} with slug: ${slug}`)
    return upserted as CachedCatalogItem
  } catch (error) {
    console.error(`[Catalog] Error fetching catalog item ${catalogId}:`, error)
    // Return null if fetch fails (caller should handle)
    return null
  }
}

/**
 * Get catalog item by slug
 * Looks up the slug in the cache and returns the catalog item
 *
 * @param slug - The product slug (e.g., "air-jordan-1-retro-high-og-dz5485-612")
 * @returns The cached catalog item or null if not found
 */
export async function getCatalogItemBySlug(
  slug: string
): Promise<CachedCatalogItem | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .from('alias_catalog_items')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    console.log(`[Catalog] No cached item found for slug: ${slug}`)
    return null
  }

  return data as CachedCatalogItem
}

/**
 * Batch fetch and cache catalog items
 * Useful for pre-caching items in inventory
 *
 * @param catalogIds - Array of catalog IDs to fetch
 * @returns Map of catalog_id to cached items
 */
export async function batchCacheCatalogItems(
  catalogIds: string[]
): Promise<Map<string, CachedCatalogItem>> {
  const results = new Map<string, CachedCatalogItem>()

  // Process in parallel (but be mindful of rate limits)
  const promises = catalogIds.map(async (catalogId) => {
    try {
      const item = await getCatalogItem(catalogId)
      if (item) {
        results.set(catalogId, item)
      }
    } catch (error) {
      console.error(`[Catalog] Error caching ${catalogId}:`, error)
    }
  })

  await Promise.all(promises)

  console.log(`[Catalog] Cached ${results.size}/${catalogIds.length} items`)
  return results
}

/**
 * Search catalog and optionally cache results
 *
 * @param query - Search query (product name, SKU, etc.)
 * @param options - Search options
 * @returns Search results from Alias API
 */
export async function searchAndCacheCatalog(
  query: string,
  options: {
    limit?: number
    cacheResults?: boolean
  } = {}
): Promise<AliasCatalogItem[]> {
  const { limit = 10, cacheResults = true } = options

  const aliasClient = createAliasClient()
  const response = await aliasClient.searchCatalog(query, { limit })

  // Optionally cache all results
  if (cacheResults && response.catalog_items.length > 0) {
    const catalogIds = response.catalog_items.map((item) => item.catalog_id)
    await batchCacheCatalogItems(catalogIds)
  }

  return response.catalog_items
}
