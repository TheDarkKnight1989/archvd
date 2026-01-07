/**
 * GENERIC SKU NORMALIZATION SPECIFICATION
 * ========================================
 *
 * PURPOSE:
 * Create a canonical SKU key for matching products across different platforms
 * (StockX, Alias, etc.) that may use different formatting conventions.
 *
 * CANONICAL FORMAT:
 * The normalized SKU is in uppercase with standardized separators:
 * - Primary pattern: [LETTERS][DIGITS]-[DIGITS] (e.g., "IH0296-400", "DD1391-100")
 * - Alternative: [LETTERS][DIGITS][LETTERS] (e.g., "M990GL6" for New Balance)
 *
 * NORMALIZATION RULES (applied in order):
 *
 * 1. INPUT VALIDATION: Return null for empty/invalid input
 * 2. TRIM: Remove leading/trailing whitespace
 * 3. STRIP DESCRIPTORS: Remove parenthetical content like "(White)", "(GS)", "(TD)"
 * 4. CLEAN: Remove non-alphanumeric chars except dash/space (for now)
 * 5. COLLAPSE SPACES: Multiple spaces → single space
 * 6. UPPERCASE: Convert to uppercase for case-insensitive matching
 * 7. EXTRACT PATTERN: Find the core SKU pattern, stripping product names
 * 8. NORMALIZE SEPARATOR: Standardize space/dash to single dash where applicable
 * 9. VALIDATE: Check minimum requirements (letters, digits, length)
 * 10. RETURN: Canonical SKU or null if invalid
 *
 * VALID SKU REQUIREMENTS:
 * - At least 2 letters
 * - At least 3 digits
 * - Length between 6-15 characters (after extraction)
 * - Must match recognizable sneaker SKU pattern
 *
 * EXAMPLES OF EQUIVALENT INPUTS (all normalize to same key):
 *
 * Input: "IH0296-400"        → Output: "IH0296-400"
 * Input: "IH0296 400"        → Output: "IH0296-400"
 * Input: "ih0296-400"        → Output: "IH0296-400"
 * Input: "IH0296400"         → Output: "IH0296-400" (if pattern detected)
 * Input: "(White) IH0296-400" → Output: "IH0296-400"
 * Input: "Air Jordan 15 IH0296-400" → Output: "IH0296-400"
 * Input: "IH0296-400 (GS)"   → Output: "IH0296-400"
 * Input: "  ih0296 - 400  "  → Output: "IH0296-400"
 * Input: "DD1391 100"        → Output: "DD1391-100"
 * Input: "M990GL6"           → Output: "M990GL6"
 * Input: "FV5029-003"        → Output: "FV5029-003"
 *
 * INVALID INPUTS (return null):
 *
 * Input: "jordan 1"          → Output: null (no digits)
 * Input: "123456"            → Output: null (no letters)
 * Input: "XX1"               → Output: null (too short)
 * Input: "THISISWAYTOOLONGTOBEVALID" → Output: null (too long)
 * Input: ""                  → Output: null (empty)
 * Input: "   "               → Output: null (whitespace only)
 *
 * IMPORTANT — NO SPECIAL CASING:
 * This function is GENERIC. It does NOT contain any special cases for specific SKUs.
 * All normalization is based on pattern matching rules that apply to ALL sneaker SKUs.
 */

/**
 * Normalize a SKU to canonical format for matching across platforms
 *
 * @param input - Raw SKU input from user or API
 * @returns Canonical SKU string, or null if no valid SKU pattern found
 *
 * @example
 * normalizeSkuForMatching("IH0296-400")         // "IH0296-400"
 * normalizeSkuForMatching("IH0296 400")         // "IH0296-400"
 * normalizeSkuForMatching("ih0296-400")         // "IH0296-400"
 * normalizeSkuForMatching("(White) IH0296-400") // "IH0296-400"
 * normalizeSkuForMatching("Air Max IH0296-400") // "IH0296-400"
 * normalizeSkuForMatching("jordan 1")           // null (no digits)
 * normalizeSkuForMatching("123456")             // null (no letters)
 * normalizeSkuForMatching("")                   // null (empty)
 */
