/**
 * Database Utilities
 * Centralized database helpers and typed clients
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Re-export the database type for convenience
export type { Database }

// Type aliases for common table types
export type Tables = Database['public']['Tables']
export type Enums = Database['public']['Enums']
export type Functions = Database['public']['Functions']

// Row types for common tables
export type InventoryRow = Tables['Inventory']['Row']
export type InventoryInsert = Tables['Inventory']['Insert']
export type InventoryUpdate = Tables['Inventory']['Update']

export type SalesRow = Tables['sales']['Row']
export type SalesInsert = Tables['sales']['Insert']
export type SalesUpdate = Tables['sales']['Update']

export type ProfileRow = Tables['profiles']['Row']
export type ExpenseRow = Tables['expenses']['Row']
export type SubscriptionRow = Tables['subscriptions']['Row']

// Enum types
export type ItemStatus = Enums['item_status']
export type SalePlatform = Enums['sale_platform']
export type IntervalUnit = Enums['interval_unit']

/**
 * Create a Supabase client for server-side use
 * with service role key (bypasses RLS)
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Database helper utilities
 */
export const db = {
  /**
   * Get user's base currency
   */
  async getUserBaseCurrency(userId: string): Promise<'GBP' | 'EUR' | 'USD'> {
    const client = createServiceClient()
    const { data, error } = await client
      .from('profiles')
      .select('base_currency')
      .eq('id', userId)
      .single()

    if (error || !data) {
      return 'GBP' // Default fallback
    }

    return data.base_currency as 'GBP' | 'EUR' | 'USD'
  },

  /**
   * Get FX rate for a specific date and currency pair
   */
  async getFxRate(
    date: string,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    const client = createServiceClient()
    const { data, error } = await client.rpc('fx_rate_for', {
      date_in: date,
      from_ccy: fromCurrency,
      to_ccy: toCurrency
    })

    if (error) {
      console.error('[db.getFxRate] Error:', error)
      return 1.0 // Fallback to 1:1
    }

    return data ?? 1.0
  },

  /**
   * Migrate sold inventory item to sales table
   */
  async migrateSoldToSales(inventoryId: string): Promise<string | null> {
    const client = createServiceClient()
    const { data, error } = await client.rpc('fn_migrate_sold_to_sales', {
      p_inventory_id: inventoryId
    })

    if (error) {
      console.error('[db.migrateSoldToSales] Error:', error)
      return null
    }

    return data
  },

  /**
   * Log application event
   */
  async logApp(
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    module: string,
    message: string,
    meta?: Record<string, any>,
    userId?: string
  ): Promise<void> {
    const client = createServiceClient()
    await client.rpc('fn_log_app', {
      p_level: level,
      p_module: module,
      p_message: message,
      p_meta: meta ?? {},
      p_user_id: userId ?? null
    })
  },

  /**
   * Start a background job
   */
  async jobStart(jobName: string, meta?: Record<string, any>): Promise<string> {
    const client = createServiceClient()
    const { data, error } = await client.rpc('fn_job_start', {
      p_job_name: jobName,
      p_meta: meta ?? {}
    })

    if (error) {
      throw error
    }

    return data
  },

  /**
   * Complete a background job
   */
  async jobComplete(
    runId: string,
    status: 'completed' | 'failed' = 'completed',
    error?: string,
    meta?: Record<string, any>
  ): Promise<void> {
    const client = createServiceClient()
    await client.rpc('fn_job_complete', {
      p_run_id: runId,
      p_status: status,
      p_error: error ?? null,
      p_meta: meta ?? {}
    })
  }
}
