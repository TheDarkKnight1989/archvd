import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkMasterMarketData() {
  console.log('🔍 Checking master_market_data table status...\n')

  // Check total rows
  const { count: totalCount, error: countError } = await supabase
    .from('master_market_data')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('❌ Error:', countError.message)
    return
  }

  console.log(`📊 Total rows: ${totalCount || 0}`)

  if (totalCount === 0) {
    console.log('\n⚠️  Table is EMPTY!')
    console.log('\n👉 Next steps:')
    console.log('   1. The UI enhancements will show NO DATA')
    console.log('   2. You need to populate the table first')
    console.log('   3. Or rollback to stockx_market_latest for now')
    return
  }

  // Check by provider
  const { data: all } = await supabase
    .from('master_market_data')
    .select('provider, provider_source')

  const byProvider = {}
  const bySource = {}
  all?.forEach(row => {
    byProvider[row.provider] = (byProvider[row.provider] || 0) + 1
    bySource[row.provider_source] = (bySource[row.provider_source] || 0) + 1
  })

  console.log('\n📦 By provider:')
  Object.entries(byProvider).forEach(([p, c]) => console.log(`   ${p}: ${c}`))

  console.log('\n🎯 By source:')
  Object.entries(bySource).forEach(([s, c]) => console.log(`   ${s}: ${c}`))

  // Check latest
  const { data: latest } = await supabase
    .from('master_market_data')
    .select('provider, sku, size_key, lowest_ask, snapshot_at')
    .order('snapshot_at', { ascending: false })
    .limit(3)

  console.log('\n🕐 Latest snapshots:')
  latest?.forEach(r => {
    console.log(`   ${r.provider} | ${r.sku} | £${r.lowest_ask} | ${new Date(r.snapshot_at).toLocaleString()}`)
  })
}

checkMasterMarketData().catch(console.error)
