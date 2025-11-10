#!/usr/bin/env node

/**
 * Market Quick-Add Demo Seed Script
 *
 * Seeds 10 sneakers + 10 Pokémon sealed products with 7-day price history
 * for demonstrating the universal Market Quick-Add search overlay.
 *
 * Usage: npx dotenv -e .env.local -- node scripts/seed-market-demo.mjs
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
 * 10 Popular Sneakers
 */
const SNEAKERS = [
  { sku: 'DZ5485-410', brand: 'Nike', model: 'Dunk Low Retro', colorway: 'University Blue', retail_price: 100, retail_currency: 'GBP', image_url: null },
  { sku: 'DD1391-100', brand: 'Nike', model: 'Dunk Low Retro', colorway: 'Panda', retail_price: 95, retail_currency: 'GBP', image_url: null },
  { sku: 'M990GL6', brand: 'New Balance', model: '990v6', colorway: 'Grey', retail_price: 180, retail_currency: 'GBP', image_url: null },
  { sku: 'GW3773', brand: 'Adidas', model: 'Yeezy Boost 350 V2', colorway: 'Bone', retail_price: 190, retail_currency: 'GBP', image_url: null },
  { sku: '555088-134', brand: 'Nike', model: 'Air Jordan 1 Retro High OG', colorway: 'University Blue', retail_price: 160, retail_currency: 'GBP', image_url: null },
  { sku: '1201A789-250', brand: 'Asics', model: 'Gel-Kayano 14', colorway: 'Cream/Pure Silver', retail_price: 130, retail_currency: 'GBP', image_url: null },
  { sku: 'DN8014-100', brand: 'Nike', model: 'Air Max 1', colorway: 'White/University Red', retail_price: 115, retail_currency: 'GBP', image_url: null },
  { sku: 'M2002RDA', brand: 'New Balance', model: '2002R', colorway: 'Rain Cloud', retail_price: 140, retail_currency: 'GBP', image_url: null },
  { sku: 'L47452100', brand: 'Salomon', model: 'XT-6', colorway: 'Vanilla Ice/Lunar Rock', retail_price: 165, retail_currency: 'GBP', image_url: null },
  { sku: '1123202-BWHT', brand: 'Hoka', model: 'Clifton 9', colorway: 'Black/White', retail_price: 140, retail_currency: 'GBP', image_url: null },
];

/**
 * 10 Pokémon Sealed Products (EN/JP ETBs, Booster Boxes, Tins)
 */
const POKEMON_PRODUCTS = [
  { sku: 'SV06-ETB-EN', name: 'Twilight Masquerade Elite Trainer Box', set_name: 'Twilight Masquerade', language: 'EN', sealed_type: 'ETB', image_url: null },
  { sku: 'SV05-BB-EN', name: 'Temporal Forces Booster Box', set_name: 'Temporal Forces', language: 'EN', sealed_type: 'Booster Box', image_url: null },
  { sku: 'SV04-ETB-EN', name: 'Paradox Rift Elite Trainer Box', set_name: 'Paradox Rift', language: 'EN', sealed_type: 'ETB', image_url: null },
  { sku: 'SV3PT5-BB-JP', name: 'Raging Surf Booster Box', set_name: 'Raging Surf', language: 'JP', sealed_type: 'Booster Box', image_url: null },
  { sku: 'SV03-ETB-EN', name: 'Obsidian Flames Elite Trainer Box', set_name: 'Obsidian Flames', language: 'EN', sealed_type: 'ETB', image_url: null },
  { sku: 'SV2a-BB-JP', name: 'Pokemon Card 151 Booster Box', set_name: 'Pokemon Card 151', language: 'JP', sealed_type: 'Booster Box', image_url: null },
  { sku: 'SV02-BB-EN', name: 'Paldea Evolved Booster Box', set_name: 'Paldea Evolved', language: 'EN', sealed_type: 'Booster Box', image_url: null },
  { sku: 'SWSH12-ETB-EN', name: 'Silver Tempest Elite Trainer Box', set_name: 'Silver Tempest', language: 'EN', sealed_type: 'ETB', image_url: null },
  { sku: 'CEL25-TIN-EN', name: 'Celebrations Ultra-Premium Collection', set_name: 'Celebrations', language: 'EN', sealed_type: 'Tin', image_url: null },
  { sku: 'SV06-BB-EN', name: 'Twilight Masquerade Booster Box', set_name: 'Twilight Masquerade', language: 'EN', sealed_type: 'Booster Box', image_url: null },
];

