#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

/**
 * Map SKUs to Alias catalog_ids using Alias search API
 */

const ALIAS_API_URL = process.env.ALIAS_API_BASE_URL || 'https://api.alias.org';
const ALIAS_AUTH_TOKEN = process.env.ALIAS_PAT || process.env.ALIAS_AUTH_TOKEN;

if (!ALIAS_AUTH_TOKEN) {
  console.error('❌ ALIAS_PAT or ALIAS_AUTH_TOKEN not set');
  process.exit(1);
}

interface SearchResult {
  catalog_id: string;
  sku: string;
  brand: string;
  name: string;
}

async function searchBySKU(sku: string): Promise<string | null> {
  try {
    // Try search endpoint
    const searchUrl = `${ALIAS_API_URL}/catalog/search?q=${encodeURIComponent(sku)}&limit=5`;

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${ALIAS_AUTH_TOKEN}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`  ⚠️  Search failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    // Look for exact SKU match in results
    if (data.results && Array.isArray(data.results)) {
      for (const item of data.results) {
        // Normalize SKUs for comparison (remove spaces, dashes, lowercase)
        const normalizedItemSku = (item.sku || '').replace(/[\s-]/g, '').toLowerCase();
        const normalizedSearchSku = sku.replace(/[\s-]/g, '').toLowerCase();

        if (normalizedItemSku === normalizedSearchSku) {
          return item.catalog_id;
        }
      }
    }

    return null;
  } catch (error: any) {
    console.error(`  ⚠️  Error searching: ${error.message}`);
    return null;
  }
}

async function mapSKUs(inputFile: string, outputFile: string) {
  console.log('\n🔄 SKU TO ALIAS CATALOG_ID MAPPER');
  console.log('='.repeat(80));

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

    const catalogId = await searchBySKU(sku);

    if (catalogId) {
      console.log(`✅ ${catalogId}`);
      catalogIds.push(catalogId);
    } else {
      console.log(`❌ Not found`);
      failed.push(sku);
    }

    // Rate limiting: 60 req/min = 1 per second
    if (i < skus.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
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
  console.log('Usage: npx tsx scripts/map-skus-to-alias-catalog-ids.ts <input-skus.txt> <output-catalog-ids.txt>');
  process.exit(1);
}

mapSKUs(args[0], args[1]).catch(console.error);
