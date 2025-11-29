/**
 * Slug utilities for generating clean URLs for market pages
 * Format: /portfolio/market/[slug]
 * Where [slug] = slugified-product-name-sku
 *
 * Example:
 * Product: "Air Jordan 1 Retro High OG 'Chicago Lost & Found'"
 * SKU: "DZ5485-612"
 * Slug: "air-jordan-1-retro-high-og-chicago-lost-and-found-dz5485-612"
 */

/**
 * Slugify a string - convert to lowercase, replace spaces with hyphens, remove special chars
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Replace apostrophes and quotes with empty string
    .replace(/['"`]/g, '')
    // Replace ampersands with 'and'
    .replace(/&/g, 'and')
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove all non-alphanumeric characters except hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Replace multiple consecutive hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
}

/**
 * Generate a product slug from product name and SKU
 *
 * @param productName - The product name (e.g., "Air Jordan 1 Retro High OG")
 * @param sku - The product SKU (e.g., "DZ5485-612")
 * @returns Slugified product name with SKU appended (e.g., "air-jordan-1-retro-high-og-dz5485-612")
 *
 * @example
 * generateProductSlug("Air Jordan 1 Retro High OG 'Chicago'", "DZ5485-612")
 * // Returns: "air-jordan-1-retro-high-og-chicago-dz5485-612"
 */
export function generateProductSlug(productName: string, sku: string): string {
  const slugifiedName = slugify(productName)
  const slugifiedSku = slugify(sku)

  return `${slugifiedName}-${slugifiedSku}`
}

/**
 * Parse SKU from a product slug
 *
 * Since slugs are in format "product-name-sku", and SKUs typically follow
 * patterns like "DZ5485-612" (letters followed by numbers and hyphens),
 * we look for the last segment that matches a SKU pattern.
 *
 * @param slug - The product slug (e.g., "air-jordan-1-retro-high-og-dz5485-612")
 * @returns The extracted SKU or null if not found
 *
 * @example
 * parseSkuFromSlug("air-jordan-1-retro-high-og-dz5485-612")
 * // Returns: "dz5485-612"
 */
export function parseSkuFromSlug(slug: string): string | null {
  if (!slug || typeof slug !== 'string') {
    return null
  }

  const normalized = slug.toLowerCase().trim()
  const parts = normalized.split('-')

  // SKU patterns (working backwards from end):
  // Most SKUs are 1-2 segments when split by hyphen
  // Examples:
  // - "hq3816" (1 segment)
  // - "dz5485-612" (2 segments)
  // - "dd1391-100" (2 segments)
  // - "m990gl6" (1 segment)

  // Try progressively from shortest to longest (prefer shorter matches)
  for (let i = 1; i <= Math.min(3, parts.length); i++) {
    const candidate = parts.slice(-i).join('-')

    // SKU validation:
    // 1. Must contain at least one number
    // 2. Must be 3-20 characters
    // 3. Must match one of these patterns:
    //    a) Letters + numbers mixed (e.g., "dz5485", "m990gl6")
    //    b) Numeric-only but long enough (5+ chars) to be a style code (e.g., "519329-160")

    const hasLetter = /[a-z]/.test(candidate)
    const hasNumber = /[0-9]/.test(candidate)
    const validLength = candidate.length >= 3 && candidate.length <= 20

    if (!hasNumber || !validLength) {
      continue
    }

    // Check if the FIRST segment has both letters and numbers (alphanumeric SKU)
    // This catches codes like "dz5485", "m990gl6", "dd1391", "hq3816"
    const firstPart = parts[parts.length - i]
    const firstHasLetter = /[a-z]/.test(firstPart)
    const firstHasNumber = /[0-9]/.test(firstPart)

    if (firstHasLetter && firstHasNumber) {
      // This looks like an alphanumeric SKU
      return candidate
    }

    // Also accept numeric-only SKUs if they're long enough (5+ chars)
    // This catches Nike style codes like "519329-160", "310805-160"
    if (!hasLetter && candidate.length >= 5) {
      // Additional check: should be mostly digits (at least 80% digits)
      const digitCount = (candidate.match(/\d/g) || []).length
      const digitRatio = digitCount / candidate.replace(/-/g, '').length

      if (digitRatio >= 0.8) {
        return candidate
      }
    }
  }

  return null
}

/**
 * Validate that a slug is properly formatted and can be decoded
 *
 * @param slug - The slug to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * validateSlug("air-jordan-1-retro-high-og-dz5485-612") // true
 * validateSlug("invalid slug with spaces") // false
 * validateSlug("no-sku-here") // false
 */
export function validateSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') {
    return false
  }

  // Must be lowercase alphanumeric with hyphens only
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return false
  }

  // Must not start or end with hyphen
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return false
  }

  // Must contain a valid SKU
  const sku = parseSkuFromSlug(slug)
  if (!sku) {
    return false
  }

  // Slug should be longer than just the SKU (must have product name too)
  if (slug === sku) {
    return false
  }

  return true
}

/**
 * Get product name from slug by removing the SKU portion
 *
 * @param slug - The product slug
 * @returns The product name portion (slugified) or null if invalid
 *
 * @example
 * getProductNameFromSlug("air-jordan-1-retro-high-og-dz5485-612")
 * // Returns: "air-jordan-1-retro-high-og"
 */
export function getProductNameFromSlug(slug: string): string | null {
  const sku = parseSkuFromSlug(slug)
  if (!sku) {
    return null
  }

  // Remove the SKU from the end of the slug
  const skuIndex = slug.lastIndexOf(sku)
  if (skuIndex === -1) {
    return null
  }

  const productName = slug.substring(0, skuIndex).replace(/-+$/, '')
  return productName || null
}
