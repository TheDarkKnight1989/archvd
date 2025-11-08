/**
 * Release source adapters
 *
 * Export all adapters and utilities
 */

export { NikeAdapter } from './nike'
export { SizeAdapter } from './size'
export { FootpatrolAdapter } from './footpatrol'

export type {
  ReleaseAdapter,
  AdapterResult,
  NormalizedRelease,
  FetchOptions,
  ExtractionStrategy,
} from './types'

import { NikeAdapter } from './nike'
import { SizeAdapter } from './size'
import { FootpatrolAdapter } from './footpatrol'
import { ReleaseAdapter } from './types'

/**
 * Get adapter by source name
 */
export function getAdapter(sourceName: string): ReleaseAdapter | null {
  switch (sourceName.toLowerCase()) {
    case 'nike':
      return new NikeAdapter()
    case 'size':
      return new SizeAdapter()
    case 'footpatrol':
      return new FootpatrolAdapter()
    default:
      return null
  }
}

/**
 * Get all available adapters
 */
export function getAllAdapters(): ReleaseAdapter[] {
  return [
    new NikeAdapter(),
    new SizeAdapter(),
    new FootpatrolAdapter(),
  ]
}
