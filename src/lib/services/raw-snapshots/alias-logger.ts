/**
 * Alias Raw Snapshot Logger
 * Logs all Alias API responses to alias_raw_snapshots table
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type AliasEndpoint =
  | 'catalog_search'
  | 'catalog_item'
  | 'pricing_availabilities'
  | 'pricing_availability'
  | 'recent_sales'
  | 'offer_histogram'

export interface LogAliasSnapshotParams {
  endpoint: AliasEndpoint
  catalogId?: string | null
  sizeValue?: number | null
  regionId?: string | null
  currencyCode?: string | null
  queryString?: string | null
  productCondition?: string | null
  packagingCondition?: string | null
  consigned?: boolean | null
  httpStatus: number
  rawPayload: any
  errorMessage?: string | null
  requestDurationMs?: number | null
}

/**
 * Log an Alias API response to the raw snapshots table
 * NOTE: Disabled until raw_snapshots migration is applied
 * To enable: Apply migration supabase/migrations/20251203_create_raw_snapshot_tables.sql
 */
export async function logAliasSnapshot(
  params: LogAliasSnapshotParams
): Promise<void> {
  // Snapshot logging disabled - table not yet created
  return

  /* Disabled code - re-enable after migration is applied:
  try {
    const { error } = await supabase.from('alias_raw_snapshots').insert({
      provider: 'alias',
      endpoint: params.endpoint,
      catalog_id: params.catalogId || null,
      size_value: params.sizeValue || null,
      region_id: params.regionId || null,
      currency_code: params.currencyCode || null,
      query_string: params.queryString || null,
      product_condition: params.productCondition || null,
      packaging_condition: params.packagingCondition || null,
      consigned: params.consigned ?? null,
      http_status: params.httpStatus,
      raw_payload: params.rawPayload,
      error_message: params.errorMessage || null,
      request_duration_ms: params.requestDurationMs || null,
      requested_at: new Date().toISOString(),
    })

    if (error) {
      // Log error but don't throw - we don't want snapshot logging to break the app
      console.error('[Alias Snapshot Logger] Failed to log snapshot:', error)
    }
  } catch (err) {
    console.error('[Alias Snapshot Logger] Exception logging snapshot:', err)
  }
  */
}

/**
 * Wrapper for Alias API calls that automatically logs responses
 */
export async function withAliasSnapshot<T>(
  endpoint: AliasEndpoint,
  apiCall: () => Promise<T>,
  context: {
    catalogId?: string
    sizeValue?: number
    regionId?: string
    currencyCode?: string
    queryString?: string
    productCondition?: string
    packagingCondition?: string
    consigned?: boolean
  }
): Promise<T> {
  const startTime = Date.now()
  let httpStatus = 200
  let result: T | undefined = undefined
  let error: Error | null = null

  try {
    result = await apiCall()
    return result
  } catch (err) {
    error = err as Error
    httpStatus = (err as any).status || (err as any).statusCode || 500
    throw err // Re-throw after logging
  } finally {
    const duration = Date.now() - startTime

    // Log the snapshot (async, don't await)
    logAliasSnapshot({
      endpoint,
      catalogId: context.catalogId,
      sizeValue: context.sizeValue,
      regionId: context.regionId,
      currencyCode: context.currencyCode,
      queryString: context.queryString,
      productCondition: context.productCondition,
      packagingCondition: context.packagingCondition,
      consigned: context.consigned,
      httpStatus,
      rawPayload: error ? { error: error.message } : result,
      errorMessage: error ? error.message : null,
      requestDurationMs: duration,
    }).catch((err) => {
      console.error('[Alias Snapshot Logger] Failed in finally block:', err)
    })
  }
}
