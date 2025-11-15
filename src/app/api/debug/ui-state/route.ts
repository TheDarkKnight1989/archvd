/**
 * Debug UI State API
 * WHY: Debug endpoint to verify dashboard numbers and queue state
 * Access: No auth in dev, auth required in prod
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  // In production, require authentication
  if (process.env.NODE_ENV === 'production') {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createServiceClient()

  // Get dashboard overview (use first user as example, or aggregate)
  const { data: overview } = await supabase
    .rpc('get_dashboard_overview')
    .single()
    .then(res => ({ data: res.data }))
    .catch(() => ({ data: null }))

  // Fallback if no RPC: aggregate manually
  const { data: inventory } = await supabase
    .from('Inventory')
    .select('purchase_price, market_value, market_price_updated_at')
    .in('status', ['active', 'listed', 'worn'])

  const estimatedValue = (inventory || []).reduce((sum, item) => sum + (item.market_value || 0), 0)
  const invested = (inventory || []).reduce((sum, item) => sum + (item.purchase_price || 0), 0)
  const roi = invested > 0 ? ((estimatedValue - invested) / invested) * 100 : 0
  const missingPrices = (inventory || []).filter(item => !item.market_value).length

  // Determine provider
  const providers = new Set((inventory || [])
    .filter(item => item.market_value)
    .map(() => 'stockx')) // TODO: track provider in inventory or join with market_prices
  const provider = providers.size === 0 ? 'none' : providers.size > 1 ? 'mixed' : Array.from(providers)[0]

  // Get most recent price update
  const mostRecentPrice = (inventory || [])
    .filter(item => item.market_price_updated_at)
    .sort((a, b) => new Date(b.market_price_updated_at!).getTime() - new Date(a.market_price_updated_at!).getTime())[0]

  const pricesAsOf = mostRecentPrice?.market_price_updated_at || new Date().toISOString()

  // Get counts
  const { count: productsCount } = await supabase
    .from('product_catalog')
    .select('*', { count: 'exact', head: true })

  const { count: pricesCount } = await supabase
    .from('stockx_market_prices')
    .select('*', { count: 'exact', head: true })

  const { count: activeInventoryCount } = await supabase
    .from('Inventory')
    .select('*', { count: 'exact', head: true })
    .in('status', ['active', 'listed', 'worn'])

  // Get queue state
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const { data: queueJobs } = await supabase
    .from('market_jobs')
    .select('status, completed_at')
    .gte('created_at', twentyFourHoursAgo.toISOString())

  const queue = {
    pending: (queueJobs || []).filter(j => j.status === 'pending').length,
    running: (queueJobs || []).filter(j => j.status === 'running').length,
    failed24h: (queueJobs || []).filter(j => j.status === 'failed' && j.completed_at).length,
    done24h: (queueJobs || []).filter(j => j.status === 'done' && j.completed_at).length,
    budgets: [] as any[], // Will populate below
  }

  // Get budgets
  const hourKey = new Date()
  hourKey.setMinutes(0, 0, 0)

  const { data: budgets } = await supabase
    .from('market_budgets')
    .select('provider, rate_limit, used, hour_window')
    .eq('hour_window', hourKey.toISOString())

  queue.budgets = (budgets || []).map(b => ({
    provider: b.provider,
    tokens_left: b.rate_limit - b.used,
    next_refill_at: new Date(new Date(b.hour_window).getTime() + 60 * 60 * 1000).toISOString(),
  }))

  return NextResponse.json({
    dashboard: {
      estimatedValue,
      invested,
      roi,
      provider,
      pricesAsOf,
      missingPrices,
    },
    counts: {
      products: productsCount || 0,
      prices: pricesCount || 0,
      links: 0, // TODO: if you have a links/mappings table
      activeInventory: activeInventoryCount || 0,
    },
    queue,
  })
}
