/**
 * Alias (GOAT) Webhooks Endpoint
 * POST /api/alias/webhooks
 * Handles webhook events from Alias with HMAC verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAliasEnabled, getAliasWebhookSecret } from '@/lib/config/alias';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// ============================================================================
// Webhook Event Types
// ============================================================================

type WebhookEventType =
  | 'listing.status.changed'
  | 'listing.price.changed'
  | 'order.created'
  | 'order.updated'
  | 'payout.created';

interface WebhookPayload {
  id: string;
  type: WebhookEventType;
  created_at: string;
  data: any;
}

// ============================================================================
// HMAC Verification
// ============================================================================

/**
 * Verify webhook signature using HMAC-SHA256
 * @param payload Raw request body
 * @param signature Signature from header
 * @param secret Webhook secret
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    // Expected signature format: "sha256=<hex>"
    if (!signature.startsWith('sha256=')) {
      logger.warn('[Webhook] Invalid signature format', { signature: signature.slice(0, 20) });
      return false;
    }

    const receivedSignature = signature.slice(7); // Remove "sha256=" prefix

    // Compute HMAC
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const computedSignature = hmac.digest('hex');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(computedSignature, 'hex')
    );
  } catch (error) {
    logger.error('[Webhook] Signature verification failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return false;
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Check feature flag
    if (!isAliasEnabled()) {
      logger.info('[Webhook] Feature disabled');
      return NextResponse.json(
        {
          error: 'Not Implemented',
          message: 'Alias integration is not enabled',
        },
        { status: 501 }
      );
    }

    // 2. Get raw body for HMAC verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-alias-signature') || request.headers.get('x-webhook-signature') || '';

    if (!signature) {
      logger.warn('[Webhook] Missing signature header');
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Missing webhook signature header',
        },
        { status: 400 }
      );
    }

    // 3. Verify HMAC signature
    let webhookSecret: string;
    try {
      webhookSecret = getAliasWebhookSecret();
    } catch (error) {
      logger.error('[Webhook] Webhook secret not configured');
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Webhook secret not configured',
        },
        { status: 500 }
      );
    }

    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      logger.warn('[Webhook] Invalid signature', {
        signaturePrefix: signature.slice(0, 20),
      });
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Invalid webhook signature',
        },
        { status: 401 }
      );
    }

    // 4. Parse payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      logger.error('[Webhook] Invalid JSON payload');
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid JSON payload',
        },
        { status: 400 }
      );
    }

    // 5. Validate payload structure
    if (!payload.id || !payload.type || !payload.data) {
      logger.warn('[Webhook] Incomplete payload', {
        hasId: !!payload.id,
        hasType: !!payload.type,
        hasData: !!payload.data,
      });
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Incomplete webhook payload',
        },
        { status: 400 }
      );
    }

    // 6. Log event to audit_events (if table exists)
    const supabase = await createClient();
    try {
      await supabase.from('audit_events').insert({
        event_type: 'alias_webhook_received',
        user_id: null, // System event
        metadata: {
          webhook_id: payload.id,
          webhook_type: payload.type,
          timestamp: payload.created_at,
        },
      });
    } catch (error) {
      // Non-critical - continue processing
      logger.warn('[Webhook] Failed to log to audit_events', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    // 7. Handle webhook event
    const result = await handleWebhookEvent(supabase, payload);

    const duration = Date.now() - startTime;

    logger.info('[Webhook] Event processed', {
      event_id: payload.id,
      event_type: payload.type,
      duration,
      result: result.status,
    });

    return NextResponse.json({
      received: true,
      event_id: payload.id,
      event_type: payload.type,
      processed: result.status === 'success',
      message: result.message,
      _meta: {
        duration_ms: duration,
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[Webhook] Error', {
      error: error.message,
      stack: error.stack,
      duration,
    });

    // Return 200 to prevent Alias from retrying (we logged the error)
    return NextResponse.json(
      {
        received: true,
        processed: false,
        error: error.message,
      },
      { status: 200 }
    );
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

async function handleWebhookEvent(
  supabase: any,
  payload: WebhookPayload
): Promise<{ status: 'success' | 'skipped' | 'error'; message: string }> {
  const { type, data } = payload;

  switch (type) {
    case 'listing.status.changed':
      return handleListingStatusChanged(supabase, data);

    case 'listing.price.changed':
      return handleListingPriceChanged(supabase, data);

    case 'order.created':
      return handleOrderCreated(supabase, data);

    case 'order.updated':
      return handleOrderUpdated(supabase, data);

    case 'payout.created':
      return handlePayoutCreated(supabase, data);

    default:
      logger.warn('[Webhook] Unknown event type', { type });
      return {
        status: 'skipped',
        message: `Unknown event type: ${type}`,
      };
  }
}

async function handleListingStatusChanged(supabase: any, data: any): Promise<{ status: 'success' | 'skipped' | 'error'; message: string }> {
  logger.info('[Webhook] Processing listing.status.changed', {
    listing_id: data.listing_id,
    old_status: data.old_status,
    new_status: data.new_status,
  });

  // Update alias_listings
  const { error } = await supabase
    .from('alias_listings')
    .update({
      status: data.new_status,
      sold_at: data.new_status === 'sold' ? new Date().toISOString() : null,
      synced_at: new Date().toISOString(),
    })
    .eq('alias_listing_id', data.listing_id);

  if (error) {
    logger.error('[Webhook] Failed to update listing status', {
      listing_id: data.listing_id,
      error: error.message,
    });
    return { status: 'error', message: error.message };
  }

  return { status: 'success', message: 'Listing status updated' };
}

async function handleListingPriceChanged(supabase: any, data: any): Promise<{ status: 'success' | 'skipped' | 'error'; message: string }> {
  logger.info('[Webhook] Processing listing.price.changed', {
    listing_id: data.listing_id,
    old_price: data.old_price,
    new_price: data.new_price,
  });

  const { error } = await supabase
    .from('alias_listings')
    .update({
      ask_price: data.new_price,
      last_price_update: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    })
    .eq('alias_listing_id', data.listing_id);

  if (error) {
    logger.error('[Webhook] Failed to update listing price', {
      listing_id: data.listing_id,
      error: error.message,
    });
    return { status: 'error', message: error.message };
  }

  // Also update inventory_alias_links.alias_ask_price
  await supabase
    .from('inventory_alias_links')
    .update({
      alias_ask_price: data.new_price,
      last_sync_at: new Date().toISOString(),
    })
    .eq('alias_listing_id', (await getListingUUID(supabase, data.listing_id)));

  return { status: 'success', message: 'Listing price updated' };
}

async function handleOrderCreated(supabase: any, data: any): Promise<{ status: 'success' | 'skipped' | 'error'; message: string }> {
  logger.info('[Webhook] Processing order.created', {
    order_id: data.order_id,
    listing_id: data.listing_id,
  });

  // TODO: Upsert to alias_orders table
  // For now, just log
  return { status: 'success', message: 'Order created event logged' };
}

async function handleOrderUpdated(supabase: any, data: any): Promise<{ status: 'success' | 'skipped' | 'error'; message: string }> {
  logger.info('[Webhook] Processing order.updated', {
    order_id: data.order_id,
    status: data.status,
  });

  // TODO: Update alias_orders table
  return { status: 'success', message: 'Order updated event logged' };
}

async function handlePayoutCreated(supabase: any, data: any): Promise<{ status: 'success' | 'skipped' | 'error'; message: string }> {
  logger.info('[Webhook] Processing payout.created', {
    payout_id: data.payout_id,
    amount: data.amount,
  });

  // TODO: Upsert to alias_payouts table
  return { status: 'success', message: 'Payout created event logged' };
}

// ============================================================================
// Helpers
// ============================================================================

async function getListingUUID(supabase: any, aliasListingId: string): Promise<string | null> {
  const { data } = await supabase
    .from('alias_listings')
    .select('id')
    .eq('alias_listing_id', aliasListingId)
    .single();

  return data?.id || null;
}
