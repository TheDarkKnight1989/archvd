/**
 * Product Image Resolver - ALIAS-FIRST PRIORITY
 * WHY: Ensure product rows ALWAYS show an image, never blank
 *
 * Resolution hierarchy (first hit wins):
 * 1. Alias catalog image (from alias_catalog_items) - PRIMARY SOURCE
 * 2. Product catalog image (from product_catalog if provider is Alias)
 * 3. Provider fallback: /images/providers/{provider}.png
 * 4. Brand fallback: /images/brands/{brandKey}.png
 * 5. Neutral fallback: /images/placeholders/product.png
 *
 * NOTE: StockX images are NOT used (unreliable - return 404)
 */

export type ProductImageResult = {
  src: string
  alt: string
  provenance: 'alias' | 'catalog' | 'provider' | 'brand' | 'neutral'
}

export type ProductImageInput = {
  // Alias catalog (PRIMARY SOURCE)
  aliasCatalogImageUrl?: string | null
  aliasCatalogThumbnailUrl?: string | null

  // Product catalog (SECONDARY SOURCE - only if from Alias)
  catalogImageUrl?: string | null
  catalogProvider?: 'alias' | 'stockx' | 'ebay' | 'seed' | null

  // Legacy/fallback fields (for backwards compatibility)
  inventoryImageUrl?: string | null
  provider?: 'stockx' | 'alias' | 'ebay' | 'seed' | null

  // Product metadata for alt text
  brand?: string | null
  model?: string | null
  colorway?: string | null
  sku: string
}

/**
 * Get product image with Alias-first fallback hierarchy
 * @returns Always returns a valid image URL and alt text
 */
export function getProductImage(input: ProductImageInput): ProductImageResult {
  const {
    aliasCatalogImageUrl,
    aliasCatalogThumbnailUrl,
    catalogImageUrl,
    catalogProvider,
    inventoryImageUrl,
    provider,
    brand,
    model,
    colorway,
    sku,
  } = input

  // Build alt text
  const alt = buildAltText(brand, model, colorway, sku)

  // 1. Try Alias catalog image (PRIMARY SOURCE)
  if (aliasCatalogImageUrl && isValidUrl(aliasCatalogImageUrl)) {
    return {
      src: aliasCatalogImageUrl,
      alt,
      provenance: 'alias',
    }
  }

  // 2. Try Alias catalog thumbnail (fallback if main image missing)
  if (aliasCatalogThumbnailUrl && isValidUrl(aliasCatalogThumbnailUrl)) {
    return {
      src: aliasCatalogThumbnailUrl,
      alt,
      provenance: 'alias',
    }
  }

  // 3. Try product catalog image (ONLY if provider is Alias)
  if (catalogImageUrl && isValidUrl(catalogImageUrl) && catalogProvider === 'alias') {
    return {
      src: catalogImageUrl,
      alt,
      provenance: 'catalog',
    }
  }

  // 4. Try inventory image (legacy/manual uploads)
  if (inventoryImageUrl && isValidUrl(inventoryImageUrl)) {
    return {
      src: inventoryImageUrl,
      alt,
      provenance: 'catalog',
    }
  }

  // 5. Provider fallback (logo)
  if (provider) {
    return {
      src: getProviderFallback(provider),
      alt,
      provenance: 'provider',
    }
  }

  // 6. Brand fallback (logo)
  if (brand) {
    return {
      src: getBrandFallback(brand),
      alt,
      provenance: 'brand',
    }
  }

  // 7. Neutral fallback (generic product icon)
  return {
    src: '/images/placeholders/product.svg',
    alt,
    provenance: 'neutral',
  }
}

/**
 * Build alt text: "{brand} {model} {colorway || sku}"
 */
function buildAltText(
  brand?: string | null,
  model?: string | null,
  colorway?: string | null,
  sku?: string
): string {
  const parts = []

  if (brand) parts.push(brand)
  if (model) parts.push(model)
  if (colorway) parts.push(colorway)
  else if (sku) parts.push(sku)

  return parts.length > 0 ? parts.join(' ') : 'Product image'
}

/**
 * Check if URL is valid and not empty
 */
function isValidUrl(url: string): boolean {
  if (!url || url.trim().length === 0) return false
  
  // Check if it's a valid URL format
  try {
    // Relative paths are valid
    if (url.startsWith('/')) return true
    
    // Absolute URLs must be valid
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Get provider fallback image
 * TODO(adapted): Using .svg for now; replace with .png when available
 */
function getProviderFallback(provider: string): string {
  const normalized = provider.toLowerCase()
  return `/images/providers/${normalized}.svg`
}

/**
 * Get brand fallback image
 * Normalizes brand names to match file names
 * TODO(adapted): Using .svg for now; replace with .png when available
 */
function getBrandFallback(brand: string): string {
  // Normalize brand key: lowercase, remove spaces, handle special cases
  const brandKey = brand
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')

  // Map common brand variations
  const brandMap: Record<string, string> = {
    'nike': 'nike',
    'jordan': 'jordan',
    'airjordan': 'jordan',
    'adidas': 'adidas',
    'yeezy': 'yeezy',
    'newbalance': 'newbalance',
    'asics': 'asics',
    'puma': 'puma',
    'reebok': 'reebok',
    'vans': 'vans',
    'converse': 'converse',
  }

  const mappedBrand = brandMap[brandKey] || brandKey

  return `/images/brands/${mappedBrand}.svg`
}

/**
 * Get fallback chain for onError handlers
 * Returns array of fallback URLs to try in order
 */
export function getFallbackChain(input: ProductImageInput): string[] {
  const fallbacks: string[] = []

  // Provider fallback
  if (input.provider) {
    fallbacks.push(getProviderFallback(input.provider))
  }

  // Brand fallback
  if (input.brand) {
    fallbacks.push(getBrandFallback(input.brand))
  }

  // Neutral fallback (always last)
  // TODO(adapted): Using .svg for now; replace with .png when available
  fallbacks.push('/images/placeholders/product.svg')

  return fallbacks
}
