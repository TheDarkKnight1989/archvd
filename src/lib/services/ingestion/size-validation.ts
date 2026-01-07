/**
 * Size Validation Helpers
 * Filter out invalid sizes based on product category and gender
 */

export type Gender = 'men' | 'women' | 'unisex' | 'youth' | 'toddler' | 'infant';

export interface SizeRange {
  min: number
  max: number
  category: string
  gender?: Gender
}

/**
 * Footwear size ranges by gender
 * Based on US sizing (most common on Alias/StockX)
 * Ranges are inclusive to capture hyped collabs and collector sizes
 */
const FOOTWEAR_SIZE_RANGES: Record<Gender, { min: number; max: number }> = {
  men: { min: 3.5, max: 16 },     // US Men's 3.5-16 (full trading range)
  women: { min: 5, max: 16 },     // US Women's 5-16 (includes large sizes for hyped collabs)
  youth: { min: 3.5, max: 7 },    // Youth 3.5Y-7Y
  toddler: { min: 4, max: 13.5 }, // Toddler 4C-13.5C
  infant: { min: 0, max: 4 },     // Infant 0C-4C
  unisex: { min: 3.5, max: 16 },  // Full range covering both men/women
};

/**
 * Get valid size range for a product category and gender
 * Returns null if no filtering should be applied
 */
export function getSizeRangeForCategory(
  category?: string,
  gender?: string
): SizeRange | null {
  if (!category) return null

  const categoryLower = category.toLowerCase()

  // Sneakers/Footwear - apply gender-specific filtering
  if (
    categoryLower.includes('sneaker') ||
    categoryLower.includes('shoe') ||
    categoryLower.includes('footwear') ||
    categoryLower.includes('boot')
  ) {
    // Normalize gender to our type
    const normalizedGender = normalizeGender(gender)

    // Get gender-specific range, or use unisex as fallback
    const range = normalizedGender
      ? FOOTWEAR_SIZE_RANGES[normalizedGender]
      : FOOTWEAR_SIZE_RANGES.unisex

    return {
      min: range.min,
      max: range.max,
      category: 'footwear',
      gender: normalizedGender || 'unisex',
    }
  }

  // Apparel
  if (
    categoryLower.includes('apparel') ||
    categoryLower.includes('clothing') ||
    categoryLower.includes('shirt') ||
    categoryLower.includes('jacket')
  ) {
    // Apparel uses text sizes (XS, S, M, L, XL, etc.)
    // No numeric filtering needed
    return null
  }

  // Accessories (hats, bags, etc.)
  if (categoryLower.includes('accessories') || categoryLower.includes('collectibles')) {
    // Usually one-size or no size
    return null
  }

  // Default: no filtering if category unknown
  return null
}

/**
 * Normalize gender string to our Gender type
 * Handles variations from different APIs (Alias, StockX)
 */
function normalizeGender(gender?: string): Gender | null {
  if (!gender) return null

  const genderLower = gender.toLowerCase().trim()

  // Men's
  if (genderLower === 'men' || genderLower === 'mens' || genderLower === 'male') {
    return 'men'
  }

  // Women's
  if (genderLower === 'women' || genderLower === 'womens' || genderLower === 'female') {
    return 'women'
  }

  // Youth
  if (genderLower === 'youth' || genderLower === 'grade school' || genderLower === 'gs') {
    return 'youth'
  }

  // Toddler
  if (genderLower === 'toddler' || genderLower === 'preschool' || genderLower === 'ps') {
    return 'toddler'
  }

  // Infant
  if (genderLower === 'infant' || genderLower === 'baby') {
    return 'infant'
  }

  // Unisex
  if (genderLower === 'unisex' || genderLower === 'uni') {
    return 'unisex'
  }

  // Unknown - return null to use unisex default
  return null
}

/**
 * Check if a numeric size is valid for the given category and gender
 */
export function isValidSize(size: number, category?: string, gender?: string): boolean {
  const range = getSizeRangeForCategory(category, gender)

  if (!range) {
    // No filtering - accept all sizes
    return true
  }

  // Check if size is within valid range
  return size >= range.min && size <= range.max
}

/**
 * Check if a size variant should be included in ingestion
 * @param size - Numeric size value
 * @param category - Product category
 * @param gender - Product gender (men, women, youth, etc.)
 * @param hasMarketData - Whether the variant has any pricing data
 * @returns true if should be ingested, false if should be skipped
 */
export function shouldIngestSize(
  size: number,
  category?: string,
  gender?: string,
  hasMarketData?: boolean
): boolean {
  // First check if size is within valid range for category + gender
  if (!isValidSize(size, category, gender)) {
    return false
  }

  // For footwear, be more strict - require at least some market data
  // to avoid storing dead sizes
  const range = getSizeRangeForCategory(category, gender)
  if (range?.category === 'footwear' && hasMarketData === false) {
    // Size is in valid range but has no market data
    // Still include it - market data might come later
    // But this could be made stricter if needed
    return true
  }

  return true
}
