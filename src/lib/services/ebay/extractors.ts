/**
 * eBay Data Extraction Utilities
 * Extracts SKUs and sizes from eBay item data (titles, variations, etc.)
 */

import type { EbayVariation, EbaySoldItem, EbayShippingOption } from './types'

// ============================================================================
// SKU EXTRACTION
// ============================================================================

/**
 * Common sneaker SKU patterns
 * Examples: DD1391-100, DZ5485-410, M990GL6, 554724-136
 */
const SKU_PATTERNS = [
  // Nike style codes: 6 letters/digits + hyphen + 3 digits (e.g., DD1391-100)
  /\b([A-Z]{2}\d{4}-\d{3})\b/i,

  // Jordan/Nike codes with letters: 2 letters + 4 digits + hyphen + 3 digits (e.g., DZ5485-410)
  /\b([A-Z]{2}\d{4}-\d{3})\b/i,

  // New Balance style codes: M/W + 3-4 digits + 2-3 letters (e.g., M990GL6, W990GL5)
  /\b([MW]\d{3,4}[A-Z]{2,3}\d?)\b/i,

  // Air Jordan numeric codes: 6 digits + hyphen + 3 digits (e.g., 554724-136)
  /\b(\d{6}-\d{3})\b/,

  // Adidas codes: 2 letters + 4 digits (e.g., FZ5000, GY7924)
  /\b([A-Z]{2}\d{4})\b/i,

  // Yeezy codes: letters + numbers mixed (e.g., GW3773, GZ5541)
  /\b([A-Z]{2}\d{4})\b/i,
]

/**
 * Extract SKU from eBay item title
 * Returns the first matching SKU pattern found
 */
export function extractSKUFromTitle(title: string): string | null {
  if (!title) return null

  for (const pattern of SKU_PATTERNS) {
    const match = title.match(pattern)
    if (match) {
      return match[1].toUpperCase()
    }
  }

  return null
}

// ============================================================================
// SIZE EXTRACTION WITH SYSTEM DETECTION
// ============================================================================

export type SizeSystem = 'US' | 'UK' | 'EU' | 'UNKNOWN'
export type SizeConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

export interface ExtractedSize {
  size: string // Raw size value (e.g., "10.5", "11.5", "44")
  system: SizeSystem // US, UK, EU, or UNKNOWN
  confidence: SizeConfidence // How confident we are in the system detection
  normalizedKey: string // Normalized size key for storage (e.g., "US 10.5", "UK 11.5")
}

/**
 * Size aspect names to look for in variations
 * eBay returns size in localizedAspects with various names
 */
const SIZE_ASPECT_NAMES = [
  "US Shoe Size (Men's)",
  "US Shoe Size (Women's)",
  'US Shoe Size',
  'UK Shoe Size',
  'EU Shoe Size',
  'Size',
  'Shoe Size',
]

/**
 * Extract size from variation's localizedAspects with system detection
 */
export function extractSizeFromVariation(variation: EbayVariation): ExtractedSize | null {
  if (!variation.localizedAspects) return null

  for (const aspect of variation.localizedAspects) {
    const name = aspect.name

    // US Size - HIGH confidence
    if (name.includes('US Shoe Size')) {
      return {
        size: aspect.value,
        system: 'US',
        confidence: 'HIGH',
        normalizedKey: `US ${aspect.value}`,
      }
    }

    // UK Size - HIGH confidence
    if (name.includes('UK Shoe Size')) {
      return {
        size: aspect.value,
        system: 'UK',
        confidence: 'HIGH',
        normalizedKey: `UK ${aspect.value}`,
      }
    }

    // EU Size - HIGH confidence
    if (name.includes('EU Shoe Size')) {
      return {
        size: aspect.value,
        system: 'EU',
        confidence: 'HIGH',
        normalizedKey: `EU ${aspect.value}`,
      }
    }

    // Generic "Size" or "Shoe Size" - UNKNOWN system, LOW confidence
    if (name === 'Size' || name === 'Shoe Size') {
      return {
        size: aspect.value,
        system: 'UNKNOWN',
        confidence: 'LOW',
        normalizedKey: aspect.value, // No prefix for unknown
      }
    }
  }

  return null
}

