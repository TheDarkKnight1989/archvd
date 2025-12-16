/**
 * Brand-specific size conversion utilities
 *
 * StockX uses US sizes in variant_value field
 * Users store UK sizes in inventory
 * This module handles conversions between formats
 */

export type Gender = 'men' | 'women' | 'gs' | 'preschool' | 'toddler' | 'infant'
export type Brand = 'nike' | 'jordan' | 'adidas' | 'yeezy' | 'yeezy-slides' | 'new-balance' | 'asics' | 'vans' | 'converse' | 'puma' | 'generic'

/**
 * Nike/Jordan Men's Size Chart (US → UK)
 * Source: Nike official size guide
 */
const NIKE_MENS_US_TO_UK: Record<number, number> = {
  3.5: 3,
  4: 3,
  4.5: 3.5,
  5: 4,
  5.5: 4.5,
  6: 5,
  6.5: 5.5,
  7: 6,
  7.5: 6.5,
  8: 7,
  8.5: 7.5,
  9: 8,
  9.5: 8.5,
  10: 9,
  10.5: 9.5,
  11: 10,
  11.5: 10.5,
  12: 11,
  12.5: 11.5,
  13: 12,
  14: 13,
  15: 14,
  16: 15,
  17: 16,
  18: 17,
}

/**
 * Nike/Jordan Women's Size Chart (US → UK)
 * Extended to include larger sizes up to US 18W (UK 15.5)
 */
const NIKE_WOMENS_US_TO_UK: Record<number, number> = {
  5: 2.5,
  5.5: 3,
  6: 3.5,
  6.5: 4,
  7: 4.5,
  7.5: 5,
  8: 5.5,
  8.5: 6,
  9: 6.5,
  9.5: 7,
  10: 7.5,
  10.5: 8,
  11: 8.5,
  11.5: 9,
  12: 9.5,
  12.5: 10,
  13: 10.5,
  13.5: 11,    // UK 11 → US 13.5W
  14: 11.5,
  14.5: 12,
  15: 12.5,
  15.5: 13,
  16: 13.5,
  16.5: 14,
  17: 14.5,
  17.5: 15,
  18: 15.5,
}

/**
 * Nike/Jordan GS (Grade School) Size Chart (US → UK)
 *
 * NOTE: UK 6 appears TWICE in GS sizing:
 * - US 6.5 = UK 6 (EU 39)
 * - US 7 = UK 6 (EU 40)
 *
 * When mapping UK 6 GS sizes, BOTH variants should be shown in UI
 * so the user can select the correct EU size.
 */
const NIKE_GS_US_TO_UK: Record<number, number> = {
  3.5: 3,
  4: 3.5,
  4.5: 4,
  5: 4.5,
  5.5: 5,
  6: 5.5,
  6.5: 6,    // UK 6 (EU 39)
  7: 6,      // UK 6 (EU 40) - DUPLICATE UK SIZE!
}

/**
 * Adidas/Yeezy Men's Size Chart (US → UK)
 * Note: Adidas sizing differs from Nike
 */
const ADIDAS_MENS_US_TO_UK: Record<number, number> = {
  4: 3.5,
  4.5: 4,
  5: 4.5,
  5.5: 5,
  6: 5.5,
  6.5: 6,
  7: 6.5,
  7.5: 7,
  8: 7.5,
  8.5: 8,
  9: 8.5,
  9.5: 9,
  10: 9.5,
  10.5: 10,
  11: 10.5,
  11.5: 11,
  12: 11.5,
  12.5: 12,
  13: 12.5,
  14: 13.5,
  15: 14.5,
}

/**
 * Adidas/Yeezy Women's Size Chart (US → UK)
 */
const ADIDAS_WOMENS_US_TO_UK: Record<number, number> = {
  5: 3.5,
  5.5: 4,
  6: 4.5,
  6.5: 5,
  7: 5.5,
  7.5: 6,
  8: 6.5,
  8.5: 7,
  9: 7.5,
  9.5: 8,
  10: 8.5,
  10.5: 9,
  11: 9.5,
  11.5: 10,
  12: 10.5,
}

