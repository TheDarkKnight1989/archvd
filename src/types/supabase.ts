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
        Row: any
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
