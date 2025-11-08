/**
 * Strict SKU extraction and validation
 *
 * Patterns:
 * - Nike: AA1234-123 or ABC123-456 (5-6 alphanum + hyphen + 3 digits)
 * - Jordan/Adidas: 9-12 alphanumeric with optional hyphen
 * - Reject: Pure numbers, too short (<6 chars), common false positives
 */

/**
 * Nike SKU pattern: 5-6 alphanumeric characters, hyphen, 3 digits
 * Examples: CT8527-016, DZ5485-612, DD1391-100
 */
const NIKE_PATTERN = /\b[A-Z0-9]{5,6}-\d{3}\b/g

/**
 * Jordan/Adidas pattern: 9-12 alphanumeric with optional hyphen
 * Examples: 555088-101, GY0095, FZ5000
 */
const JORDAN_ADIDAS_PATTERN = /\b[A-Z]{2,3}[A-Z0-9]{4,9}\b/g

/**
 * Strict SKU patterns by brand
 */
const SKU_PATTERNS = {
  nike: NIKE_PATTERN,
  jordan: NIKE_PATTERN, // Jordan uses Nike's format
  adidas: JORDAN_ADIDAS_PATTERN,
  generic: NIKE_PATTERN, // Default to Nike pattern for safety
}

/**
 * Known false positive patterns to exclude
 */
const FALSE_POSITIVES = [
  /^\d+$/,           // Pure numbers
  /^[A-Z]{1,2}$/,    // Single/double letters
  /^UK\d+$/i,        // UK sizes
  /^US\d+$/i,        // US sizes
  /^EU\d+$/i,        // EU sizes
  /^GB\d+$/i,        // GB codes
  /^[A-Z]{2}\d{1,2}$/, // Short codes like XX12
]

/**
 * Check if a string is a false positive
 */
function isFalsePositive(candidate: string): boolean {
  return FALSE_POSITIVES.some(pattern => pattern.test(candidate))
}

/**
 * Extract SKUs from text using strict patterns
 *
 * @param text - Text to search for SKUs
 * @param brand - Optional brand hint ('nike', 'jordan', 'adidas')
 * @returns Array of validated SKU strings (uppercase, deduplicated)
 */
export function extractSkus(text: string, brand?: string): string[] {
  const pattern = brand && SKU_PATTERNS[brand as keyof typeof SKU_PATTERNS]
    ? SKU_PATTERNS[brand as keyof typeof SKU_PATTERNS]
    : SKU_PATTERNS.generic

  const matches = new Set<string>()

  // Extract using pattern
  const candidates = text.match(pattern)

  if (!candidates) {
    return []
  }

  // Filter and validate
  for (const candidate of candidates) {
    const normalized = candidate.toUpperCase().trim()

    // Skip if too short
    if (normalized.length < 6) continue

    // Skip false positives
    if (isFalsePositive(normalized)) continue

    // Must contain at least one letter
    if (!/[A-Z]/.test(normalized)) continue

    matches.add(normalized)
  }

  return Array.from(matches)
}

/**
 * Validate a single SKU against strict patterns
 *
 * @param sku - SKU to validate
 * @param brand - Optional brand hint
 * @returns true if SKU matches a valid pattern
 */
export function isValidSku(sku: string, brand?: string): boolean {
  const normalized = sku.toUpperCase().trim()

  // Check length
  if (normalized.length < 6) return false

  // Check false positives
  if (isFalsePositive(normalized)) return false

  // Must contain at least one letter
  if (!/[A-Z]/.test(normalized)) return false

  // Test against pattern
  const pattern = brand && SKU_PATTERNS[brand as keyof typeof SKU_PATTERNS]
    ? SKU_PATTERNS[brand as keyof typeof SKU_PATTERNS]
    : SKU_PATTERNS.generic

  const regex = new RegExp(pattern.source) // Create non-global version
  return regex.test(normalized)
}

/**
 * Normalize SKU to uppercase and trim
 *
 * @param sku - SKU to normalize
 * @returns Normalized SKU string
 */
export function normalizeSku(sku: string): string {
  return sku.toUpperCase().trim()
}

/**
 * Extract SKUs from multiple text sources (title, description, etc.)
 *
 * @param sources - Array of text sources to search
 * @param brand - Optional brand hint
 * @returns Deduplicated array of SKUs
 */
export function extractSkusFromSources(sources: string[], brand?: string): string[] {
  const allSkus = new Set<string>()

  for (const source of sources) {
    if (!source) continue
    const skus = extractSkus(source, brand)
    skus.forEach(sku => allSkus.add(sku))
  }

  return Array.from(allSkus)
}