/**
 * New Balance Men's Size Chart (US → UK)
 */
const NEW_BALANCE_MENS_US_TO_UK: Record<number, number> = {
  4: 3.5,
  4.5: 4,
  5: 4.5,
  5.5: 5,
  6: 5.5,
  6.5: 6,
  7: 6.5,
  7.5: 7,
  8: 7.5,
  8.5: 8,
  9: 8.5,
  9.5: 9,
  10: 9.5,
  10.5: 10,
  11: 10.5,
  11.5: 11,
  12: 11.5,
  12.5: 12,
  13: 12.5,
  14: 13,
  15: 14,
  16: 15,
}

/**
 * New Balance Women's Size Chart (US → UK)
 */
const NEW_BALANCE_WOMENS_US_TO_UK: Record<number, number> = {
  5: 3,
  5.5: 3.5,
  6: 4,
  6.5: 4.5,
  7: 5,
  7.5: 5.5,
  8: 6,
  8.5: 6.5,
  9: 7,
  9.5: 7.5,
  10: 8,
  10.5: 8.5,
  11: 9,
  11.5: 9.5,
  12: 10,
}

/**
 * Yeezy Slides & Foam RNNR Size Chart (US → UK)
 * UNIQUE: UK = US for Men's (same size!)
 */
const YEEZY_SLIDES_MENS_US_TO_UK: Record<number, number> = {
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 11,
  12: 12,
  13: 13,
  14: 14,
  15: 15,
}

/**
 * Yeezy Slides & Foam RNNR Women's (US → UK)
 * Women's: UK + 1 = US
 */
const YEEZY_SLIDES_WOMENS_US_TO_UK: Record<number, number> = {
  5: 4,
  6: 5,
  7: 6,
  8: 7,
  9: 8,
  10: 9,
  11: 10,
  12: 11,
}

/**
 * ASICS Men's Size Chart (US → UK)
 * Men's: UK + 1 = US
 */
const ASICS_MENS_US_TO_UK: Record<number, number> = {
  4: 3,
  4.5: 3.5,
  5: 4,
  5.5: 4.5,
  6: 5,
  6.5: 5.5,
  7: 6,
  7.5: 6.5,
  8: 7,
  8.5: 7.5,
  9: 8,
  9.5: 8.5,
  10: 9,
  10.5: 9.5,
  11: 10,
  11.5: 10.5,
  12: 11,
  12.5: 11.5,
  13: 12,
  14: 13,
  15: 14,
}

/**
 * ASICS Women's Size Chart (US → UK)
 * Women's: UK + 2 = US
 */
const ASICS_WOMENS_US_TO_UK: Record<number, number> = {
  5: 3,
  5.5: 3.5,
  6: 4,
  6.5: 4.5,
  7: 5,
  7.5: 5.5,
  8: 6,
  8.5: 6.5,
  9: 7,
  9.5: 7.5,
  10: 8,
  10.5: 8.5,
  11: 9,
  11.5: 9.5,
  12: 10,
}

/**
 * Vans Men's Size Chart (US → UK)
 * Men's: UK + 1 = US
 */
const VANS_MENS_US_TO_UK: Record<number, number> = {
  3.5: 2.5,
  4: 3,
  4.5: 3.5,
  5: 4,
  5.5: 4.5,
  6: 5,
  6.5: 5.5,
  7: 6,
  7.5: 6.5,
  8: 7,
  8.5: 7.5,
  9: 8,
  9.5: 8.5,
  10: 9,
  10.5: 9.5,
  11: 10,
  11.5: 10.5,
  12: 11,
  13: 12,
}

/**
 * Vans Women's Size Chart (US → UK)
 * Women's: UK + 2.5 = US
 */
const VANS_WOMENS_US_TO_UK: Record<number, number> = {
  5: 2.5,
  5.5: 3,
  6: 3.5,
  6.5: 4,
  7: 4.5,
  7.5: 5,
  8: 5.5,
  8.5: 6,
  9: 6.5,
  9.5: 7,
  10: 7.5,
  10.5: 8,
  11: 8.5,
}

