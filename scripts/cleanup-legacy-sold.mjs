#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function cleanup() {
  console.log('=== CLEANUP: Removing legacy sold items from inventory ===\n')

  const { data: soldItems, error: e1 } = await supabase
    .from('inventory_v4_items')
    .select('id, style_id, status')
    .eq('status', 'sold')

  if (e1) {
    console.log('ERROR:', e1.message)
    return
  }

  if (!soldItems || soldItems.length === 0) {
    console.log('No sold items to clean up')
    return
  }

  console.log('Found', soldItems.length, 'items with status=sold:')
  for (const item of soldItems) {
    console.log('  -', item.id, '(', item.style_id, ')')
  }

  for (const item of soldItems) {
    const { data: sale } = await supabase
      .from('inventory_v4_sales')
      .select('id')
      .eq('original_item_id', item.id)
      .single()

    if (sale) {
      console.log('\n  Item', item.id, 'has sale record', sale.id)
      console.log('  → Deleting from inventory (already in sales)')

      const { error: delErr } = await supabase
        .from('inventory_v4_items')
        .delete()
        .eq('id', item.id)

      if (delErr) {
        console.log('    ERROR:', delErr.message)
      } else {
        console.log('    DELETED')
      }
    } else {
      console.log('\n  Item', item.id, 'has NO sale record')
      console.log('  → Keeping in inventory, resetting status to in_stock')

      const { error: updErr } = await supabase
        .from('inventory_v4_items')
        .update({ status: 'in_stock' })
        .eq('id', item.id)

      if (updErr) {
        console.log('    ERROR:', updErr.message)
      } else {
        console.log('    UPDATED to in_stock')
      }
    }
  }

  console.log('\n=== CLEANUP COMPLETE ===')
}

cleanup()
