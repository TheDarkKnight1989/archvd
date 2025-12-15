/**
 * ARCHVD Inventory V4 - Style Resolution
 *
 * Fresh V4 implementation for resolving SKUs to style_catalog entries.
 *
 * Use cases:
 * - Check if a SKU exists in our database
 * - Create new style_catalog entry with external IDs
 * - Enqueue sync jobs for new SKUs
 *
 * IMPORTANT: This file is SERVER-ONLY. It uses SUPABASE_SERVICE_ROLE_KEY.
 * Never import this into client-side code.
 *
 * NOTE: Create + enqueue is NOT atomic. If style insert succeeds but enqueue
 * fails, the style will exist without sync jobs. The sync worker should have
 * a "re-enqueue orphaned styles" safety net, or UI should offer manual retry.
 */

import 'server-only'

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { StyleCatalogV4, StyleCatalogV4Row, SyncProvider } from './types'

// =============================================================================
// TYPES
// =============================================================================

export interface ResolveResult {
  found: boolean
  style: StyleCatalogV4 | null
  wasCreated: boolean
}

export interface CreateStyleParams {
  styleId: string
  stockxProductId?: string | null
  stockxUrlKey?: string | null
  aliasCatalogId?: string | null
  brand?: string | null
  name?: string | null
  nickname?: string | null
  colorway?: string | null
  gender?: string | null
  productCategory?: string | null
  releaseDate?: string | null
  retailPriceCents?: number | null
  imageUrl?: string | null
}

export interface CreateStyleResult {
  style: StyleCatalogV4
  syncJobs: Array<{ id: string; provider: SyncProvider }>
}

// =============================================================================
// SUPABASE SINGLETON
// =============================================================================

let supabaseServiceClient: SupabaseClient | null = null

/**
 * Get or create singleton Supabase service client
 * Reuses connection for performance
 */
function getServiceClient(): SupabaseClient {
  if (supabaseServiceClient) return supabaseServiceClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('[Resolve V4] Missing Supabase credentials')
  }

  supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }, // Server context - no session persistence needed
  })
  return supabaseServiceClient
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * PostgREST error code for "no rows returned" from .single()
 * NOTE: This is a PostgREST-specific code. If Supabase/PostgREST changes,
 * this may need updating. We treat this as "not found" rather than an error.
 */
const POSTGREST_NO_ROWS_CODE = 'PGRST116'

/** Explicit fields to select - avoids SELECT * schema creep and reduces payload */
const STYLE_CATALOG_FIELDS = [
  'style_id',
  'brand',
  'name',
  'nickname',
  'colorway',
  'gender',
  'product_category',
  'release_date',
  'retail_price_cents',
  'primary_image_url',
  'stockx_product_id',
  'stockx_url_key',
  'alias_catalog_id',
  'created_at',
  'updated_at',
] as const

/** SKU validation: minimum length (e.g., "M990" = 4 chars) */
const MIN_SKU_LENGTH = 3

/** SKU validation: maximum length (reasonable upper bound) */
const MAX_SKU_LENGTH = 50

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Normalize and validate a SKU
 * @throws Error if SKU is empty or too long
 */
function normalizeAndValidateSku(styleId: string): string {
  const normalized = styleId.toUpperCase().trim()

  if (normalized.length < MIN_SKU_LENGTH) {
    throw new Error(
      `[Resolve V4] Invalid SKU: must be at least ${MIN_SKU_LENGTH} characters (got "${normalized}")`
    )
  }

  if (normalized.length > MAX_SKU_LENGTH) {
    throw new Error(
      `[Resolve V4] Invalid SKU: must be at most ${MAX_SKU_LENGTH} characters (got ${normalized.length})`
    )
  }

  return normalized
}

// =============================================================================
// HELPERS
// =============================================================================

