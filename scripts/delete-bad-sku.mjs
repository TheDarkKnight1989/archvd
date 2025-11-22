#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const itemId = '4119851b-6260-428e-8661-0c88988b3ca1'

console.log(`🗑️  Deleting item with ID: ${itemId} (SKU: DC7350-100)\n`)

// Delete the item
const { error } = await supabase
  .from('Inventory')
  .delete()
  .eq('id', itemId)

if (error) {
  console.error('❌ Failed to delete:', error.message)
  process.exit(1)
}

console.log('✅ Item deleted successfully')
