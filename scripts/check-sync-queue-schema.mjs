import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  // Get a sample row to see the columns
  const { data, error } = await supabase
    .from('inventory_v4_sync_queue')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Sample row:', data)

  if (data && data.length > 0) {
    console.log('')
    console.log('Available columns:', Object.keys(data[0]))
  } else {
    console.log('Table is empty, inserting test row to see columns...')

    const { data: inserted, error: insertErr } = await supabase
      .from('inventory_v4_sync_queue')
      .insert({
        style_id: 'TEST-SCHEMA-CHECK',
        provider: 'alias',
        status: 'pending'
      })
      .select()

    if (insertErr) {
      console.error('Insert error:', insertErr)
    } else {
      console.log('Inserted:', inserted)
      console.log('Available columns:', Object.keys(inserted[0]))

      // Clean up
      await supabase
        .from('inventory_v4_sync_queue')
        .delete()
        .eq('style_id', 'TEST-SCHEMA-CHECK')
    }
  }
}

main()
