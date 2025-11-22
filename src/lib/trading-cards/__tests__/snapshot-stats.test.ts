// @ts-nocheck
/**
 * Unit tests for trading card snapshot statistics
 * Tests IQR outlier removal, median, and percentile calculations
 */

import { describe, it, expect } from '@jest/globals'

// Statistical functions (extracted from seed script for testing)
function calculateQuartiles(values: number[]): { q1: number; q3: number; iqr: number } {
  const sorted = [...values].sort((a, b) => a - b)
  const q1Index = Math.floor(sorted.length * 0.25)
  const q3Index = Math.floor(sorted.length * 0.75)
  const q1 = sorted[q1Index]
  const q3 = sorted[q3Index]
  const iqr = q3 - q1
  return { q1, q3, iqr }
}

function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values
  const { q1, q3, iqr } = calculateQuartiles(values)
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr
  return values.filter(v => v >= lowerBound && v <= upperBound)
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

function calculateP75(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil(sorted.length * 0.75) - 1
  return sorted[index]
}

describe('Snapshot Statistics', () => {
  describe('calculateQuartiles', () => {
    it('should calculate Q1, Q3, and IQR correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const result = calculateQuartiles(values)

      expect(result.q1).toBe(3) // 25th percentile
      expect(result.q3).toBe(8) // 75th percentile
      expect(result.iqr).toBe(5) // Q3 - Q1
    })

    it('should handle smaller datasets', () => {
      const values = [10, 20, 30, 40]
      const result = calculateQuartiles(values)

      expect(result.q1).toBe(10)
      expect(result.q3).toBe(30)
      expect(result.iqr).toBe(20)
    })
  })

  describe('removeOutliers (IQR method)', () => {
    it('should remove extreme outliers using 1.5*IQR rule', () => {
      // Dataset with outliers
      const values = [10, 12, 13, 14, 15, 16, 17, 18, 100] // 100 is outlier

      const cleaned = removeOutliers(values)

      // Should remove 100 (outlier)
      expect(cleaned).not.toContain(100)
      expect(cleaned.length).toBe(8)
    })

    it('should keep all values when no outliers present', () => {
      const values = [10, 11, 12, 13, 14, 15]

      const cleaned = removeOutliers(values)

      expect(cleaned).toHaveLength(6)
      expect(cleaned).toEqual(values)
    })

    it('should handle datasets with fewer than 4 values', () => {
      const values = [10, 20, 30]

      const cleaned = removeOutliers(values)

      // Should return all values when < 4 elements
      expect(cleaned).toEqual(values)
    })

    it('should remove both high and low outliers', () => {
      const values = [1, 50, 52, 54, 56, 58, 60, 62, 64, 150]

      const cleaned = removeOutliers(values)

      // Should remove both 1 and 150
      expect(cleaned).not.toContain(1)
      expect(cleaned).not.toContain(150)
    })
  })

  describe('calculateMedian', () => {
    it('should calculate median for odd-length arrays', () => {
      const values = [1, 2, 3, 4, 5]

      const median = calculateMedian(values)

      expect(median).toBe(3)
    })

    it('should calculate median for even-length arrays', () => {
      const values = [1, 2, 3, 4]

      const median = calculateMedian(values)

      expect(median).toBe(2.5) // (2 + 3) / 2
    })

    it('should handle unsorted arrays', () => {
      const values = [5, 1, 4, 2, 3]

      const median = calculateMedian(values)

      expect(median).toBe(3)
    })

    it('should return 0 for empty arrays', () => {
      const values: number[] = []

      const median = calculateMedian(values)

      expect(median).toBe(0)
    })

    it('should handle single-element arrays', () => {
      const values = [42]

      const median = calculateMedian(values)

      expect(median).toBe(42)
    })
  })

  describe('calculateP75', () => {
    it('should calculate 75th percentile correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

      const p75 = calculateP75(values)

      expect(p75).toBe(8) // 75% of 10 items = index 7 (8th item)
    })

    it('should handle smaller datasets', () => {
      const values = [10, 20, 30, 40]

      const p75 = calculateP75(values)

      expect(p75).toBe(30)
    })

    it('should return 0 for empty arrays', () => {
      const values: number[] = []

      const p75 = calculateP75(values)

      expect(p75).toBe(0)
    })
  })

  describe('Integration: Snapshot generation workflow', () => {
    it('should correctly process prices through full pipeline', () => {
      // Realistic price data with outliers
      const rawPrices = [
        50, 52, 51, 53, 54, 55, 52, 51, 53, 54,
        5,  // Low outlier (listing error)
        150, // High outlier (scalper)
      ]

      // Step 1: Remove outliers
      const cleanedPrices = removeOutliers(rawPrices)

      // Step 2: Calculate stats
      const median = calculateMedian(cleanedPrices)
      const p75 = calculateP75(cleanedPrices)
      const min = Math.min(...cleanedPrices)
      const max = Math.max(...cleanedPrices)

      // Assertions
      expect(cleanedPrices.length).toBe(10) // Removed 2 outliers
      expect(median).toBeGreaterThanOrEqual(51)
      expect(median).toBeLessThanOrEqual(54)
      expect(p75).toBeGreaterThan(median)
      expect(min).toBe(50)
      expect(max).toBe(55)
    })

    it('should handle real-world price variance', () => {
      // Simulating TCGPlayer prices with realistic distribution
      const tcgplayerPrices = [
        89.99, 92.50, 91.00, 90.00, 93.00,
        88.00, 94.00, 91.50, 92.00, 90.50,
        200.00, // Extreme outlier (graded/sealed special)
      ]

      const cleaned = removeOutliers(tcgplayerPrices)
      const median = calculateMedian(cleaned)

      expect(cleaned).not.toContain(200.00)
      expect(median).toBeCloseTo(91, 1) // ~91
    })
  })
})
