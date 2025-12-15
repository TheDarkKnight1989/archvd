/**
 * ARCHVD Inventory V4 Module - Client-Safe Entry Point
 *
 * This barrel exports ONLY:
 * - Types (erased at compile time, always safe)
 * - Pure utility functions from shared.ts (no server deps)
 *
 * For server-only functions (unifiedSearchV4, resolveStyleIdV4, etc.),
 * import from '@/lib/inventory-v4/server' instead.
 */

// =============================================================================
// TYPES - Safe to import anywhere
// =============================================================================

export type {
  StyleCatalogV4,
  ItemCondition,
  ItemStatus,
  InventoryV4Item,
  InventoryV4ItemWithStyle,
  InventoryV4ItemFull,
  SyncProvider,
  SyncJobStatus,
  ProviderSyncStatus,
  SyncJobV4,
  SyncStatusV4,
  MarketDataState,
  InputType,
  SearchResultV4,
  SearchResponseV4,
  AddItemModalStep,
  AddItemModalStateV4,
  AddItemRequestV4,
  CreateStyleAndAddRequestV4,
  RetrySyncRequestV4,
  UseInventoryV4Return,
  UseUnifiedSearchV4Return,
  InventoryV4ItemRow,
  StyleCatalogV4Row,
  SyncQueueV4Row,
} from './types'

// =============================================================================
// SHARED UTILITIES - Pure functions, safe to import anywhere
// =============================================================================

export {
  detectInputType,
  detectInputTypeV4,
  extractStockXSlug,
  extractAliasCatalogId,
} from './shared'