/**
 * Extract all unique sizes from variations array
 * Returns array of extracted sizes with system info
 */
export function extractSizesFromVariations(variations?: EbayVariation[]): ExtractedSize[] {
  if (!variations || variations.length === 0) return []

  const sizes: ExtractedSize[] = []

  for (const variation of variations) {
    const extractedSize = extractSizeFromVariation(variation)
    if (extractedSize) {
      sizes.push(extractedSize)
    }
  }

  return sizes
}

/**
 * Extract size from title with system detection
 * Patterns:
 * - "Size 10", "Size 10.5" → US (default, MEDIUM confidence)
 * - "10.5 US", "US 10.5" → US (HIGH confidence)
 * - "UK 11.5", "11.5 UK" → UK (HIGH confidence)
 * - "EU 44", "44 EU" → EU (HIGH confidence)
 * - "Men's 10.5" → US (default, MEDIUM confidence)
 */
export function extractSizeFromTitle(title: string): ExtractedSize | null {
  if (!title) return null

  // HIGH confidence patterns with explicit system

  // Pattern: "US 10.5" or "10.5 US"
  const usExplicit = title.match(/\b(?:US\s+)?(\d+(?:\.\d+)?)\s*US\b/i)
  if (usExplicit) {
    return {
      size: usExplicit[1],
      system: 'US',
      confidence: 'HIGH',
      normalizedKey: `US ${usExplicit[1]}`,
    }
  }

  // Pattern: "UK 11.5" or "11.5 UK" or "Uk 11.5"
  const ukExplicit = title.match(/\b(?:UK|Uk)\s+(\d+(?:\.\d+)?)\b|\b(\d+(?:\.\d+)?)\s*(?:UK|Uk)\b/i)
  if (ukExplicit) {
    const size = ukExplicit[1] || ukExplicit[2]
    return {
      size,
      system: 'UK',
      confidence: 'HIGH',
      normalizedKey: `UK ${size}`,
    }
  }

  // Pattern: "EU 44" or "44 EU"
  const euExplicit = title.match(/\bEU\s+(\d+(?:\.\d+)?)\b|\b(\d+(?:\.\d+)?)\s*EU\b/i)
  if (euExplicit) {
    const size = euExplicit[1] || euExplicit[2]
    return {
      size,
      system: 'EU',
      confidence: 'HIGH',
      normalizedKey: `EU ${size}`,
    }
  }

  // MEDIUM confidence patterns (assume US by default for Nike/Jordan)

  // Pattern: "Size 10" or "Size 10.5"
  const sizeGeneric = title.match(/\bSize:?\s+(\d+(?:\.\d+)?)\b/i)
  if (sizeGeneric) {
    return {
      size: sizeGeneric[1],
      system: 'US', // Default to US for Nike/Jordan
      confidence: 'MEDIUM',
      normalizedKey: `US ${sizeGeneric[1]}`,
    }
  }

  // Pattern: "Men's 10.5" or "Women's 10.5"
  const genderSize = title.match(/\b(?:Men's|Women's)\s+(\d+(?:\.\d+)?)\b/i)
  if (genderSize) {
    return {
      size: genderSize[1],
      system: 'US', // Default to US
      confidence: 'MEDIUM',
      normalizedKey: `US ${genderSize[1]}`,
    }
  }

  return null
}

/**
 * Extract size from item-level localizedAspects (for single-size AG listings)
 * eBay stores size data in localizedAspects at item level for AG sneakers
 *
 * When multiple sizing systems are present (UK + US + EU), prefer marketplace's native system:
 * - EBAY_GB: prefer UK > EU > US
 * - EBAY_US: prefer US > UK > EU
 */