/**
 * Converse Men's Size Chart (US → UK)
 * UNIQUE: UK = US for Men's (same size!)
 */
const CONVERSE_MENS_US_TO_UK: Record<number, number> = {
  3: 3,
  3.5: 3.5,
  4: 4,
  4.5: 4.5,
  5: 5,
  5.5: 5.5,
  6: 6,
  6.5: 6.5,
  7: 7,
  7.5: 7.5,
  8: 8,
  8.5: 8.5,
  9: 9,
  9.5: 9.5,
  10: 10,
  10.5: 10.5,
  11: 11,
  11.5: 11.5,
  12: 12,
  13: 13,
}

/**
 * Converse Women's Size Chart (US → UK)
 * Women's: UK + 2 = US
 */
const CONVERSE_WOMENS_US_TO_UK: Record<number, number> = {
  5: 3,
  5.5: 3.5,
  6: 4,
  6.5: 4.5,
  7: 5,
  7.5: 5.5,
  8: 6,
  8.5: 6.5,
  9: 7,
  9.5: 7.5,
  10: 8,
  10.5: 8.5,
  11: 9,
  11.5: 9.5,
  12: 10,
}

/**
 * Puma Men's Size Chart (US → UK)
 * Men's: UK + 1 = US
 */
const PUMA_MENS_US_TO_UK: Record<number, number> = {
  6: 5,
  6.5: 5.5,
  7: 6,
  7.5: 6.5,
  8: 7,
  8.5: 7.5,
  9: 8,
  9.5: 8.5,
  10: 9,
  10.5: 9.5,
  11: 10,
  11.5: 10.5,
  12: 11,
  12.5: 11.5,
  13: 12,
  14: 13,
  15: 14,
  16: 15,
}

/**
 * Puma Women's Size Chart (US → UK)
 * Women's: UK + 2.5 = US
 */
const PUMA_WOMENS_US_TO_UK: Record<number, number> = {
  5.5: 3,
  6: 3.5,
  6.5: 4,
  7: 4.5,
  7.5: 5,
  8: 5.5,
  8.5: 6,
  9: 6.5,
  9.5: 7,
  10: 7.5,
  10.5: 8,
  11: 8.5,
}

/**
 * Detect brand from product title or brand field
 */
export function detectBrand(brandName?: string | null, productTitle?: string | null): Brand {
  const brand = (brandName || '').toLowerCase()
  const title = (productTitle || '').toLowerCase()
  const text = `${brand} ${title}`

  // Yeezy Slides & Foam RNNR have unique sizing - check BEFORE generic Yeezy
  if (text.includes('yeezy') && (title.includes('slide') || title.includes('foam') || title.includes('rnnr') || title.includes('rnr'))) {
    return 'yeezy-slides'
  }

  if (text.includes('jordan')) return 'jordan'
  if (text.includes('nike')) return 'nike'
  if (text.includes('yeezy')) return 'yeezy'
  if (text.includes('adidas')) return 'adidas'
  if (text.includes('new balance')) return 'new-balance'
  if (text.includes('asics')) return 'asics'
  if (text.includes('vans')) return 'vans'
  if (text.includes('converse')) return 'converse'
  if (text.includes('puma')) return 'puma'

  return 'generic'
}

/**
 * Detect gender from product title
 */
export function detectGender(productTitle?: string | null): Gender {
  const title = (productTitle || '').toLowerCase()

  if (title.includes("women's") || title.includes('wmns')) return 'women'
  if (title.includes('grade school') || title.includes(' gs')) return 'gs'
  if (title.includes('preschool') || title.includes(' ps')) return 'preschool'
  if (title.includes('toddler') || title.includes(' td')) return 'toddler'
  if (title.includes('infant')) return 'infant'

  // Default to men's if not specified
  return 'men'
}

/**
 * Get the appropriate size chart for a brand/gender combo
 */
