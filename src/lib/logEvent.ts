// Server-side helper for logging audit events
// Uses the log_audit_event database function

import { createClient } from '@/lib/supabase/server'

export interface LogEventParams {
  event_type: string
  entity_type?: string
  entity_id?: string
  title?: string
  description?: string
  metadata?: Record<string, any>
}

/**
 * Log an audit event to the database
 * This function uses the database's log_audit_event function
 * which automatically sets the user_id from auth.uid()
 */
export async function logEvent(params: LogEventParams): Promise<string | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('log_audit_event', {
      p_event_type: params.event_type,
      p_entity_type: params.entity_type || null,
      p_entity_id: params.entity_id || null,
      p_title: params.title || null,
      p_description: params.description || null,
      p_metadata: params.metadata || {},
    })

    if (error) {
      console.error('[logEvent] Error logging audit event:', error)
      return null
    }

    return data as string // Returns the event ID
  } catch (error) {
    console.error('[logEvent] Unexpected error:', error)
    return null
  }
}

/**
 * Common event types for reference
 */
export const EventTypes = {
  // Item events
  ITEM_CREATED: 'item.created',
  ITEM_UPDATED: 'item.updated',
  ITEM_SOLD: 'item.sold',
  ITEM_DELETED: 'item.deleted',

  // Batch events
  ITEMS_IMPORTED: 'items.imported',
  ITEMS_EXPORTED: 'items.exported',

  // Expense events
  EXPENSE_CREATED: 'expense.created',
  EXPENSE_UPDATED: 'expense.updated',
  EXPENSE_DELETED: 'expense.deleted',

  // Subscription events
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_ACTIVATED: 'subscription.activated',
  SUBSCRIPTION_DEACTIVATED: 'subscription.deactivated',
  SUBSCRIPTION_DELETED: 'subscription.deleted',

  // Package events
  PACKAGE_CREATED: 'package.created',
  PACKAGE_UPDATED: 'package.updated',
  PACKAGE_DELETED: 'package.deleted',

  // Integration events
  INTEGRATION_CONNECTED: 'integration.connected',
  INTEGRATION_DISCONNECTED: 'integration.disconnected',

  // Pricing events
  PRICING_REFRESH: 'pricing.refresh',
} as const
