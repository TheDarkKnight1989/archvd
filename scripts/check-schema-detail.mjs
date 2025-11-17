import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  // Query PostgreSQL information_schema
  const { data, error } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'inventory_market_links'
        ORDER BY ordinal_position
      `
    })

  if (error) {
    console.error('Error:', error)

    // Try a different approach - insert a test row
    console.log('\nTrying alternative: test insert to see schema...')
    const { error: insertError } = await supabase
      .from('inventory_market_links')
      .insert({
        item_id: '00000000-0000-0000-0000-000000000000',
        stockx_product_id: 'test',
        stockx_variant_id: 'test'
      })

    if (insertError) {
      console.log('Insert error reveals schema:', insertError.message)
    }

    return
  }

  console.log('inventory_market_links schema:')
  console.table(data)
}

checkSchema().catch(console.error)
