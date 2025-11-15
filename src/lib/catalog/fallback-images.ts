/**
 * Fallback Images System
 * WHY: Ensure product rows ALWAYS show an image, never blank
 * Hierarchy: provider image → brand placeholder → neutral fallback
 */

// Neutral fallback for unknown products
const NEUTRAL_FALLBACK = '/images/placeholder-product.png'

// Brand-specific placeholder images
const BRAND_PLACEHOLDERS: Record<string, string> = {
  'nike': '/images/brands/nike-placeholder.png',
  'jordan': '/images/brands/jordan-placeholder.png',
  'adidas': '/images/brands/adidas-placeholder.png',
  'yeezy': '/images/brands/yeezy-placeholder.png',
  'new balance': '/images/brands/newbalance-placeholder.png',
  'asics': '/images/brands/asics-placeholder.png',
  'puma': '/images/brands/puma-placeholder.png',
  'reebok': '/images/brands/reebok-placeholder.png',
  'vans': '/images/brands/vans-placeholder.png',
  'converse': '/images/brands/converse-placeholder.png',
}

/**
 * Get product image with fallback hierarchy
 * @param providerImage - Image URL from provider (StockX, Alias, eBay)
 * @param brand - Product brand name
 * @returns Image URL (never null/empty)
 */
export function getProductImage(providerImage?: string | null, brand?: string | null): string {
  // 1. Try provider image first
  if (providerImage && providerImage.trim().length > 0) {
    return providerImage
  }

  // 2. Try brand placeholder
  if (brand) {
    const brandKey = brand.toLowerCase().trim()
    if (BRAND_PLACEHOLDERS[brandKey]) {
      return BRAND_PLACEHOLDERS[brandKey]
    }
  }

  // 3. Use neutral fallback
  return NEUTRAL_FALLBACK
}

/**
 * Get clean product name (brand + model)
 * WHY: Ensure titles are never blank or just SKUs
 * @param brand - Product brand
 * @param model - Product model/name
 * @param sku - Product SKU (fallback)
 * @returns Clean, human-readable product name
 */
export function getProductName(brand?: string | null, model?: string | null, sku?: string | null): string {
  // If we have brand and model, combine them
  if (brand && model) {
    // Avoid duplication if model already starts with brand
    if (model.toLowerCase().startsWith(brand.toLowerCase())) {
      return model
    }
    return `${brand} ${model}`
  }

  // If we only have model, use it
  if (model) {
    return model
  }

  // If we only have brand, use it with "Product"
  if (brand) {
    return `${brand} Product`
  }

  // Last resort: use SKU
  if (sku) {
    return sku
  }

  // Ultimate fallback
  return 'Unknown Product'
}

/**
 * Format colorway for display
 * @param colorway - Product colorway
 * @returns Formatted colorway or null
 */
export function formatColorway(colorway?: string | null): string | null {
  if (!colorway || colorway.trim().length === 0) {
    return null
  }

  // Capitalize first letter of each word
  return colorway
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
