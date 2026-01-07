/**
 * StockX Raw Snapshot Logger
 * Logs all StockX API responses to stockx_raw_snapshots table
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type StockXEndpoint =
  | 'catalog_search'
  | 'product'
  | 'variants'
  | 'market_data'
  | 'variant_gtin'

export interface LogStockXSnapshotParams {
  endpoint: StockXEndpoint
  productId?: string | null
  variantId?: string | null
  styleId?: string | null
  gtin?: string | null
  regionCode?: string | null
  currencyCode?: string | null
  queryString?: string | null
  httpStatus: number
  rawPayload: any
  errorMessage?: string | null
  requestDurationMs?: number | null
}

/**
 * Log a StockX API response to the raw snapshots table
 * NOTE: Disabled until raw_snapshots migration is applied
 * To enable: Apply migration supabase/migrations/20251203_create_raw_snapshot_tables.sql
 */
export async function logStockXSnapshot(
  params: LogStockXSnapshotParams
): Promise<void> {
  // Snapshot logging disabled - table not yet created
  return

  /* Disabled code - re-enable after migration is applied:
  try {
    const { error } = await supabase.from('stockx_raw_snapshots').insert({
      provider: 'stockx',
      endpoint: params.endpoint,
      product_id: params.productId || null,
      variant_id: params.variantId || null,
      style_id: params.styleId || null,
      gtin: params.gtin || null,
      region_code: params.regionCode || null,
      currency_code: params.currencyCode || null,
      query_string: params.queryString || null,
      http_status: params.httpStatus,
      raw_payload: params.rawPayload,
      error_message: params.errorMessage || null,
      request_duration_ms: params.requestDurationMs || null,
      requested_at: new Date().toISOString(),
    })

    if (error) {
      // Log error but don't throw - we don't want snapshot logging to break the app
      console.error('[StockX Snapshot Logger] Failed to log snapshot:', error)
    }
  } catch (err) {
    console.error('[StockX Snapshot Logger] Exception logging snapshot:', err)
  }
  */
}

/**
 * Wrapper for StockX API calls that automatically logs responses
 */
export async function withStockXSnapshot<T>(
  endpoint: StockXEndpoint,
  apiCall: () => Promise<T>,
  context: {
    productId?: string
    variantId?: string
    styleId?: string
    gtin?: string
    currencyCode?: string
    queryString?: string
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
    logStockXSnapshot({
      endpoint,
      productId: context.productId,
      variantId: context.variantId,
      styleId: context.styleId,
      gtin: context.gtin,
      currencyCode: context.currencyCode,
      queryString: context.queryString,
      httpStatus,
      rawPayload: error ? { error: error.message } : result,
      errorMessage: error ? error.message : null,
      requestDurationMs: duration,
    }).catch((err) => {
      console.error('[StockX Snapshot Logger] Failed in finally block:', err)
    })
  }
}
