/**
 * Date range utilities for P&L filtering
 */

export type DateRangePreset = 'this-month' | 'last-30' | 'last-90' | 'ytd' | 'custom'

export interface DateRange {
  from: string // YYYY-MM-DD
  to: string   // YYYY-MM-DD
}

/**
 * Get date range for a preset
 */
export function getPresetRange(preset: DateRangePreset): DateRange | null {
  const today = new Date()

  switch (preset) {
    case 'this-month': {
      const year = today.getFullYear()
      const month = today.getMonth()
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0) // Last day of current month

      return {
        from: formatDate(firstDay),
        to: formatDate(lastDay),
      }
    }

    case 'last-30': {
      const endDate = new Date(today)
      const startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 29) // 30 days including today

      return {
        from: formatDate(startDate),
        to: formatDate(endDate),
      }
    }

    case 'last-90': {
      const endDate = new Date(today)
      const startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 89) // 90 days including today

      return {
        from: formatDate(startDate),
        to: formatDate(endDate),
      }
    }

    case 'ytd': {
      const year = today.getFullYear()
      const startDate = new Date(year, 0, 1) // Jan 1st of current year

      return {
        from: formatDate(startDate),
        to: formatDate(today),
      }
    }

    case 'custom':
      return null // Custom range requires user input

    default:
      return null
  }
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse YYYY-MM-DD string to Date
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}

/**
 * Check if a date string (YYYY-MM-DD) falls within a range (inclusive)
 */
export function isDateInRange(dateStr: string, range: DateRange): boolean {
  const date = parseDate(dateStr)
  const from = parseDate(range.from)
  const to = parseDate(range.to)

  return date >= from && date <= to
}

/**
 * Format date range for display
 */
export function formatRangeDisplay(range: DateRange): string {
  const from = parseDate(range.from)
  const to = parseDate(range.to)

  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return `${formatter.format(from)} - ${formatter.format(to)}`
}

/**
 * Format date range for filename (e.g., "2025-11-01_to_2025-11-21")
 */
export function formatRangeFilename(range: DateRange): string {
  return `${range.from}_to_${range.to}`
}

/**
 * Get preset label
 */
export function getPresetLabel(preset: DateRangePreset): string {
  switch (preset) {
    case 'this-month':
      return 'This Month'
    case 'last-30':
      return 'Last 30 Days'
    case 'last-90':
      return 'Last 90 Days'
    case 'ytd':
      return 'YTD'
    case 'custom':
      return 'Custom'
    default:
      return ''
  }
}
