#!/usr/bin/env node
import { createClient } from '@/lib/supabase/service';
import { readFileSync, writeFileSync } from 'fs';

/**
 * Map SKUs to Alias catalog_ids using StockX database + Alias URL slug pattern
 *
 * Strategy:
 * 1. Read SKUs from file
 * 2. Look up product in StockX V4 database
 * 3. Use StockX variant_id (which matches Alias catalog_id format)
 * 4. Output catalog IDs for Alias sync
 */

async function mapSKUsToAliasCatalogIds(inputFile: string, outputFile: string) {
  console.log('\n🔄 SKU TO ALIAS CATALOG_ID MAPPER (via StockX)');
  console.log('='.repeat(80));

  const supabase = createClient();

  // Read SKUs
  const skus = readFileSync(inputFile, 'utf-8')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  console.log(`\n📋 Total SKUs to map: ${skus.length}\n`);

  const catalogIds: string[] = [];
  const failed: string[] = [];

  for (let i = 0; i < skus.length; i++) {
    const sku = skus[i];
    const progress = `[${i + 1}/${skus.length}]`;

    process.stdout.write(`${progress} ${sku}... `);

    // Look up SKU in StockX database
    const { data: stockxProduct } = await supabase
      .from('inventory_v4_stockx_products')
      .select('stockx_variant_id, brand, title')
      .eq('sku', sku)
      .single();

    if (stockxProduct?.stockx_variant_id) {
      // StockX variant_id often matches Alias catalog_id format
      // e.g., "air-jordan-1-retro-high-og-chicago-lost-found"
      const catalogId = stockxProduct.stockx_variant_id;
      console.log(`✅ ${catalogId}`);
      catalogIds.push(catalogId);
    } else {
      console.log(`❌ Not found in StockX DB`);
      failed.push(sku);
    }
  }

  // Save results
  writeFileSync(outputFile, catalogIds.join('\n'));

  console.log('\n' + '='.repeat(80));
  console.log('📊 MAPPING SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Mapped:     ${catalogIds.length}`);
  console.log(`❌ Failed:     ${failed.length}`);
  console.log(`📁 Output:     ${outputFile}`);

  if (failed.length > 0) {
    const failedFile = outputFile.replace('.txt', '-failed.txt');
    writeFileSync(failedFile, failed.join('\n'));
    console.log(`❌ Failed SKUs: ${failedFile}`);
  }

  console.log('='.repeat(80));
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: npx tsx scripts/stockx-to-alias-catalog-ids.ts <input-skus.txt> <output-catalog-ids.txt>');
  process.exit(1);
}

mapSKUsToAliasCatalogIds(args[0], args[1]).catch(console.error);
