#!/usr/bin/env node

/**
 * Inventory V4 - StockX Bulk Sync
 * Sync multiple SKUs in sequence with progress tracking
 *
 * Usage:
 *   # From file
 *   npx tsx scripts/inventory-v4-stockx-sync-bulk.ts skus.txt
 *   npx tsx scripts/inventory-v4-stockx-sync-bulk.ts skus.json
 *
 *   # From args
 *   npx tsx scripts/inventory-v4-stockx-sync-bulk.ts DD1391-100 IM6039-200 ...
 *
 * Features:
 *   - Skip already-synced products (resume capability)
 *   - Progress tracking with time estimates
 *   - Continue on errors, summarize at end
 *   - Save results to JSON file
 */

import { fullSyncStockxProductBySku, syncStockxProductBySku } from '@/lib/services/stockx-v4/sync';
import type { SyncResult } from '@/lib/services/stockx-v4/types';
import { createClient as createServiceClient } from '@/lib/supabase/service';
import fs from 'fs';
import path from 'path';

// ============================================================================
// Types
// ============================================================================

type BulkSyncResult = {
  sku: string;
  result: SyncResult | null;
  error?: string;
  skipped?: boolean;
  duration: number;
};

type BulkSyncSummary = {
  total: number;
  synced: number;
  skipped: number;
  failed: number;
  totalDuration: number;
  results: BulkSyncResult[];
};

// ============================================================================
// Config
// ============================================================================

const SKIP_ALREADY_SYNCED = true; // Check DB before syncing
const SAVE_RESULTS = true; // Save to JSON file
const RESULTS_DIR = './sync-results';

// ============================================================================
// Utility: Read SKUs from File or Args
// ============================================================================

function readSkus(input: string[]): string[] {
  if (input.length === 0) {
    throw new Error('No SKUs provided. Usage: npx tsx scripts/inventory-v4-stockx-sync-bulk.ts <file|sku1 sku2 ...>');
  }

  // Check if first arg is a file
  const firstArg = input[0];
  if (fs.existsSync(firstArg)) {
    const content = fs.readFileSync(firstArg, 'utf-8');

    // Try JSON first
    if (firstArg.endsWith('.json')) {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    }

    // Otherwise treat as line-separated
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')); // Skip empty and comments
  }

  // Treat as individual SKUs
  return input;
}

// ============================================================================
// Utility: Check if Product Already Synced
// ============================================================================

async function isProductSynced(sku: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('inventory_v4_stockx_products')
    .select('stockx_product_id')
    .eq('style_id', sku)
    .single();

  return !error && !!data;
}

// ============================================================================
// Utility: Format Duration
// ============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

// ============================================================================
// Utility: Progress Bar
// ============================================================================

function renderProgress(
  current: number,
  total: number,
  synced: number,
  skipped: number,
  failed: number,
  avgDuration: number
): void {
  const percent = Math.floor((current / total) * 100);
  const remaining = total - current;
  const estimatedTime = remaining * avgDuration;

  const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));

  process.stdout.write('\r\x1b[K'); // Clear line
  process.stdout.write(
    `[${bar}] ${percent}% | ` +
    `${current}/${total} | ` +
    `✅ ${synced} ⏭️  ${skipped} ❌ ${failed} | ` +
    `ETA: ${formatDuration(estimatedTime)}`
  );
}

// ============================================================================
// Utility: Save Results to JSON
// ============================================================================

function saveResults(summary: BulkSyncSummary): string {
  if (!SAVE_RESULTS) return '';

  // Create results directory
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `bulk-sync-${timestamp}.json`;
  const filepath = path.join(RESULTS_DIR, filename);

  // Save
  fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));

  return filepath;
}

// ============================================================================
// Main Bulk Sync
// ============================================================================

async function bulkSync(skus: string[]): Promise<BulkSyncSummary> {
  const summary: BulkSyncSummary = {
    total: skus.length,
    synced: 0,
    skipped: 0,
    failed: 0,
    totalDuration: 0,
    results: [],
  };

  const startTime = Date.now();
  const durations: number[] = [];

  for (let i = 0; i < skus.length; i++) {
    const sku = skus[i];
    const skuStartTime = Date.now();

    // Calculate average duration for estimates
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 30000; // Default 30s estimate

    // Show progress
    renderProgress(i, skus.length, summary.synced, summary.skipped, summary.failed, avgDuration);

    try {
      // Check if already synced (if enabled)
      if (SKIP_ALREADY_SYNCED && await isProductSynced(sku)) {
        const duration = Date.now() - skuStartTime;
        summary.results.push({
          sku,
          result: null,
          skipped: true,
          duration,
        });
        summary.skipped++;
        durations.push(duration);
        continue;
      }

      // Sync the product
      const result = await fullSyncStockxProductBySku(sku);
      const duration = Date.now() - skuStartTime;

      summary.results.push({
        sku,
        result,
        duration,
      });

      if (result.success) {
        summary.synced++;
      } else {
        summary.failed++;
      }

      durations.push(duration);
    } catch (error) {
      const duration = Date.now() - skuStartTime;
      summary.results.push({
        sku,
        result: null,
        error: (error as Error)?.message ?? String(error),
        duration,
      });
      summary.failed++;
      durations.push(duration);
    }
  }

  // Final progress (100%)
  renderProgress(skus.length, skus.length, summary.synced, summary.skipped, summary.failed, 0);
  console.log('\n'); // New line after progress bar

  summary.totalDuration = Date.now() - startTime;
  return summary;
}

