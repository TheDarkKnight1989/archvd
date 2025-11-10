/**
 * Size Mapping Utilities
 * Convert between different shoe size systems (US, UK, EU, JP)
 */

// ============================================================================
// Types
// ============================================================================

export type SizeSystem = 'US' | 'UK' | 'EU' | 'JP'

export interface SizeConversion {
  us: number
  uk: number
  eu: number
  jp: number
}

// ============================================================================
// Size Conversion Table (Men's Sizes)
// ============================================================================

const MENS_SIZE_TABLE: SizeConversion[] = [
  { us: 6, uk: 5.5, eu: 38.5, jp: 24 },
  { us: 6.5, uk: 6, eu: 39, jp: 24.5 },
  { us: 7, uk: 6, eu: 40, jp: 25 },
  { us: 7.5, uk: 6.5, eu: 40.5, jp: 25.5 },
  { us: 8, uk: 7, eu: 41, jp: 26 },
  { us: 8.5, uk: 7.5, eu: 42, jp: 26.5 },
  { us: 9, uk: 8, eu: 42.5, jp: 27 },
  { us: 9.5, uk: 8.5, eu: 43, jp: 27.5 },
  { us: 10, uk: 9, eu: 44, jp: 28 },
  { us: 10.5, uk: 9.5, eu: 44.5, jp: 28.5 },
  { us: 11, uk: 10, eu: 45, jp: 29 },
  { us: 11.5, uk: 10.5, eu: 45.5, jp: 29.5 },
  { us: 12, uk: 11, eu: 46, jp: 30 },
  { us: 12.5, uk: 11.5, eu: 47, jp: 30.5 },
  { us: 13, uk: 12, eu: 47.5, jp: 31 },
  { us: 14, uk: 13, eu: 48.5, jp: 32 },
  { us: 15, uk: 14, eu: 49.5, jp: 33 },
]

// ============================================================================
// Size Conversion Functions
// ============================================================================

/**
 * Parse size string to number
 */
export function parseSize(size: string | number): number | null {
  if (typeof size === 'number') return size

  const cleaned = size.trim().replace(/[^\d.]/g, '')
  const parsed = parseFloat(cleaned)

  return isNaN(parsed) ? null : parsed
}

/**
 * Convert size between systems
 */
export function convertSize(
  size: string | number,
  fromSystem: SizeSystem,
  toSystem: SizeSystem
): number | null {
  if (fromSystem === toSystem) {
    return parseSize(size)
  }

  const sizeNum = parseSize(size)
  if (sizeNum === null) return null

  // Find closest match in conversion table
  const fromKey = fromSystem.toLowerCase() as keyof SizeConversion
  const toKey = toSystem.toLowerCase() as keyof SizeConversion

  let closest: SizeConversion | null = null
  let minDiff = Infinity

  for (const row of MENS_SIZE_TABLE) {
    const diff = Math.abs(row[fromKey] - sizeNum)
    if (diff < minDiff) {
      minDiff = diff
      closest = row
    }
  }

  return closest ? closest[toKey] : null
}

/**
 * Convert to UK size (our default storage format)
 */
export function toUkSize(size: string | number, system: SizeSystem = 'US'): number | null {
  return convertSize(size, system, 'UK')
}

/**
 * Convert from UK size to target system
 */
export function fromUkSize(ukSize: string | number, targetSystem: SizeSystem = 'US'): number | null {
  return convertSize(ukSize, 'UK', targetSystem)
}

/**
 * Format size for display
 */
export function formatSize(size: number, system: SizeSystem = 'UK'): string {
  if (size % 1 === 0) {
    return `${system} ${size}`
  }
  return `${system} ${size.toFixed(1)}`
}

/**
 * Normalize size string to UK size
 * Handles various formats like "US 10", "10.5", "UK 9", etc.
 */
export function normalizeSizeToUk(sizeStr: string): number | null {
  if (!sizeStr) return null

  const str = sizeStr.trim().toUpperCase()

  // Check if size system is specified
  let system: SizeSystem = 'US' // Default to US
  let sizeValue = str

  if (str.startsWith('UK')) {
    system = 'UK'
    sizeValue = str.replace(/^UK\s*/i, '')
  } else if (str.startsWith('US')) {
    system = 'US'
    sizeValue = str.replace(/^US\s*/i, '')
  } else if (str.startsWith('EU')) {
    system = 'EU'
    sizeValue = str.replace(/^EU\s*/i, '')
  } else if (str.startsWith('JP')) {
    system = 'JP'
    sizeValue = str.replace(/^JP\s*/i, '')
  }

  return toUkSize(sizeValue, system)
}

/**
 * Get all size variants for a UK size
 * Returns UK, US, EU, JP equivalents
 */
export function getSizeVariants(ukSize: number): Record<SizeSystem, number | null> {
  return {
    UK: ukSize,
    US: fromUkSize(ukSize, 'US'),
    EU: fromUkSize(ukSize, 'EU'),
    JP: fromUkSize(ukSize, 'JP'),
  }
}

/**
 * Check if two sizes are equivalent (accounting for system differences)
 */
export function sizesEquivalent(
  size1: string | number,
  system1: SizeSystem,
  size2: string | number,
  system2: SizeSystem
): boolean {
  const uk1 = toUkSize(size1, system1)
  const uk2 = toUkSize(size2, system2)

  if (uk1 === null || uk2 === null) return false

  // Allow small tolerance for rounding
  return Math.abs(uk1 - uk2) < 0.1
}
