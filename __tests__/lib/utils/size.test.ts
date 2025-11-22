// @ts-nocheck
/**
 * Size Normalization Tests
 * Tests for size conversion and normalization utilities
 */

import { describe, it, expect } from 'vitest'
import { parseSize, convertToUk, normalizeSizeToUk, formatSizeDisplay } from '@/lib/utils/size'

describe('parseSize', () => {
  it('should parse size with UK prefix', () => {
    expect(parseSize('UK9')).toEqual({ system: 'UK', value: '9' })
    expect(parseSize('UK 9.5')).toEqual({ system: 'UK', value: '9.5' })
  })

  it('should parse size with US prefix', () => {
    expect(parseSize('US10')).toEqual({ system: 'US', value: '10' })
    expect(parseSize('US 10.5')).toEqual({ system: 'US', value: '10.5' })
  })

  it('should parse size with EU prefix', () => {
    expect(parseSize('EU44')).toEqual({ system: 'EU', value: '44' })
    expect(parseSize('EU 44.5')).toEqual({ system: 'EU', value: '44.5' })
  })

  it('should parse size with JP prefix', () => {
    expect(parseSize('JP27')).toEqual({ system: 'JP', value: '27' })
  })

  it('should handle size without prefix', () => {
    expect(parseSize('9')).toEqual({ system: null, value: '9' })
    expect(parseSize('10.5')).toEqual({ system: null, value: '10.5' })
  })

  it('should handle null and undefined', () => {
    expect(parseSize(null)).toEqual({ system: null, value: null })
    expect(parseSize(undefined)).toEqual({ system: null, value: null })
  })

  it('should handle case insensitivity', () => {
    expect(parseSize('uk9')).toEqual({ system: 'UK', value: '9' })
    expect(parseSize('us10')).toEqual({ system: 'US', value: '10' })
  })
})

describe('convertToUk', () => {
  it('should keep UK sizes unchanged', () => {
    expect(convertToUk('9', 'UK')).toBe('9')
    expect(convertToUk('9.5', 'UK')).toBe('9.5')
  })

  it('should convert US Men sizes to UK', () => {
    // US Men's = UK + 1
    expect(convertToUk('10', 'US', 'M')).toBe('9')
    expect(convertToUk('10', 'US', null)).toBe('9') // Default to Men's
    expect(convertToUk('11', 'US', 'M')).toBe('10')
  })

  it('should convert US Women sizes to UK', () => {
    // US Women's = UK + 2
    expect(convertToUk('10', 'US', 'W')).toBe('8')
    expect(convertToUk('12', 'US', 'W')).toBe('10')
  })

  it('should convert EU sizes to UK', () => {
    // EU to UK: (EU - 33.5) / 1.5, rounded to nearest 0.5
    expect(convertToUk('44', 'EU')).toBe('9')
    expect(convertToUk('42', 'EU')).toBe('7.5')
  })

  it('should convert JP sizes to UK', () => {
    // JP (cm) to UK: (JP - 22) / 1.5, rounded to nearest 0.5
    expect(convertToUk('27', 'JP')).toBe('5')
    expect(convertToUk('28', 'JP')).toBe('6')
  })

  it('should handle non-numeric sizes', () => {
    expect(convertToUk('OS', 'UK')).toBe('OS')
    expect(convertToUk('XL', 'US')).toBe('XL')
  })
})

describe('normalizeSizeToUk', () => {
  it('should prioritize uk field', () => {
    expect(normalizeSizeToUk({ uk: '9', us: '10', size: '8' })).toBe('9')
  })

  it('should use size_uk as fallback', () => {
    expect(normalizeSizeToUk({ size_uk: '9', us: '10' })).toBe('9')
  })

  it('should parse and convert from size field with UK prefix', () => {
    expect(normalizeSizeToUk({ size: 'UK9' })).toBe('9')
  })

  it('should parse and convert from size field with US prefix', () => {
    expect(normalizeSizeToUk({ size: 'US10' })).toBe('9')
  })

  it('should convert from US field when UK not available', () => {
    expect(normalizeSizeToUk({ us: '10' })).toBe('9')
    expect(normalizeSizeToUk({ us: 'US10' })).toBe('9')
  })

  it('should convert from EU field when UK and US not available', () => {
    expect(normalizeSizeToUk({ eu: '44' })).toBe('9')
  })

  it('should convert from JP field when others not available', () => {
    expect(normalizeSizeToUk({ jp: '27' })).toBe('5')
  })

  it('should use size_alt as last resort', () => {
    expect(normalizeSizeToUk({ size_alt: 'UK9' })).toBe('9')
  })

  it('should return null when no size fields present', () => {
    expect(normalizeSizeToUk({})).toBeNull()
  })

  it('should assume UK when size field is just a number', () => {
    expect(normalizeSizeToUk({ size: '9' })).toBe('9')
    expect(normalizeSizeToUk({ size: '10.5' })).toBe('10.5')
  })

  it('should handle multiple fields and return first valid UK conversion', () => {
    const result = normalizeSizeToUk({
      size: 'US10',
      us: '10',
      eu: '44',
    })
    // Should convert from 'size' field first (US10 → UK9)
    expect(result).toBe('9')
  })
})

describe('formatSizeDisplay', () => {
  it('should format UK size', () => {
    expect(formatSizeDisplay('9', 'UK')).toBe('UK 9')
    expect(formatSizeDisplay('9.5', 'UK')).toBe('UK 9.5')
  })

  it('should format US size', () => {
    expect(formatSizeDisplay('10', 'US')).toBe('US 10')
  })

  it('should format with gender label', () => {
    expect(formatSizeDisplay('10', 'US', 'W')).toBe('US W 10')
    expect(formatSizeDisplay('10', 'US', 'M')).toBe('US 10') // M is default
  })

  it('should return null for null size', () => {
    expect(formatSizeDisplay(null)).toBeNull()
  })
})

describe('size normalization integration tests', () => {
  it('should normalize US 10 to UK 9', () => {
    const sizeData = { size: 'US10' }
    const ukSize = normalizeSizeToUk(sizeData)
    expect(ukSize).toBe('9')
  })

  it('should normalize EU 44 to UK 9', () => {
    const sizeData = { size: 'EU44' }
    const ukSize = normalizeSizeToUk(sizeData)
    expect(ukSize).toBe('9')
  })

  it('should keep UK 9 as UK 9', () => {
    const sizeData = { size: 'UK9' }
    const ukSize = normalizeSizeToUk(sizeData)
    expect(ukSize).toBe('9')
  })

  it('should format all normalized sizes consistently', () => {
    const sizes = [
      { size: 'US10' },
      { size: 'EU44' },
      { size: 'UK9' },
    ]

    const normalized = sizes.map(s => {
      const ukSize = normalizeSizeToUk(s)
      return formatSizeDisplay(ukSize, 'UK')
    })

    // All should normalize to UK 9 (approximately)
    expect(normalized[0]).toBe('UK 9')
    expect(normalized[1]).toBe('UK 9')
    expect(normalized[2]).toBe('UK 9')
  })
})