export function normalizeSkuForMatching(input: string): string | null {
  // STEP 1: Input validation
  if (!input || typeof input !== 'string') {
    return null
  }

  // STEP 2: Trim whitespace
  let normalized = input.trim()

  if (normalized === '') {
    return null
  }

  // STEP 3: Strip parenthetical descriptors (e.g., "(White)", "(GS)", "(TD)")
  // Pattern: anything in parentheses, anywhere in the string
  normalized = normalized.replace(/\([^)]*\)/g, '')

  // STEP 4: Remove non-alphanumeric characters except dash and space
  // This handles cases like "Air Jordan 1 - DZ5485-410" by removing extra punctuation
  normalized = normalized.replace(/[^A-Za-z0-9\s-]/g, '')

  // STEP 5: Collapse internal whitespace to single spaces
  normalized = normalized.replace(/\s+/g, ' ')

  // STEP 6: Uppercase for case-insensitive matching
  normalized = normalized.toUpperCase()

  // STEP 7: Extract the SKU pattern
  // Try patterns in order of specificity:
  // 1. Numeric SKUs (Crocs, etc.): 4-6 digits, separator, 2-4 alphanumerics
  // 2. Sneaker SKUs: Letters + digits (Nike, Jordan, New Balance, etc.)

  // STEP 7a: Try to match numeric SKUs first (e.g., "205759-610", "207393 2Y2")
  // Pattern: 4-6 digits NOT preceded by letters, then dash or space, then 2-4 alphanumerics
  // Negative lookbehind (?<![A-Z]) ensures no letter before digits (prevents matching "DZ5485-410")
  const numericMatch = normalized.match(/(?<![A-Z])(\d{4,6})[\s-](\w{2,4})/)

  if (numericMatch) {
    const part1 = numericMatch[1]
    const part2 = numericMatch[2]
    const canonical = `${part1}-${part2}`

    // Length check for numeric SKUs (7-12 chars is reasonable)
    if (canonical.length >= 7 && canonical.length <= 12) {
      // Validate minimum digits (at least 6 total)
      const totalDigits = (canonical.match(/\d/g) || []).length
      if (totalDigits >= 6) {
        return canonical
      }
    }
  }

  // STEP 7b: Fall back to sneaker SKU patterns (existing logic)
  // - Pattern A: [LETTERS][DIGITS][-\s][DIGITS] (e.g., "IH0296-400", "DD1391 100")
  // - Pattern B: [LETTERS][DIGITS][LETTERS] (e.g., "M990GL6")
  // - Pattern C: [LETTERS][DIGITS][DIGITS]+ (e.g., "FV5029003" - 6+ digits without separator)

  // Strategy: Find the longest alphanumeric sequence that looks like a SKU
  // This automatically strips product names like "AIR JORDAN 15" before "IH0296-400"

  // Try to match a sequence at the END of the string first (most reliable)
  // Pattern: [LETTERS][DIGITS] optionally followed by [separator][DIGITS or LETTERS]
  // Allow 1+ letters to support New Balance (M990AB6), Nike/Jordan (IH0296-400), etc.
  const skuMatch = normalized.match(/([A-Z]{1,}\d+[A-Z\d]*(?:[-\s]\d+[A-Z]*)?)(?:\s|$)/)

  if (skuMatch) {
    normalized = skuMatch[1].trim()
  } else {
    // Fallback: Try to find ANY sequence of letters+digits that could be a SKU
    const anyMatch = normalized.match(/[A-Z]{1,}\d{3,}[A-Z\d]*/)
    if (anyMatch) {
      normalized = anyMatch[0]
    } else {
      // No valid pattern found
      return null
    }
  }

  // STEP 8: Normalize separator patterns (for sneaker SKUs only)
  // Note: Numeric SKUs were already normalized and returned in STEP 7a
  // Convert space to dash for patterns like "IH0296 400" → "IH0296-400"
  // But preserve single-part SKUs like "M990GL6"

  // Pattern: [LETTERS][DIGITS] [SPACE] [DIGITS]
  // This handles: "HQ8492 400" → "HQ8492-400", "DD1391 100" → "DD1391-100"
  normalized = normalized.replace(/^([A-Z]+\d+)\s+(\d+)$/, '$1-$2')

  // Pattern: [LETTERS][DIGITS] [DASH with optional spaces] [DIGITS]
  // This handles: "HQ8492 - 400" → "HQ8492-400"
  normalized = normalized.replace(/\s*-\s*/g, '-')

  // STEP 9: Final validation

  // Count letters and digits
  const letterCount = (normalized.match(/[A-Z]/g) || []).length
  const digitCount = (normalized.match(/\d/g) || []).length

  // Minimum requirements
  // Allow 1+ letters to support New Balance format (M990AB6), Nike/Jordan (IH0296-400), etc.
  if (letterCount < 1) {
    return null // Too few letters
  }

  if (digitCount < 3) {
    return null // Too few digits
  }

  // Length check (6-15 chars is reasonable for sneaker SKUs)
  if (normalized.length < 6 || normalized.length > 15) {
    return null
  }

  // STEP 10: Return canonical SKU
  return normalized
}

/**
 * Check if a string looks like a SKU (heuristic for search mode detection)
 *
 * Used to determine whether to use SKU search mode or name search mode in the
 * Add Item search endpoint.
 *
 * Criteria:
 * - Must have at least one digit (letters are optional for numeric SKUs)
 * - Length between 6-20 characters (reasonable SKU range, slightly wider than normalization)
 * - Mostly alphanumeric with optional dashes/spaces/parentheses
 * - Must successfully normalize (the best test!)
 *
 * @param query - Search query to check
 * @returns true if query looks like a SKU
 *
 * @example
 * looksLikeSku("IH0296-400")     // true (sneaker SKU)
 * looksLikeSku("205759-610")     // true (numeric SKU)
 * looksLikeSku("jordan 1")       // false (no digits)
 * looksLikeSku("DD1391 100")     // true (sneaker SKU)
 * looksLikeSku("(White) IH0296-400") // true
 */
export function looksLikeSku(query: string): boolean {
  if (!query || typeof query !== 'string') {
    return false
  }

  const trimmed = query.trim()

  // Length check (6-20 is reasonable, slightly wider than normalization)
  if (trimmed.length < 6 || trimmed.length > 20) {
    return false
  }

  // Must have at least one digit (letters are optional for numeric SKUs like Crocs)
  if (!/\d/.test(trimmed)) {
    return false
  }

  // Should be mostly alphanumeric (allow dashes, spaces, parentheses)
  // This prevents queries like "what is the price?" from being treated as SKUs
  const alphanumericCount = (trimmed.match(/[a-zA-Z0-9]/g) || []).length
  const totalLength = trimmed.length

  if (alphanumericCount / totalLength < 0.6) {
    return false // Less than 60% alphanumeric
  }

  // Best test: Can it be normalized?
  // If normalizeSkuForMatching succeeds, it's definitely a SKU
  const normalized = normalizeSkuForMatching(trimmed)
  return normalized !== null
}
