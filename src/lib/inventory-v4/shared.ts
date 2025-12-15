/**
 * ARCHVD Inventory V4 - Shared Utilities
 *
 * Pure utility functions that can run on both client and server.
 * No Supabase, no API keys, no external service calls.
 *
 * Safe to import from anywhere.
 */

import type { InputType } from './types'

// =============================================================================
// INPUT TYPE DETECTION
// =============================================================================

/**
 * SKU patterns for major sneaker brands
 */
const SKU_PATTERNS = [
  /^[A-Z]{2}\d{4}-\d{3}$/i, // Nike: DD1391-100, DZ5485-612
  /^\d{6}-\d{3}$/, // Jordan: 554724-136
  /^[MW]\d{3,4}[A-Z]{2,3}\d?$/i, // New Balance: M990GL6, W990GL6
  /^[A-Z]{2}\d{4}$/i, // Adidas: GY7924
  /^[A-Z]{3}\d{4}$/i, // Adidas alt: FY4576
  /^[A-Z]{2}-?\d{4,5}$/i, // Generic: AB12345
]

/**
 * Normalize URL input by prepending https:// if missing
 * Handles inputs like "stockx.com/foo" -> "https://stockx.com/foo"
 */
function normalizeUrlForParsing(input: string): string {
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input
  }
  // Check if it looks like one of our known domains
  if (
    input.includes('stockx.com') ||
    input.includes('alias.co') ||
    input.includes('alias.org') ||
    input.includes('aliasldn.com')
  ) {
    return `https://${input}`
  }
  return input
}

/**
 * Check if input is a valid URL and return hostname, or null if not a URL
 * Handles inputs without scheme (e.g., "stockx.com/foo" -> prepend https://)
 */
function tryParseUrlHostname(input: string): string | null {
  const urlString = normalizeUrlForParsing(input)

  try {
    const url = new URL(urlString)
    return url.hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Detect the type of input provided by the user
 *
 * @param input - User input string (SKU, search query, or URL)
 * @returns InputType - 'sku' | 'search_query' | 'stockx_url' | 'alias_url'
 */
export function detectInputType(input: string): InputType {
  const trimmed = input.trim()

  // URL detection - parse properly to avoid false positives
  const hostname = tryParseUrlHostname(trimmed)
  if (hostname) {
    if (hostname === 'stockx.com' || hostname.endsWith('.stockx.com')) {
      return 'stockx_url'
    }
    if (
      hostname === 'alias.co' ||
      hostname === 'alias.org' ||
      hostname === 'aliasldn.com' ||
      hostname.endsWith('.alias.co') ||
      hostname.endsWith('.alias.org')
    ) {
      return 'alias_url'
    }
  }

  // SKU pattern matching
  for (const pattern of SKU_PATTERNS) {
    if (pattern.test(trimmed)) return 'sku'
  }

  // Default to search query
  return 'search_query'
}

// =============================================================================
// URL EXTRACTION
// =============================================================================

/**
 * Extract slug from StockX URL
 * Example: https://stockx.com/air-jordan-1-retro-high-og-chicago-reimagined
 * Also handles: stockx.com/air-jordan-1-retro-high-og-chicago-reimagined (no scheme)
 *
 * NOTE: This returns a SLUG, not a SKU. The slug must be searched via StockX API
 * to get the actual product with styleId (SKU).
 */
export function extractStockXSlug(url: string): string | null {
  try {
    const parsed = new URL(normalizeUrlForParsing(url))
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    // Product slug is usually the last part after filtering out locale paths
    const slug = pathParts[pathParts.length - 1] || null
    // Validate it looks like a product slug (not a category page)
    if (
      slug &&
      !['sneakers', 'apparel', 'accessories', 'electronics', 'collectibles'].includes(slug)
    ) {
      return slug
    }
    return null
  } catch {
    return null
  }
}

/**
 * Extract catalog ID from Alias URL
 * Example: https://alias.co/catalog/air-jordan-5-retro-grape-2025-hq7978-100
 * Also handles: alias.co/catalog/air-jordan-5-retro-grape-2025-hq7978-100 (no scheme)
 *
 * Alias catalog IDs are slugs like 'air-jordan-5-retro-grape-2025-hq7978-100'
 * which can be used directly with getCatalogItem() API.
 */
export function extractAliasCatalogId(url: string): string | null {
  try {
    const parsed = new URL(normalizeUrlForParsing(url))
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    // Look for 'catalog' followed by the ID
    const catalogIndex = pathParts.indexOf('catalog')
    if (catalogIndex !== -1 && pathParts[catalogIndex + 1]) {
      return pathParts[catalogIndex + 1]
    }
    // Also check for 'product' path (alternate URL format)
    const productIndex = pathParts.indexOf('product')
    if (productIndex !== -1 && pathParts[productIndex + 1]) {
      return pathParts[productIndex + 1]
    }
    return null
  } catch {
    return null
  }
}

// Alias export for backwards compatibility
export { detectInputType as detectInputTypeV4 }
