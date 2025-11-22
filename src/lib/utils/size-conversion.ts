/**
 * Brand-specific size conversion utilities
 *
 * StockX uses US sizes in variant_value field
 * Users store UK sizes in inventory
 * This module handles conversions between formats
 */

export type Gender = 'men' | 'women' | 'gs' | 'preschool' | 'toddler' | 'infant'
export type Brand = 'nike' | 'jordan' | 'adidas' | 'yeezy' | 'new-balance' | 'generic'

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
 * Detect brand from product title or brand field
 */
export function detectBrand(brandName?: string | null, productTitle?: string | null): Brand {
  const text = `${brandName || ''} ${productTitle || ''}`.toLowerCase()

  if (text.includes('jordan')) return 'jordan'
  if (text.includes('nike')) return 'nike'
  if (text.includes('yeezy')) return 'yeezy'
  if (text.includes('adidas')) return 'adidas'
  if (text.includes('new balance')) return 'new-balance'

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

  // Adidas/Yeezy
  if (brand === 'adidas' || brand === 'yeezy') {
    if (gender === 'women') return ADIDAS_WOMENS_US_TO_UK
    return ADIDAS_MENS_US_TO_UK
  }

  // New Balance
  if (brand === 'new-balance') {
    if (gender === 'women') return NEW_BALANCE_WOMENS_US_TO_UK
    return NEW_BALANCE_MENS_US_TO_UK
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
