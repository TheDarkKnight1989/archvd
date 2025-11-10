#!/usr/bin/env node

/**
 * Populate FX Rates Table with Historical Sample Data
 *
 * This script generates 2 years of sample FX rate data for GBP/USD and GBP/EUR.
 * Rates oscillate around realistic values with daily variation.
 *
 * Usage: npx dotenv -e .env.local -- node scripts/populate-fx-rates.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Generate FX rates for a date range
 */
function generateFXRates(startDate, endDate) {
  const rates = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];

    // GBP per USD: oscillate around 0.787 ± 0.05
    const gbpPerUsd = 0.787 + (Math.random() * 0.1 - 0.05);

    // GBP per EUR: oscillate around 0.855 ± 0.04
    const gbpPerEur = 0.855 + (Math.random() * 0.08 - 0.04);

    rates.push({
      as_of: dateStr,
      gbp_per_usd: Number(gbpPerUsd.toFixed(6)),
      gbp_per_eur: Number(gbpPerEur.toFixed(6)),
      source: 'script_seed',
      meta: {
        note: 'Sample historical data for development',
        generated_at: new Date().toISOString()
      }
    });

    current.setDate(current.getDate() + 1);
  }

  return rates;
}

/**
 * Insert rates in batches
 */
async function insertRates(rates, batchSize = 100) {
  console.log(`📊 Inserting ${rates.length} FX rates in batches of ${batchSize}...`);

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rates.length; i += batchSize) {
    const batch = rates.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('fx_rates')
      .upsert(batch, {
        onConflict: 'as_of',
        ignoreDuplicates: true
      })
      .select();

    if (error) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error.message);
      continue;
    }

    const batchInserted = data?.length || 0;
    inserted += batchInserted;
    skipped += batch.length - batchInserted;

    process.stdout.write(`\r   Progress: ${Math.min(i + batchSize, rates.length)}/${rates.length} (${inserted} inserted, ${skipped} skipped)`);
  }

  console.log('\n');
  return { inserted, skipped };
}

/**
 * Show sample of recent rates
 */
async function showSample() {
  const { data, error } = await supabase
    .from('fx_rates')
    .select('as_of, gbp_per_usd, gbp_per_eur, usd_per_gbp, eur_per_gbp')
    .order('as_of', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error fetching sample:', error.message);
    return;
  }

  console.log('📈 Sample of recent rates:\n');
  console.log('   Date       | GBP/USD  | USD/GBP  | GBP/EUR  | EUR/GBP');
  console.log('   -----------|----------|----------|----------|----------');

  data.forEach(row => {
    const usdPerGbp = (1 / row.gbp_per_usd).toFixed(4);
    const eurPerGbp = (1 / row.gbp_per_eur).toFixed(4);
    console.log(`   ${row.as_of} | £${row.gbp_per_usd.toFixed(4)} | $${usdPerGbp} | £${row.gbp_per_eur.toFixed(4)} | €${eurPerGbp}`);
  });

  console.log('');
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 FX Rates Population Script\n');

  // Check if table already has data
  const { count: existingCount } = await supabase
    .from('fx_rates')
    .select('*', { count: 'exact', head: true });

  console.log(`📋 Current fx_rates table has ${existingCount || 0} rows\n`);

  // Generate 2 years of data
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);

  console.log(`📅 Generating rates from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);

  const rates = generateFXRates(startDate, endDate);

  // Insert rates
  const { inserted, skipped } = await insertRates(rates);

  console.log(`✅ Complete!`);
  console.log(`   - Inserted: ${inserted} new rates`);
  console.log(`   - Skipped: ${skipped} existing dates\n`);

  // Show final count
  const { count: finalCount } = await supabase
    .from('fx_rates')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Final fx_rates table has ${finalCount || 0} rows\n`);

  // Show sample
  await showSample();

  console.log('✨ Done! Your FX rates table is ready for multi-currency accounting.\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