// ============================================================================
// Display Summary
// ============================================================================

function displaySummary(summary: BulkSyncSummary): void {
  console.log('');
  console.log('='.repeat(80));
  console.log('📊 BULK SYNC SUMMARY');
  console.log('='.repeat(80));
  console.log('');

  // Overall stats
  console.log('📈 Overall:');
  console.log(`  Total SKUs:        ${summary.total}`);
  console.log(`  ✅ Synced:         ${summary.synced}`);
  console.log(`  ⏭️  Skipped:        ${summary.skipped} (already synced)`);
  console.log(`  ❌ Failed:         ${summary.failed}`);
  console.log(`  ⏱️  Total Duration: ${formatDuration(summary.totalDuration)}`);
  console.log('');

  // Success rate
  const successRate = summary.total > 0
    ? Math.floor(((summary.synced + summary.skipped) / summary.total) * 100)
    : 0;
  console.log(`✅ Success Rate: ${successRate}%`);
  console.log('');

  // Detailed counts
  const totalVariants = summary.results
    .filter(r => r.result?.success)
    .reduce((sum, r) => sum + (r.result?.counts.variantsSynced || 0), 0);

  const totalMarketData = summary.results
    .filter(r => r.result?.success)
    .reduce((sum, r) => sum + (r.result?.counts.marketDataRefreshed || 0), 0);

  const totalSnapshots = summary.results
    .filter(r => r.result?.success)
    .reduce((sum, r) => sum + (r.result?.counts.priceSnapshotsInserted || 0), 0);

  console.log('📊 Data Synced:');
  console.log(`  Products:         ${summary.synced}`);
  console.log(`  Variants:         ${totalVariants}`);
  console.log(`  Market Data:      ${totalMarketData}`);
  console.log(`  Price Snapshots:  ${totalSnapshots}`);
  console.log('');

  // Failures (if any)
  if (summary.failed > 0) {
    console.log('❌ Failures:');
    summary.results
      .filter(r => !r.result?.success && !r.skipped)
      .forEach((r, idx) => {
        console.log(`  ${idx + 1}. ${r.sku}`);
        if (r.error) {
          console.log(`     Error: ${r.error}`);
        } else if (r.result) {
          r.result.errors.forEach(err => {
            console.log(`     [${err.stage}] ${err.error}`);
          });
        }
      });
    console.log('');
  }

  // Average duration
  const avgDuration = summary.results.length > 0
    ? summary.results.reduce((sum, r) => sum + r.duration, 0) / summary.results.length
    : 0;
  console.log(`⏱️  Average Duration: ${formatDuration(avgDuration)} per SKU`);
  console.log('');
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  console.log('🔄 INVENTORY V4 - STOCKX BULK SYNC');
  console.log('='.repeat(80));
  console.log('');

  // Read SKUs
  let skus: string[];
  try {
    skus = readSkus(args);
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    console.error('');
    console.error('Usage:');
    console.error('  npx tsx scripts/inventory-v4-stockx-sync-bulk.ts skus.txt');
    console.error('  npx tsx scripts/inventory-v4-stockx-sync-bulk.ts DD1391-100 IM6039-200 ...');
    console.error('');
    process.exit(1);
  }

  console.log(`📋 SKUs to sync: ${skus.length}`);
  console.log(`⚙️  Skip already-synced: ${SKIP_ALREADY_SYNCED ? 'Yes' : 'No'}`);
  console.log(`💾 Save results: ${SAVE_RESULTS ? 'Yes' : 'No'}`);
  console.log('');
  console.log('='.repeat(80));
  console.log('');

  // Run bulk sync
  const summary = await bulkSync(skus);

  // Display summary
  displaySummary(summary);

  // Save results
  if (SAVE_RESULTS) {
    const filepath = saveResults(summary);
    console.log(`💾 Results saved: ${filepath}`);
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('');

  // Exit code
  process.exit(summary.failed === 0 ? 0 : 1);
}

main();