export function extractSizeFromItemAspects(
  aspects?: Array<{ name: string; value: string }>,
  marketplaceId: string = 'EBAY_GB'
): ExtractedSize | null {
  if (!aspects) return null

  // Collect all available size systems
  const sizes: { uk?: string; us?: string; eu?: string; generic?: string } = {}

  for (const aspect of aspects) {
    const name = aspect.name

    if (name.includes('UK Shoe Size')) {
      sizes.uk = aspect.value
    } else if (name.includes('US Shoe Size')) {
      sizes.us = aspect.value
    } else if (name.includes('EU Shoe Size')) {
      sizes.eu = aspect.value
    } else if (name === 'Size') {
      sizes.generic = aspect.value
    }
  }

  // Prefer marketplace's native size system
  if (marketplaceId === 'EBAY_GB') {
    // UK marketplace: prefer UK > EU > US
    if (sizes.uk) {
      return {
        size: sizes.uk,
        system: 'UK',
        confidence: 'HIGH',
        normalizedKey: `UK ${sizes.uk}`,
      }
    }
    if (sizes.eu) {
      return {
        size: sizes.eu,
        system: 'EU',
        confidence: 'HIGH',
        normalizedKey: `EU ${sizes.eu}`,
      }
    }
    if (sizes.us) {
      return {
        size: sizes.us,
        system: 'US',
        confidence: 'HIGH',
        normalizedKey: `US ${sizes.us}`,
      }
    }
  } else {
    // US marketplace: prefer US > UK > EU
    if (sizes.us) {
      return {
        size: sizes.us,
        system: 'US',
        confidence: 'HIGH',
        normalizedKey: `US ${sizes.us}`,
      }
    }
    if (sizes.uk) {
      return {
        size: sizes.uk,
        system: 'UK',
        confidence: 'HIGH',
        normalizedKey: `UK ${sizes.uk}`,
      }
    }
    if (sizes.eu) {
      return {
        size: sizes.eu,
        system: 'EU',
        confidence: 'HIGH',
        normalizedKey: `EU ${sizes.eu}`,
      }
    }
  }

  // Fallback to generic "Size" - assume US
  if (sizes.generic) {
    return {
      size: sizes.generic,
      system: 'US',
      confidence: 'MEDIUM',
      normalizedKey: `US ${sizes.generic}`,
    }
  }

  return null
}

/**
 * Extract best available size from item with system detection
 * Priority: item localizedAspects > variations > title
 */
export function extractBestSize(item: EbaySoldItem): ExtractedSize | null {
  // FIRST: Check item-level localizedAspects (for single-size AG listings)
  // This is where eBay stores structured size data for AG sneakers!
  const itemDetails = item as any // Cast to access localizedAspects from full details
  if (itemDetails.localizedAspects) {
    const sizeFromAspects = extractSizeFromItemAspects(itemDetails.localizedAspects)
    if (sizeFromAspects) {
      return sizeFromAspects
    }
  }

  // SECOND: Try variations (for multi-size listings - rare for AG)
  if (item.variations && item.variations.length > 0) {
    const sizes = extractSizesFromVariations(item.variations)
    // If single size found, return it
    if (sizes.length === 1) {
      return sizes[0]
    }
    // If multiple sizes found, can't determine which one sold
    if (sizes.length > 1) {
      return null // Can't determine which size sold
    }
  }

  // LAST: Fallback to title extraction
  return extractSizeFromTitle(item.title)
}

// ============================================================================
// SHIPPING EXTRACTION
// ============================================================================

/**
 * Find cheapest shipping option
 * Returns shipping cost in major units (e.g., 5.99 for £5.99)
 */
export function extractCheapestShipping(
  shippingOptions?: EbayShippingOption[]
): number | null {
  if (!shippingOptions || shippingOptions.length === 0) return null

  let cheapest: number | null = null

  for (const option of shippingOptions) {
    const cost = parseFloat(option.shippingCost.value)
    if (!isNaN(cost)) {
      if (cheapest === null || cost < cheapest) {
        cheapest = cost
      }
    }
  }

  return cheapest
}

// ============================================================================
// ENRICHMENT
// ============================================================================

/**
 * Enrich eBay sold item with extracted data
 * Mutates the item in place
 */
export function enrichEbaySoldItem(item: EbaySoldItem): void {
  // Extract SKU from title
  item.extractedSKU = extractSKUFromTitle(item.title)

  // Extract size with system detection (variations > title)
  const sizeInfo = extractBestSize(item)
  if (sizeInfo) {
    item.sizeInfo = sizeInfo
    // Backward compat: populate extractedSize with normalized key
    item.extractedSize = sizeInfo.normalizedKey
  }

  // Extract cheapest shipping
  if (item.shippingOptions) {
    item.shippingCost = extractCheapestShipping(item.shippingOptions)
  }
}
