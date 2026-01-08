import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function test() {
  // Get a sample V4 item ID
  const { data: items, error: itemsError } = await supabase
    .from('inventory_v4_items')
    .select('id, style_id, user_id, status')
    .limit(1)

  if (itemsError) {
    console.log('Error fetching items:', itemsError)
    return
  }

  if (!items || items.length === 0) {
    console.log('No V4 items found')
    return
  }

  const testItem = items[0]
  console.log('Test item:', testItem)

  // Try the same query as mark-sold (with !inner)
  console.log('\nTrying with !inner join...')
  const { data: v4Item, error: v4FetchError } = await supabase
    .from('inventory_v4_items')
    .select(`
      id,
      user_id,
      status,
      style_id,
      size,
      purchase_price,
      purchase_currency,
      purchase_date,
      condition,
      location,
      tags,
      inventory_v4_style_catalog!inner (
        sku,
        brand,
        model,
        colorway,
        image_url,
        category
      )
    `)
    .eq('id', testItem.id)
    .single()

  if (v4FetchError) {
    console.log('V4 query error with !inner:', v4FetchError.message, v4FetchError.code)

    // Try without the !inner join
    console.log('\nTrying without inner join...')
    const { data: v4ItemNoInner, error: noInnerError } = await supabase
      .from('inventory_v4_items')
      .select(`
        id,
        user_id,
        status,
        style_id,
        size,
        purchase_price,
        purchase_currency,
        purchase_date,
        condition,
        location,
        tags,
        inventory_v4_style_catalog (
          sku,
          brand,
          model,
          colorway,
          image_url,
          category
        )
      `)
      .eq('id', testItem.id)
      .single()

    if (noInnerError) {
      console.log('Still error without !inner:', noInnerError.message)
    } else {
      console.log('Works without !inner:', JSON.stringify(v4ItemNoInner, null, 2))
    }
  } else {
    console.log('V4 query success with !inner:', JSON.stringify(v4Item, null, 2))
  }
}

test()
