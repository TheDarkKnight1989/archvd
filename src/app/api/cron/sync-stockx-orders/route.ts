/**
 * StockX Orders Sync Cron
 * GET /api/cron/sync-stockx-orders
 *
 * Automated cron job to sync orders for all connected StockX accounts.
 * Should be triggered every 30 minutes to catch new sales promptly.
 *
 * Vercel Cron Schedule: 0/30 * * * * (every 30 minutes)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOrdersService, type Order, type OrderStatus } from '@/lib/services/stockx/orders'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Allow up to 5 minutes for all accounts

// Use service role for cron jobs
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Verify cron secret
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[Cron Orders] CRON_SECRET not configured')
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Map StockX API order status to database status
 */
function mapStatusToDb(status: OrderStatus): 'ACTIVE' | 'COMPLETED' | 'CANCELLED' {
  switch (status) {
    // Active - still in progress
    case 'CREATED':
    case 'PENDING':
    case 'SHIPPED':
    case 'RECEIVED':
    case 'AUTHENTICATING':
    case 'AUTHENTICATED':
    case 'PAYOUTPENDING':
    case 'CCAUTHORIZATIONFAILED':
      return 'ACTIVE'
    // Completed - successfully done
    case 'PAYOUTCOMPLETED':
    case 'SYSTEMFULFILLED':
    case 'COMPLETED':
    case 'DELIVERED':
      return 'COMPLETED'
    // Cancelled/Failed
    case 'CANCELLED':
    case 'PAYOUTFAILED':
    case 'SUSPENDED':
      return 'CANCELLED'
    default:
      return 'ACTIVE'
  }
}

/**
 * Convert amount to cents
 */
function toCents(amount: string | number): number {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return Math.round(num * 100)
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[Cron Orders] Starting orders sync for all accounts')

    // Get all connected StockX accounts
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('stockx_accounts')
      .select('user_id')
      .gt('expires_at', new Date().toISOString()) // Only accounts with valid tokens

    if (accountsError) {
      console.error('[Cron Orders] Failed to fetch accounts:', accountsError)
      throw new Error('Failed to fetch StockX accounts')
    }

    if (!accounts || accounts.length === 0) {
      console.log('[Cron Orders] No connected accounts found')
      return NextResponse.json({
        success: true,
        message: 'No connected accounts to sync',
        accounts_processed: 0,
      })
    }

    console.log('[Cron Orders] Found accounts to sync:', accounts.length)

    const results = {
      accounts_processed: 0,
      accounts_succeeded: 0,
      accounts_failed: 0,
      total_orders_synced: 0,
      errors: [] as string[],
    }

    // Process each account
    for (const account of accounts) {
      results.accounts_processed++

      try {
        const ordersService = getOrdersService(account.user_id)

        // Fetch orders from StockX
        const [activeOrders, historicalOrders] = await Promise.all([
          ordersService.getOrders('ACTIVE'),
          ordersService.getOrders('HISTORICAL'),
        ])

        const allOrders = [...activeOrders, ...historicalOrders]

        // Upsert orders
        for (const order of allOrders) {
          const record = {
            user_id: account.user_id,
            stockx_order_id: order.orderNumber,
            stockx_listing_id: order.listingId,
            stockx_product_id: order.product.productId,
            stockx_variant_id: order.variant.variantId,
            amount: toCents(order.amount),
            currency_code: order.currencyCode,
            status: mapStatusToDb(order.status),
            sold_at: order.createdAt,
            shipped_at: null, // Not in new API response
            delivered_at: null, // Not in new API response
            payout_amount: order.payout?.totalPayout ? toCents(order.payout.totalPayout) : null,
            tracking_number: order.shipment?.trackingNumber || null,
            carrier: order.shipment?.carrierCode || null,
            last_synced_at: new Date().toISOString(),
          }

          const { error: upsertError } = await supabaseAdmin
            .from('stockx_orders')
            .upsert(record, {
              onConflict: 'stockx_order_id',
              ignoreDuplicates: false,
            })

          if (upsertError) {
            console.error('[Cron Orders] Upsert error:', {
              userId: account.user_id,
              orderNumber: order.orderNumber,
              error: upsertError.message,
            })
          } else {
            results.total_orders_synced++
          }
        }

        results.accounts_succeeded++
      } catch (err: any) {
        console.error('[Cron Orders] Account sync failed:', {
          userId: account.user_id,
          error: err.message,
        })
        results.accounts_failed++
        results.errors.push(`User ${account.user_id}: ${err.message}`)
      }

      // Small delay between accounts to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    const duration = Date.now() - startTime

    console.log('[Cron Orders] Completed:', {
      ...results,
      duration_ms: duration,
    })

    return NextResponse.json({
      success: true,
      ...results,
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Cron Orders] Error:', error)

    return NextResponse.json(
      {
        error: 'Cron job failed',
        details: error.message,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