function getSizeChart(brand: Brand, gender: Gender): Record<number, number> {
  // Nike/Jordan
  if (brand === 'nike' || brand === 'jordan') {
    if (gender === 'women') return NIKE_WOMENS_US_TO_UK
    if (gender === 'gs' || gender === 'preschool') return NIKE_GS_US_TO_UK
    return NIKE_MENS_US_TO_UK
  }

  // Yeezy Slides & Foam RNNR (unique sizing - UK = US for men's)
  if (brand === 'yeezy-slides') {
    if (gender === 'women') return YEEZY_SLIDES_WOMENS_US_TO_UK
    return YEEZY_SLIDES_MENS_US_TO_UK
  }

  // Adidas/Yeezy (regular sneakers)
  if (brand === 'adidas' || brand === 'yeezy') {
    if (gender === 'women') return ADIDAS_WOMENS_US_TO_UK
    return ADIDAS_MENS_US_TO_UK
  }

  // New Balance
  if (brand === 'new-balance') {
    if (gender === 'women') return NEW_BALANCE_WOMENS_US_TO_UK
    return NEW_BALANCE_MENS_US_TO_UK
  }

  // ASICS
  if (brand === 'asics') {
    if (gender === 'women') return ASICS_WOMENS_US_TO_UK
    return ASICS_MENS_US_TO_UK
  }

  // Vans
  if (brand === 'vans') {
    if (gender === 'women') return VANS_WOMENS_US_TO_UK
    return VANS_MENS_US_TO_UK
  }

  // Converse (unique sizing - UK = US for men's)
  if (brand === 'converse') {
    if (gender === 'women') return CONVERSE_WOMENS_US_TO_UK
    return CONVERSE_MENS_US_TO_UK
  }

  // Puma
  if (brand === 'puma') {
    if (gender === 'women') return PUMA_WOMENS_US_TO_UK
    return PUMA_MENS_US_TO_UK
  }

  // Generic/fallback - use Nike chart as default
  if (gender === 'women') return NIKE_WOMENS_US_TO_UK
  return NIKE_MENS_US_TO_UK
}

/**
 * Convert US size to UK size
 */
export function convertUsToUk(
  usSize: number,
  brand: Brand,
  gender: Gender
): number | null {
  const chart = getSizeChart(brand, gender)
  return chart[usSize] ?? null
}

/**
 * Convert UK size to US size (reverse lookup)
 * Returns the FIRST match found
 *
 * NOTE: For GS UK 6, this will only return US 6.5
 * Use `getAllUsSizesForUk()` to get both US 6.5 and US 7
 */
export function convertUkToUs(
  ukSize: number,
  brand: Brand,
  gender: Gender
): number | null {
  const chart = getSizeChart(brand, gender)

  // Find the US size that maps to this UK size
  for (const [us, uk] of Object.entries(chart)) {
    if (uk === ukSize) {
      return parseFloat(us)
    }
  }

  return null
}

/**
 * Get ALL US sizes that map to a UK size
 * Handles duplicate UK sizes (e.g., GS UK 6 → both US 6.5 and US 7)
 *
 * This should be used in UI to show all size options when mapping
 */
export function getAllUsSizesForUk(
  ukSize: number,
  brand: Brand,
  gender: Gender
): number[] {
  const chart = getSizeChart(brand, gender)
  const matches: number[] = []

  // Find ALL US sizes that map to this UK size
  for (const [us, uk] of Object.entries(chart)) {
    if (uk === ukSize) {
      matches.push(parseFloat(us))
    }
  }

  return matches.sort((a, b) => a - b)
}

/**
 * Find closest US size match for a UK size (with tolerance)
 */
export function findClosestUsSize(
  ukSize: number,
  brand: Brand,
  gender: Gender,
  tolerance: number = 0.5
): number | null {
  const exactMatch = convertUkToUs(ukSize, brand, gender)
  if (exactMatch !== null) return exactMatch

  // Try to find closest match within tolerance
  const chart = getSizeChart(brand, gender)
  let closestUs: number | null = null
  let closestDiff = Infinity

  for (const [us, uk] of Object.entries(chart)) {
    const diff = Math.abs(uk - ukSize)
    if (diff < closestDiff && diff <= tolerance) {
      closestDiff = diff
      closestUs = parseFloat(us)
    }
  }

  return closestUs
}

/**
 * Get all available UK sizes for a brand/gender
 */
