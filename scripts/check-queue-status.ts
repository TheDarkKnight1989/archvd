#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkQueue() {
  console.log('\n📊 SYNC QUEUE STATUS\n')

  // Get counts by status
  const { count: pendingCount } = await supabase
    .from('inventory_v4_sync_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: successCount } = await supabase
    .from('inventory_v4_sync_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'success')

  console.log(`Pending:  ${pendingCount ?? 0}`)
  console.log(`Success:  ${successCount ?? 0}`)

  // Show recent pending jobs
  const { data: pending } = await supabase
    .from('inventory_v4_sync_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10)

  if (pending && pending.length > 0) {
    console.log('\n📋 Recent Pending Jobs:')
    pending.forEach((j: any) => {
      console.log(`  [${j.provider.toUpperCase()}] ${j.style_id}`)
    })
  }

  // Show total styles in catalog
  const { count: totalStyles } = await supabase
    .from('inventory_v4_style_catalog')
    .select('*', { count: 'exact', head: true })

  console.log(`\n📚 Total styles in catalog: ${totalStyles ?? 0}`)

  // Show recent 10 styles
  const { data: recentStyles } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, brand, name, stockx_url_key, alias_catalog_id')
    .order('created_at', { ascending: false })
    .limit(10)

  if (recentStyles && recentStyles.length > 0) {
    console.log('\n📦 Recent 10 Styles:')
    recentStyles.forEach((s: any) => {
      console.log(`  ${s.style_id}: ${s.brand || '—'} ${s.name || '—'}`)
      console.log(`    StockX: ${s.stockx_url_key ? '✅' : '❌'} | Alias: ${s.alias_catalog_id ? '✅' : '❌'}`)
    })
  }

  console.log('\n')
}

checkQueue()