function rowToStyleCatalog(row: StyleCatalogV4Row): StyleCatalogV4 {
  return {
    style_id: row.style_id,
    brand: row.brand,
    name: row.name,
    nickname: row.nickname,
    colorway: row.colorway,
    gender: row.gender,
    product_category: row.product_category,
    release_date: row.release_date,
    retail_price_cents: row.retail_price_cents,
    primary_image_url: row.primary_image_url,
    stockx_product_id: row.stockx_product_id,
    stockx_url_key: row.stockx_url_key,
    alias_catalog_id: row.alias_catalog_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// =============================================================================
// RESOLUTION FUNCTIONS
// =============================================================================

/**
 * Resolve a style_id to check if it exists in the database
 *
 * @param styleId - The SKU to resolve (e.g., "DD1391-100")
 * @returns ResolveResult with found status and style data
 * @throws Error if styleId is invalid (empty, too short, too long)
 */
export async function resolveStyleIdV4(styleId: string): Promise<ResolveResult> {
  const supabase = getServiceClient()
  const normalizedSku = normalizeAndValidateSku(styleId)

  const { data, error } = await supabase
    .from('inventory_v4_style_catalog')
    .select(STYLE_CATALOG_FIELDS.join(','))
    .eq('style_id', normalizedSku)
    .single()

  if (error && error.code !== POSTGREST_NO_ROWS_CODE) {
    // No rows returned is not an error for us (style just doesn't exist yet)
    console.error('[Resolve V4] Error resolving style:', error)
    throw error
  }

  if (!data) {
    return { found: false, style: null, wasCreated: false }
  }

  return {
    found: true,
    style: rowToStyleCatalog(data as unknown as StyleCatalogV4Row),
    wasCreated: false,
  }
}

/**
 * Create a new style_catalog entry and enqueue sync jobs
 *
 * Uses upsert to avoid race conditions when multiple requests try to create
 * the same style simultaneously. If style already exists, returns it without
 * enqueueing new sync jobs (assumes existing jobs are already queued).
 *
 * BEHAVIOR: "First write wins" - if a style already exists, new data is NOT
 * merged in. This is intentional: most creations come from search results with
 * full metadata, and we don't want later minimal requests to overwrite good data.
 * Use updateStyleExternalIdsV4() to enrich external IDs after creation.
 *
 * TODO: If we need "fill missing fields" behavior, implement an RPC with:
 *   ON CONFLICT (style_id) DO UPDATE SET
 *     name = COALESCE(EXCLUDED.name, inventory_v4_style_catalog.name), ...
 *
 * @param params - Style creation parameters
 * @returns Created style and sync job IDs
 * @throws Error if styleId is invalid
 */
export async function createStyleAndEnqueueSyncV4(
  params: CreateStyleParams
): Promise<CreateStyleResult> {
  const supabase = getServiceClient()
  const normalizedSku = normalizeAndValidateSku(params.styleId)

  // 1. Upsert style_catalog entry (avoids unique constraint race condition)
  // onConflict: if style_id exists, do nothing (don't update existing data)
  const { data: style, error: styleError } = await supabase
    .from('inventory_v4_style_catalog')
    .upsert(
      {
        style_id: normalizedSku,
        stockx_product_id: params.stockxProductId ?? null,
        stockx_url_key: params.stockxUrlKey ?? null,
        alias_catalog_id: params.aliasCatalogId ?? null,
        brand: params.brand ?? null,
        name: params.name ?? null,
        nickname: params.nickname ?? null,
        colorway: params.colorway ?? null,
        gender: params.gender ?? null,
        product_category: params.productCategory ?? null,
        release_date: params.releaseDate ?? null,
        retail_price_cents: params.retailPriceCents ?? null,
        primary_image_url: params.imageUrl ?? null,
      },
      { onConflict: 'style_id', ignoreDuplicates: true }
    )
    .select(STYLE_CATALOG_FIELDS.join(','))
    .single()

  if (styleError) {
    // If upsert with ignoreDuplicates returns no row, fetch existing
    if (styleError.code === POSTGREST_NO_ROWS_CODE) {
      const existing = await resolveStyleIdV4(normalizedSku)
      if (existing.found && existing.style) {
        // Style already existed - don't enqueue new sync jobs
        return { style: existing.style, syncJobs: [] }
      }
    }
    console.error('[Resolve V4] Error creating style:', styleError)
    throw styleError
  }

  // 2. Enqueue sync jobs for both providers
  const syncJobs: Array<{ id: string; provider: SyncProvider }> = []

  // Enqueue StockX sync
  const { data: stockxJob, error: stockxError } = await supabase.rpc(
    'enqueue_sync_job_v4',
    {
      p_style_id: normalizedSku,
      p_provider: 'stockx',
    }
  )

  if (stockxError) {
    console.error('[Resolve V4] Error enqueuing StockX sync:', stockxError)
    // Don't throw - style was created, sync can be retried
  } else if (stockxJob) {
    syncJobs.push({ id: stockxJob, provider: 'stockx' })
  }

  // Enqueue Alias sync
  const { data: aliasJob, error: aliasError } = await supabase.rpc(
    'enqueue_sync_job_v4',
    {
      p_style_id: normalizedSku,
      p_provider: 'alias',
    }
  )

  if (aliasError) {
    console.error('[Resolve V4] Error enqueuing Alias sync:', aliasError)
    // Don't throw - style was created, sync can be retried
  } else if (aliasJob) {
    syncJobs.push({ id: aliasJob, provider: 'alias' })
  }

  return {
    style: rowToStyleCatalog(style as unknown as StyleCatalogV4Row),
    syncJobs,
  }
}

/**
 * Resolve or create a style_catalog entry
 *
 * This is the main entry point for the add-item flow:
 * - If SKU exists, return it (syncJobs will be undefined)
 * - If SKU doesn't exist, create it and enqueue syncs
 *
 * @param params - Style parameters (styleId required, others optional)
 * @returns Style data and whether it was newly created
 *
 * NOTE on wasCreated:
 * - true: We actually inserted the row AND enqueued sync jobs
 * - false: Style already existed (either found initially or race condition)
 * Under race conditions, another request may have created the row between our
 * resolve check and upsert. In that case wasCreated=false and syncJobs=[].
 *
 * NOTE on syncJobs return value:
 * - undefined: Style already existed on initial resolve (no create attempted)
 * - []: Style already existed (race loser) OR enqueue failed after create
 * - [{...}, {...}]: Style was created and jobs enqueued successfully
 *
 * UI guidance: Key off `syncJobs.length > 0` to know if sync is in flight,
 * not `wasCreated`. Callers should treat syncJobs as best-effort metadata.
 */
export async function resolveOrCreateStyleV4(
  params: CreateStyleParams
): Promise<ResolveResult & { syncJobs?: Array<{ id: string; provider: SyncProvider }> }> {
  // First try to resolve
  const existing = await resolveStyleIdV4(params.styleId)

  if (existing.found) {
    return existing
  }

  // Not found - create it
  const created = await createStyleAndEnqueueSyncV4(params)

  // wasCreated is true only if we actually inserted and enqueued jobs
  // If syncJobs is empty, we either lost a race or enqueue failed
  const wasCreated = created.syncJobs.length > 0

  return {
    found: true,
    style: created.style,
    wasCreated,
    syncJobs: created.syncJobs,
  }
}

/**
 * Update style_catalog with external IDs
 *
 * Use when we discover external IDs after initial creation
 *
 * @throws Error if styleId is invalid
 */
export async function updateStyleExternalIdsV4(
  styleId: string,
  externalIds: {
    stockxProductId?: string | null
    stockxUrlKey?: string | null
    aliasCatalogId?: string | null
  }
): Promise<StyleCatalogV4 | null> {
  const supabase = getServiceClient()
  const normalizedSku = normalizeAndValidateSku(styleId)

  // Only update fields that are provided
  const updates: Record<string, string | null> = {}
  if (externalIds.stockxProductId !== undefined) {
    updates.stockx_product_id = externalIds.stockxProductId
  }
  if (externalIds.stockxUrlKey !== undefined) {
    updates.stockx_url_key = externalIds.stockxUrlKey
  }
  if (externalIds.aliasCatalogId !== undefined) {
    updates.alias_catalog_id = externalIds.aliasCatalogId
  }

  if (Object.keys(updates).length === 0) {
    // Nothing to update
    const existing = await resolveStyleIdV4(normalizedSku)
    return existing.style
  }

  const { data, error } = await supabase
    .from('inventory_v4_style_catalog')
    .update(updates)
    .eq('style_id', normalizedSku)
    .select(STYLE_CATALOG_FIELDS.join(','))
    .single()

  if (error) {
    console.error('[Resolve V4] Error updating external IDs:', error)
    throw error
  }

  return rowToStyleCatalog(data as unknown as StyleCatalogV4Row)
}

/**
 * Batch resolve multiple style_ids
 *
 * @param styleIds - Array of SKUs to resolve (duplicates are deduped, invalid SKUs filtered)
 * @returns Map of styleId -> StyleCatalogV4 (only includes found styles)
 */
export async function batchResolveStyleIdsV4(
  styleIds: string[]
): Promise<Map<string, StyleCatalogV4>> {
  const supabase = getServiceClient()

  // Normalize, dedupe, and filter invalid SKUs
  const normalizedSkus = [
    ...new Set(
      styleIds
        .map((s) => s.toUpperCase().trim())
        .filter((s) => s.length >= MIN_SKU_LENGTH && s.length <= MAX_SKU_LENGTH)
    ),
  ]

  if (normalizedSkus.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('inventory_v4_style_catalog')
    .select(STYLE_CATALOG_FIELDS.join(','))
    .in('style_id', normalizedSkus)

  if (error) {
    console.error('[Resolve V4] Error batch resolving styles:', error)
    throw error
  }

  const result = new Map<string, StyleCatalogV4>()

  for (const row of data || []) {
    result.set(
      (row as unknown as StyleCatalogV4Row).style_id,
      rowToStyleCatalog(row as unknown as StyleCatalogV4Row)
    )
  }

  return result
}