export function getAvailableUkSizes(brand: Brand, gender: Gender): number[] {
  const chart = getSizeChart(brand, gender)
  return Array.from(new Set(Object.values(chart))).sort((a, b) => a - b)
}

/**
 * Get all available US sizes for a brand/gender
 */
export function getAvailableUsSizes(brand: Brand, gender: Gender): number[] {
  const chart = getSizeChart(brand, gender)
  return Object.keys(chart).map(Number).sort((a, b) => a - b)
}

// =============================================================================
// COMPREHENSIVE SIZE CONVERSION (UK/EU → US with W suffix)
// =============================================================================

/**
 * EU to US conversion offsets by brand (subtract from EU to get approximate US)
 * These are approximations - exact values vary by model
 */
const EU_TO_US_OFFSET: Record<Brand, { mens: number; womens: number }> = {
  nike: { mens: 33, womens: 31 },
  jordan: { mens: 33, womens: 31 },
  adidas: { mens: 33.33, womens: 31 },
  yeezy: { mens: 33.33, womens: 31 },
  'yeezy-slides': { mens: 34.5, womens: 33.5 },
  'new-balance': { mens: 34, womens: 32 },
  asics: { mens: 34, womens: 32 },
  vans: { mens: 33.5, womens: 31.5 },
  converse: { mens: 34, womens: 32 },
  puma: { mens: 33, womens: 31 },
  generic: { mens: 33, womens: 31.5 },
}

/**
 * Check if gender indicates women's product
 */
function isWomensGender(gender: string | null | undefined): boolean {
  if (!gender) return false
  const g = gender.toLowerCase()
  return g === 'women' || g === 'womens' || g === "women's" || g === 'female' || g === 'w'
}

/**
 * Convert any size unit (UK/EU/US) to US size string, with W suffix for women's.
 * This is the main function for market data lookups.
 *
 * @param size - Size value as string (e.g., "11")
 * @param unit - Size unit: "US", "UK", or "EU"
 * @param gender - Gender string or null (e.g., "women", "men", null)
 * @param brandName - Brand name for brand-specific conversion
 * @param productName - Product name for brand/gender detection fallback
 * @returns US size string with W suffix if women's (e.g., "12" or "13.5W")
 */
export function convertToUsSize(
  size: string,
  unit: string,
  gender?: string | null,
  brandName?: string | null,
  productName?: string | null
): string {
  const num = parseFloat(size)
  if (isNaN(num)) return size // Non-numeric sizes pass through

  const brand = detectBrand(brandName, productName)

  // Detect gender: use explicit gender if provided, otherwise detect from product name
  let isWomens: boolean
  if (gender) {
    isWomens = isWomensGender(gender)
  } else {
    // Auto-detect from product name if gender not explicitly provided
    const detected = detectGender(productName)
    isWomens = detected === 'women'
  }
  let usSize: number

  if (unit === 'US') {
    usSize = num
  } else if (unit === 'UK') {
    // Use lookup table for UK → US
    const detected = isWomens ? convertUkToUs(num, brand, 'women') : convertUkToUs(num, brand, 'men')
    if (detected !== null) {
      usSize = detected
    } else {
      // Fallback: estimate using typical offset
      // Nike/Jordan/ASICS: +1 men's, +2.5 women's
      // Adidas/NB: +0.5 men's, +1.5-2 women's
      // Vans/Puma: +1 men's, +2.5 women's
      // Converse/YeezySlides: +0 men's
      usSize = num + (isWomens ? 2.5 : 1) // Safe default (Nike Women's UK→US is +2.5)
    }
  } else if (unit === 'EU') {
    const offset = EU_TO_US_OFFSET[brand] ?? EU_TO_US_OFFSET.generic
    usSize = num - (isWomens ? offset.womens : offset.mens)
  } else {
    return size // Unknown unit, pass through
  }

  // Round to nearest 0.5 for cleaner sizes
  const rounded = Math.round(usSize * 2) / 2
  const formatted = rounded % 1 === 0 ? String(rounded) : String(rounded)

  // Add W suffix for women's products (StockX format)
  return isWomens ? formatted + 'W' : formatted
}
