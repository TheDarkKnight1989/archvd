/**
 * Time utilities for market queue system
 */

export function nowUtc(): string {
  return new Date().toISOString()
}

export function addMinutes(minutes: number, from?: Date): Date {
  const date = from || new Date()
  return new Date(date.getTime() + minutes * 60 * 1000)
}

export function addHours(hours: number, from?: Date): Date {
  return addMinutes(hours * 60, from)
}

export function startOfHour(date?: Date): Date {
  const d = date || new Date()
  d.setMinutes(0, 0, 0)
  return d
}

export function isStale(timestamp: string | Date, maxAgeMinutes: number): boolean {
  const ts = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  const age = Date.now() - ts.getTime()
  return age > maxAgeMinutes * 60 * 1000
}
