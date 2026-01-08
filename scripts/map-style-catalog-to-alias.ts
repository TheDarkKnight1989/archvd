#!/usr/bin/env node
/**
 * SKU → Alias Catalog ID Mapper
 *
 * Populates inventory_v4_style_catalog.alias_catalog_id by:
 * 1. Reading all SKUs where alias_catalog_id IS NULL
 * 2. Searching Alias API by SKU
 * 3. Extracting catalog_id from first result
 * 4. Updating the style catalog
 */

import { createClient } from '@/lib/supabase/service';
import { createAliasClient } from '@/lib/services/alias/client';
import { AliasAPIError } from '@/lib/services/alias/errors';

interface MappingResult {
  sku: string;
  catalogId: string | null;
  error?: string;
}

async function mapStyleCatalogToAlias() {
  console.log('\n🔄 SKU → ALIAS CATALOG ID MAPPER');
  console.log('='.repeat(80));

  const supabase = createClient();
  const aliasClient = createAliasClient();

  // Fetch all SKUs without Alias catalog IDs
  console.log('\n📋 Fetching SKUs without Alias mapping...');
  const { data: products, error: fetchError } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id')
    .is('alias_catalog_id', null)
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('❌ Failed to fetch products:', fetchError.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log('✅ All products already have Alias catalog IDs!');
    process.exit(0);
  }

  console.log(`✅ Found ${products.length} products to map\n`);

  // Process each SKU
  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;
  const results: MappingResult[] = [];
  const notFoundSkus: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const { style_id: sku } = products[i];
    const progress = `[${i + 1}/${products.length}]`;

    // Skip empty/invalid SKUs
    if (!sku || !sku.trim()) {
      console.log(`${progress} (empty SKU) ⏭️  Skipped`);
      notFoundCount++;
      notFoundSkus.push('(empty)');
      results.push({ sku: '(empty)', catalogId: null });
      continue;
    }

    process.stdout.write(`${progress} ${sku}... `);

    try {
      // Search Alias by SKU
      const response = await aliasClient.searchCatalog(sku, { limit: 1 });

      // Defensive: Check if response and catalog_items exist
      const catalogItems = response?.catalog_items;
      if (!catalogItems || !Array.isArray(catalogItems)) {
        console.log('⚠️  Invalid API response');
        errorCount++;
        results.push({ sku, catalogId: null, error: 'Invalid API response structure' });
        continue;
      }

      if (catalogItems.length > 0) {
        const catalogId = catalogItems[0]?.catalog_id;

        // Defensive: Ensure catalog_id exists
        if (!catalogId) {
          console.log('⚠️  Missing catalog_id in response');
          errorCount++;
          results.push({ sku, catalogId: null, error: 'Missing catalog_id in API response' });
          continue;
        }

        // Update style catalog
        const { error: updateError } = await supabase
          .from('inventory_v4_style_catalog')
          .update({ alias_catalog_id: catalogId })
          .eq('style_id', sku);

        if (updateError) {
          console.log(`❌ Update failed: ${updateError.message}`);
          errorCount++;
          results.push({ sku, catalogId: null, error: updateError.message });
        } else {
          console.log(`✅ ${catalogId}`);
          successCount++;
          results.push({ sku, catalogId });
        }
      } else {
        console.log('⏭️  Not found on Alias');
        notFoundCount++;
        notFoundSkus.push(sku);
        results.push({ sku, catalogId: null });
      }
    } catch (error: unknown) {
      // Check if it's a 404 (not found) - treat as expected outcome
      const isNotFound = error instanceof AliasAPIError && error.isNotFoundError();

      if (isNotFound) {
        console.log('⏭️  Not found on Alias (404)');
        notFoundCount++;
        notFoundSkus.push(sku);
        results.push({ sku, catalogId: null });
      } else {
        // Actual error - safer error message extraction
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Unknown error';

        console.log(`❌ ${errorMessage}`);
        errorCount++;
        results.push({ sku, catalogId: null, error: errorMessage });
      }
    }

    // Rate limiting: pause between requests
    if (i < products.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms between requests
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 MAPPING SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Successfully mapped: ${successCount}`);
  console.log(`⏭️  Not found on Alias:  ${notFoundCount}`);
  console.log(`❌ Errors:              ${errorCount}`);
  console.log('='.repeat(80));

  // Show failures if any
  if (errorCount > 0) {
    console.log('\n❌ FAILED MAPPINGS:');
    results
      .filter(r => r.error)
      .forEach(r => {
        console.log(`  ${r.sku}: ${r.error}`);
      });
  }

  // Show not-found SKUs for manual mapping
  if (notFoundSkus.length > 0) {
    console.log('\n⏭️  NOT FOUND ON ALIAS (for manual mapping):');
    notFoundSkus.forEach(sku => {
      console.log(`  ${sku}`);
    });
  }

  // Verify final state
  console.log('\n🔍 Verifying final state...');
  const { data: stats } = await supabase
    .from('inventory_v4_style_catalog')
    .select('alias_catalog_id')
    .not('alias_catalog_id', 'is', null);

  console.log(`✅ Total products with Alias catalog IDs: ${stats?.length || 0}`);

  // Sample mappings
  console.log('\n📋 Sample mappings:');
  const samples = results.filter(r => r.catalogId).slice(0, 5);
  samples.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.sku} → ${s.catalogId}`);
  });

  console.log('\n✅ Mapping complete!\n');
}

mapStyleCatalogToAlias().catch(console.error);
