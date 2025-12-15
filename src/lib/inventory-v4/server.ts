/**
 * ARCHVD Inventory V4 - Server-Only Exports
 *
 * This module contains all server-only functionality that requires:
 * - SUPABASE_SERVICE_ROLE_KEY
 * - External API clients (StockX, Alias)
 *
 * IMPORTANT: Never import this file from client-side code.
 * Use @/lib/inventory-v4 for types and shared utilities instead.
 */

import 'server-only'

// =============================================================================
// SEARCH - Server-only functions
// =============================================================================

export { unifiedSearchV4 } from './search'
export type { UnifiedSearchOptions } from './search'

// =============================================================================
// RESOLUTION - Server-only functions
// =============================================================================

export {
  resolveStyleIdV4,
  resolveOrCreateStyleV4,
  createStyleAndEnqueueSyncV4,
  updateStyleExternalIdsV4,
  batchResolveStyleIdsV4,
} from './resolve'

export type { ResolveResult, CreateStyleParams, CreateStyleResult } from './resolve'

// =============================================================================
// SYNC QUEUE - Server-only functions
// =============================================================================

export {
  getSyncStatusV4,
  batchGetSyncStatusV4,
  retrySyncV4,
  processSyncBatchV4,
  getQueueStatsV4,
} from './sync-queue'

export type { ProcessBatchResult, RetrySyncResult } from './sync-queue'
