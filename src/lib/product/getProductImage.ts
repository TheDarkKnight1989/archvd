/**
 * Product Image Resolver
 * WHY: Ensure product rows ALWAYS show an image, never blank
 * Resolution hierarchy (first hit wins):
 * 1. market_products.image_url (cached by worker)
 * 2. inventory.image_url (if present)
 * 3. Provider fallback: /images/providers/{provider}.png
 * 4. Brand fallback: /images/brands/{brandKey}.png
 * 5. Neutral fallback: /images/placeholders/product.png
 */

export type ProductImageResult = {
  src: string
  alt: string
  provenance: 'market' | 'inventory' | 'provider' | 'brand' | 'neutral'
}

export type ProductImageInput = {
  // From database
  marketImageUrl?: string | null
  inventoryImageUrl?: string | null
  provider?: 'stockx' | 'alias' | 'ebay' | 'seed' | null
  
  // Product metadata for alt text
  brand?: string | null
  model?: string | null
  colorway?: string | null
  sku: string
}

/**
 * Get product image with fallback hierarchy
 * @returns Always returns a valid image URL and alt text
 */
export function getProductImage(input: ProductImageInput): ProductImageResult {
  const { marketImageUrl, inventoryImageUrl, provider, brand, model, colorway, sku } = input

  // Build alt text
  const alt = buildAltText(brand, model, colorway, sku)

  // 1. Try market image (cached by worker)
  if (marketImageUrl && isValidUrl(marketImageUrl)) {
    return {
      src: marketImageUrl,
      alt,
      provenance: 'market',
    }
  }

  // 2. Try inventory image
  if (inventoryImageUrl && isValidUrl(inventoryImageUrl)) {
    return {
      src: inventoryImageUrl,
      alt,
      provenance: 'inventory',
    }
  }

  // 3. Provider fallback
  if (provider) {
    return {
      src: getProviderFallback(provider),
      alt,
      provenance: 'provider',
    }
  }

  // 4. Brand fallback
  if (brand) {
    return {
      src: getBrandFallback(brand),
      alt,
      provenance: 'brand',
    }
  }

  // 5. Neutral fallback
  // TODO(adapted): Using .svg for now; replace with .png when available
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
