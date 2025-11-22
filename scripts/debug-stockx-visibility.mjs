import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugStockXVisibility() {
  console.log('Checking StockX mapping and listing data...\n')

  // Get a sample item
  const { data: items } = await supabase
    .from('Inventory')
    .select('id, sku, brand, model, size_uk')
    .limit(5)

  console.log(`Found ${items?.length || 0} sample items\n`)

  for (const item of items || []) {
    console.log(`\n--- ${item.brand} ${item.model} (${item.sku}) ---`)

    // Check mapping
    const { data: mapping } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id, stockx_listing_id')
      .eq('item_id', item.id)
      .eq('provider', 'stockx')
      .maybeSingle()

    if (!mapping) {
      console.log('  ❌ NOT mapped to StockX')
      console.log('  → "List on StockX" should NOT appear')
      continue
    }

    console.log('  ✅ Mapped to StockX')
    console.log(`     Product: ${mapping.stockx_product_id}`)
    console.log(`     Variant: ${mapping.stockx_variant_id}`)
    console.log(`     Listing ID ref: ${mapping.stockx_listing_id || 'null'}`)

    // Check if has listing
    if (mapping.stockx_listing_id) {
      const { data: listing } = await supabase
        .from('stockx_listings')
        .select('stockx_listing_id, status, amount')
        .eq('id', mapping.stockx_listing_id)
        .maybeSingle()

      if (listing) {
        console.log(`  📋 Has listing: ${listing.stockx_listing_id}`)
        console.log(`     Status: ${listing.status}`)
        console.log(`     Ask: $${listing.amount}`)  // BUG FIX: Amount already in major units
        console.log('  → "List on StockX" should NOT appear')
        console.log(`  → Should show: Reprice, ${listing.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}, Delete`)
      } else {
        console.log('  ⚠️  Listing ID exists but no listing found')
      }
    } else {
      console.log('  ✅ NO listing')
      console.log('  → "List on StockX" SHOULD appear')
    }
  }
}

debugStockXVisibility().catch(console.error)