/**
 * Generate 7-day price history with realistic variance
 */
function generate7DayPrices(basePrice, variance = 0.05) {
  const prices = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Add random variance (-5% to +5% by default)
    const randomFactor = 1 + (Math.random() * variance * 2 - variance);
    const price = Math.round(basePrice * randomFactor * 100) / 100;

    prices.push({
      date: date.toISOString().split('T')[0],
      price: price,
    });
  }

  return prices;
}

/**
 * Main seeding function
 */
async function seed() {
  console.log('🌱 Starting Market Quick-Add demo seed...\n');

  try {
    // 1. Seed sneaker catalog
    console.log('📦 Seeding 10 sneakers to product_catalog...');
    const { data: sneakerData, error: sneakerError } = await supabase
      .from('product_catalog')
      .upsert(SNEAKERS, { onConflict: 'sku' })
      .select();

    if (sneakerError) {
      console.error('❌ Error seeding sneakers:', sneakerError.message);
      throw sneakerError;
    }
    console.log(`✅ Seeded ${sneakerData.length} sneakers\n`);

    // 2. Seed Pokémon catalog
    console.log('🎴 Seeding 10 Pokémon products to trading_card_catalog...');
    const { data: pokemonData, error: pokemonError } = await supabase
      .from('trading_card_catalog')
      .upsert(POKEMON_PRODUCTS, { onConflict: 'sku' })
      .select();

    if (pokemonError) {
      console.error('❌ Error seeding Pokémon:', pokemonError.message);
      throw pokemonError;
    }
    console.log(`✅ Seeded ${pokemonData.length} Pokémon products\n`);

    // 3. Seed sneaker prices (7-day history)
    // Note: sneaker_latest_prices table doesn't exist yet, skipping for now
    console.log('⏭️  Skipping sneaker prices (table not created yet)\n');

    // 4. Seed Pokémon prices (7-day history)
    console.log('💎 Seeding 7-day Pokémon prices...');
    const pokemonPrices = [];
    POKEMON_PRODUCTS.forEach(product => {
      // Base price depends on product type
      let basePrice = 50; // ETB default
      if (product.sealed_type === 'Booster Box') basePrice = 120;
      if (product.sealed_type === 'Tin') basePrice = 80;
      if (product.language === 'JP') basePrice *= 1.15; // JP premium

      const priceHistory = generate7DayPrices(basePrice, 0.06); // 6% variance

      priceHistory.forEach(({ date, price }) => {
        pokemonPrices.push({
          sku: product.sku,
          snapshot_date: new Date(date).toISOString(),
          source: 'ebay',
          min_price: (price * 0.9).toString(),
          median_price: price.toString(),
          p75_price: (price * 1.1).toString(),
          max_price: (price * 1.2).toString(),
          listing_count: Math.floor(Math.random() * 50) + 10,
          currency: 'GBP',
        });
      });
    });

    const { error: pokemonPriceError } = await supabase
      .from('trading_card_market_snapshots')
      .upsert(pokemonPrices, { onConflict: 'sku,snapshot_date,source' });

    if (pokemonPriceError) {
      console.error('❌ Error seeding Pokémon prices:', pokemonPriceError.message);
      throw pokemonPriceError;
    }
    console.log(`✅ Seeded ${pokemonPrices.length} Pokémon price points\n`);

    // 5. Summary
    console.log('✨ Market Quick-Add demo seed complete!\n');
    console.log('📊 Summary:');
    console.log(`   - ${SNEAKERS.length} sneakers in product_catalog`);
    console.log(`   - ${POKEMON_PRODUCTS.length} Pokémon products in trading_card_catalog`);
    console.log(`   - ${pokemonPrices.length} Pokémon price points (7 days)`);
    console.log(`   - Sneaker prices: skipped (table not yet created)`);
    console.log('\n🔍 Test the overlay by searching for:');
    console.log('   - "Dunk" (sneakers - will show without prices)');
    console.log('   - "Twilight" (Pokémon - with sparklines)');
    console.log('   - "DZ5485-410" (exact SKU match)');
    console.log('   - "New Balance" (brand)');
    console.log('\n💡 Note: Sneakers will appear in results but without market prices/sparklines until sneaker_latest_prices table is created.');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run seed
seed();
