#!/usr/bin/env node
import { createClient } from '@/lib/supabase/service';

/**
 * Backfill inventory_v4_style_catalog from inventory_v4_stockx_products
 *
 * Strategy:
 * 1. Read all products from StockX products table
 * 2. Filter out products without SKUs
 * 3. Transform data to style catalog format
 * 4. Upsert with ON CONFLICT DO UPDATE (idempotent)
 */

async function backfillStyleCatalog() {
  console.log('\n🔄 BACKFILLING STYLE CATALOG FROM STOCKX');
  console.log('='.repeat(80));

  const supabase = createClient();

  // Fetch all StockX products
  console.log('\n📦 Fetching StockX products...');
  const { data: stockxProducts, error: fetchError } = await supabase
    .from('inventory_v4_stockx_products')
    .select('*')
    .not('style_id', 'is', null); // Skip products without SKUs

  if (fetchError) {
    console.error('❌ Failed to fetch StockX products:', fetchError.message);
    process.exit(1);
  }

  if (!stockxProducts || stockxProducts.length === 0) {
    console.log('⚠️  No StockX products found');
    process.exit(0);
  }

  console.log(`✅ Found ${stockxProducts.length} products with SKUs\n`);

  // Transform and upsert
  let successCount = 0;
  let failureCount = 0;
  const errors: Array<{ sku: string; error: string }> = [];

  for (let i = 0; i < stockxProducts.length; i++) {
    const product = stockxProducts[i];
    const progress = `[${i + 1}/${stockxProducts.length}]`;

    process.stdout.write(`${progress} ${product.style_id}... `);

    // Transform retail_price to cents
    const retailPriceCents = product.retail_price
      ? Math.round(parseFloat(product.retail_price) * 100)
      : null;

    // Prepare row for style catalog
    const catalogRow = {
      style_id: product.style_id,
      brand: product.brand,
      name: product.title,
      nickname: null, // Not available from StockX yet
      colorway: product.colorway,
      gender: product.gender,
      product_category: product.product_type,
      release_date: product.release_date,
      retail_price_cents: retailPriceCents,
      primary_image_url: null, // Not available in StockX products table yet
      stockx_product_id: product.stockx_product_id,
      stockx_url_key: product.url_key,
      alias_catalog_id: null, // Will be populated manually or via sync
    };

    // Upsert with conflict handling
    const { error: upsertError } = await supabase
      .from('inventory_v4_style_catalog')
      .upsert(catalogRow, {
        onConflict: 'style_id',
        ignoreDuplicates: false, // Update if exists
      });

    if (upsertError) {
      console.log(`❌ ${upsertError.message}`);
      failureCount++;
      errors.push({ sku: product.style_id, error: upsertError.message });
    } else {
      console.log('✅');
      successCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 BACKFILL SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Successfully backfilled: ${successCount}`);
  console.log(`❌ Failed:                  ${failureCount}`);
  console.log('='.repeat(80));

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(({ sku, error }) => {
      console.log(`  ${sku}: ${error}`);
    });
  }

  // Verify final count
  console.log('\n🔍 Verifying...');
  const { count, error: countError } = await supabase
    .from('inventory_v4_style_catalog')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Verification failed:', countError.message);
  } else {
    console.log(`✅ Total rows in style catalog: ${count}`);
  }

  // Show sample
  console.log('\n📋 Sample entries:');
  const { data: samples } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, brand, name, stockx_url_key, alias_catalog_id')
    .limit(5);

  if (samples) {
    samples.forEach((s, i) => {
      console.log(`\n  ${i + 1}. ${s.style_id}`);
      console.log(`     Brand:   ${s.brand}`);
      console.log(`     Name:    ${s.name}`);
      console.log(`     StockX:  ${s.stockx_url_key ? '✅' : '❌'}`);
      console.log(`     Alias:   ${s.alias_catalog_id ? '✅' : '❌'}`);
    });
  }

  console.log('\n✅ Backfill complete!\n');
}

backfillStyleCatalog().catch(console.error);
