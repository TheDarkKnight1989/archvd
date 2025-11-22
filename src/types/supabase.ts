/**
 * Supabase Database Types
 * TODO: Generate from Supabase CLI with: npx supabase gen types typescript --project-id <project-id>
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      Inventory: {
        Row: any
        Insert: any
        Update: any
      }
      sales: {
        Row: any
        Insert: any
        Update: any
      }
      profiles: {
        Row: {
          id: string
          base_currency: 'GBP' | 'EUR' | 'USD'
          currency_pref?: 'GBP' | 'EUR' | 'USD'
          [key: string]: any
        }
        Insert: any
        Update: any
      }
      expenses: {
        Row: any
        Insert: any
        Update: any
      }
      subscriptions: {
        Row: any
        Insert: any
        Update: any
      }
      [key: string]: {
        Row: any
        Insert: any
        Update: any
      }
    }
    Views: {
      [key: string]: {
        Row: any
      }
    }
    Functions: {
      fx_rate_for: {
        Args: {
          date_in: string
          from_ccy: string
          to_ccy: string
        }
        Returns: number
      }
      fn_migrate_sold_to_sales: {
        Args: {
          p_inventory_id: string
        }
        Returns: string
      }
      fn_log_app: {
        Args: {
          p_level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
          p_module: string
          p_message: string
          p_meta: Record<string, any>
          p_user_id: string | null
        }
        Returns: void
      }
      fn_job_start: {
        Args: {
          p_job_name: string
          p_meta: Record<string, any>
        }
        Returns: string
      }
      fn_job_complete: {
        Args: {
          p_run_id: string
          p_status: 'completed' | 'failed'
          p_error: string | null
          p_meta: Record<string, any>
        }
        Returns: void
      }
      [key: string]: any
    }
    Enums: {
      item_status: 'active' | 'sold' | 'archived'
      sale_platform: 'stockx' | 'goat' | 'ebay' | 'grailed' | 'consignment' | 'private' | 'other'
      interval_unit: 'month' | 'year'
      [key: string]: string
    }
    CompositeTypes: {
      [key: string]: any
    }
  }
}
