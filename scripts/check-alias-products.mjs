import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n🔍 Checking inventory_v4_alias_products table\n')

// Check total count
const { count: totalCount } = await supabase
  .from('inventory_v4_alias_products')
  .select('*', { count: 'exact', head: true })

console.log(`📊 Total products in table: ${totalCount || 0}`)

// Check recent syncs (last 10 minutes)
const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

const { data: recentData, count: recentCount } = await supabase
  .from('inventory_v4_alias_products')
  .select('alias_catalog_id, updated_at', { count: 'exact' })
  .gte('updated_at', tenMinutesAgo)
  .order('updated_at', { ascending: false })
  .limit(20)

console.log(`\n✨ Products synced in last 10 minutes: ${recentCount || 0}`)

if (recentData && recentData.length > 0) {
  console.log('\n📋 Recently synced products:')
  recentData.forEach((item, i) => {
    const time = new Date(item.updated_at).toLocaleTimeString()
    console.log(`  ${i + 1}. ${item.alias_catalog_id} (${time})`)
  })
} else {
  console.log('\n⚠️  No products synced in the last 10 minutes')
}
