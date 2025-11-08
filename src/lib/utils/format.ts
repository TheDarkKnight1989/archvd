// Number and currency formatting utilities for archvd Matrix UI

export const gbp0 = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

export const gbp2 = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 2,
});

export const pct1 = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const fmt = gbp0; // Alias for backwards compat

// Format percentage (converts 0.15 → "15.0%")
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return pct1.format(value)
}

// Get color class for delta values
export function deltaColor(
  value: number | null | undefined
): 'text-green-400' | 'text-red-400' | 'text-dim' {
  if (value === null || value === undefined || value === 0) return 'text-dim'
  return value > 0 ? 'text-green-400' : 'text-red-400'
}
