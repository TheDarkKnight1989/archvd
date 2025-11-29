/**
 * Test the repricing API endpoint
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function test() {
  console.log('🧪 Testing Repricing API\n')

  // Get a user and their aged item
  const { data: users } = await supabase.from('Inventory').select('user_id').limit(1)
  const userId = users[0].user_id

  // Get their auth token (for testing we'll use service role key instead)
  const { data: inventory } = await supabase
    .from('Inventory')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'listed', 'worn'])
    .limit(1)

  if (!inventory || inventory.length === 0) {
    console.log('No inventory found')
    return
  }

  const item = inventory[0]
  const cost = item.purchase_price + (item.tax || 0) + (item.shipping || 0)
  const currentPrice = item.custom_market_value || cost * 1.2
  const suggestedPrice = currentPrice * 0.9 // 10% reduction

  console.log(`Testing repricing for item: ${item.sku}`)
  console.log(`Current price: £${currentPrice}`)
  console.log(`Suggested price: £${suggestedPrice}`)
  console.log()

  // Test the API endpoint
  try {
    const response = await fetch(`http://localhost:3000/api/items/${item.id}/reprice`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        new_price: suggestedPrice,
        reason: 'Test repricing'
      })
    })

    const data = await response.json()

    console.log('Response status:', response.status)
    console.log('Response data:', data)

    if (response.ok) {
      console.log('\n✅ API endpoint is working!')
      console.log(`Price updated from £${data.old_price || 'none'} to £${data.new_price}`)
    } else {
      console.log('\n❌ API endpoint returned an error')
    }
  } catch (error) {
    console.log('\n❌ Failed to call API:', error.message)
    console.log('\nNote: Make sure the dev server is running (npm run dev)')
  }
}

test()
