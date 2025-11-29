import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { data: users } = await supabase.from('Inventory').select('user_id').limit(1)
const userId = users[0].user_id

const { data: inventory } = await supabase
  .from('Inventory')
  .select('*')
  .eq('user_id', userId)
  .in('status', ['active', 'listed', 'worn'])

const now = new Date()
const aged = inventory.filter(item => {
  const purchaseDate = item.purchase_date ? new Date(item.purchase_date) : new Date(item.created_at)
  const days = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
  return days >= 30
}).map(item => {
  const purchaseDate = item.purchase_date ? new Date(item.purchase_date) : new Date(item.created_at)
  const days = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
  return { sku: item.sku, days, price: item.custom_market_value || item.purchase_price }
})

console.log('Items > 30 days old:')
aged.forEach(i => {
  const tier = i.days >= 180 ? 'DEAD STOCK 🔴' : i.days >= 90 ? 'STALE 🟡' : 'AGING 🟢'
  console.log(`  ${i.sku}: ${i.days} days (${tier}) - Price: £${i.price}`)
})

if (aged.filter(i => i.days >= 90).length > 0) {
  console.log('\n✅ You SHOULD see repricing suggestions for items 90+ days old!')
} else {
  console.log('\n❌ No items 90+ days old - suggestions only show for very aged inventory or items priced above market')
}
