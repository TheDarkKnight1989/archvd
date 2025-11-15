/**
 * Size Normalization Utilities
 *
 * Convert between size systems and normalize to UK as the canonical format
 */

import type { SizeSystem, ProductSizes } from '@/types/product'

/**
 * Parse a size string to extract system and value
 * Examples: "UK9", "US10", "9", "10.5"
 */
export function parseSize(sizeStr: string | null | undefined): {
  system: SizeSystem | null
  value: string | null
} {
  if (!sizeStr) return { system: null, value: null }

  const cleaned = sizeStr.trim().toUpperCase()

  // Check for explicit system prefix
  if (cleaned.startsWith('UK')) {
    return { system: 'UK', value: cleaned.substring(2).trim() }
  }
  if (cleaned.startsWith('US')) {
    return { system: 'US', value: cleaned.substring(2).trim() }
  }
  if (cleaned.startsWith('EU')) {
    return { system: 'EU', value: cleaned.substring(2).trim() }
  }
  if (cleaned.startsWith('JP')) {
    return { system: 'JP', value: cleaned.substring(2).trim() }
  }

  // If no prefix, assume it's already a numeric value (system unknown)
  return { system: null, value: cleaned }
}

/**
 * Convert a size to UK system
 * Approximate conversions - extend with proper conversion tables as needed
 */
export function convertToUk(
  size: string | number,
  fromSystem: SizeSystem,
  gender: 'M' | 'W' | 'GS' | null = null
): string {
  const numSize = typeof size === 'number' ? size : parseFloat(String(size))

  if (isNaN(numSize)) return String(size) // Return as-is if not numeric

  switch (fromSystem) {
    case 'UK':
      return String(size)

    case 'US':
      // US to UK conversion (approximate)
      // US Men's = UK + 1
      // US Women's = UK + 2
      const offset = gender === 'W' ? 2 : 1
      return String(numSize - offset)

    case 'EU':
      // EU to UK (approximate): UK = (EU - 33.5) / 1.5
      return String(Math.round((numSize - 33.5) / 1.5 * 2) / 2) // Round to nearest 0.5

    case 'JP':
      // JP (cm) to UK (approximate): UK = (JP - 22) / 1.5
      return String(Math.round((numSize - 22) / 1.5 * 2) / 2)

    default:
      return String(size)
  }
}

/**
 * Normalize size data to UK system
 * Priority: uk > us > eu > size > size_uk > size_alt
 */
export function normalizeSizeToUk(sizeData: {
  size?: string | null
  size_uk?: string | null
  size_alt?: string | null
  uk?: string | null
  us?: string | null
  eu?: string | null
  jp?: string | null
}): string | null {
  // 1. Direct UK fields
  if (sizeData.uk) return sizeData.uk
  if (sizeData.size_uk) return sizeData.size_uk

  // 2. Try parsing from generic 'size' field
  if (sizeData.size) {
    const parsed = parseSize(sizeData.size)
    if (parsed.system === 'UK' && parsed.value) {
      return parsed.value
    }
    // If no system specified, try to convert
    if (parsed.system && parsed.value) {
      return convertToUk(parsed.value, parsed.system)
    }
    // If just a number, assume UK
    if (parsed.value && !isNaN(parseFloat(parsed.value))) {
      return parsed.value
    }
  }

  // 3. Convert from other systems
  if (sizeData.us) {
    const parsed = parseSize(sizeData.us)
    if (parsed.value) {
      return convertToUk(parsed.value, 'US')
    }
  }

  if (sizeData.eu) {
    const parsed = parseSize(sizeData.eu)
    if (parsed.value) {
      return convertToUk(parsed.value, 'EU')
    }
  }

  if (sizeData.jp) {
    const parsed = parseSize(sizeData.jp)
    if (parsed.value) {
      return convertToUk(parsed.value, 'JP')
    }
  }

  // 4. Fallback to size_alt
  if (sizeData.size_alt) {
    const parsed = parseSize(sizeData.size_alt)
    if (parsed.value) {
      return parsed.system === 'UK' ? parsed.value : convertToUk(parsed.value, parsed.system || 'UK')
    }
  }

  return null
}

/**
 * Format size for display
 * Examples: "9" → "UK 9", "10.5" → "UK 10.5"
 */
export function formatSizeDisplay(
  size: string | null,
  system: SizeSystem = 'UK',
  gender: 'M' | 'W' | 'GS' | null = null
): string | null {
  if (!size) return null

  const genderLabel = gender && gender !== 'M' ? ` ${gender}` : ''
  return `${system}${genderLabel} ${size}`
}

/**
 * Build ProductSizes object from various size fields
 */
export function buildProductSizes(sizeData: {
  size?: string | null
  size_uk?: string | null
  size_alt?: string | null
  uk?: string | null
  us?: string | null
  eu?: string | null
  jp?: string | null
}): ProductSizes {
  const ukSize = normalizeSizeToUk(sizeData)

  return {
    uk: ukSize,
    us: sizeData.us || null,
    eu: sizeData.eu || null,
    jp: sizeData.jp || null,
  }
}
