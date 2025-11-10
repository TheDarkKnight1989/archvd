#!/usr/bin/env node

/**
 * Comprehensive Seed Script
 *
 * Seeds database with realistic development data:
 * - 25 SKUs (real sneaker SKUs)
 * - ~80 price points (mock market data)
 * - 10 inventory items (mix of active/sold)
 * - 5 sales (with P&L data)
 * - 6 expenses
 * - 3 subscriptions
 * - 2 watchlists
 *
 * Usage: npx dotenv -e .env.local -- node scripts/seed-comprehensive.mjs
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
 * Real sneaker SKUs for seeding
 */
const SEED_SKUS = [
  // Nike Dunk
  { sku: 'DZ5485-410', brand: 'Nike', model: 'Dunk Low Retro', colorway: 'University Blue' },
  { sku: 'DD1391-100', brand: 'Nike', model: 'Dunk Low Retro', colorway: 'Panda' },
  { sku: 'CW1590-001', brand: 'Nike', model: 'Dunk High Retro', colorway: 'Black/White' },

  // Nike Air Jordan
  { sku: 'DC7350-100', brand: 'Nike', model: 'Air Jordan 1 Low', colorway: 'White/Black' },
  { sku: 'DZ5485-612', brand: 'Nike', model: 'Air Jordan 1 High', colorway: 'Chicago' },
  { sku: '555088-134', brand: 'Nike', model: 'Air Jordan 1 Retro High OG', colorway: 'University Blue' },

  // Adidas Yeezy
  { sku: 'GW3773', brand: 'Adidas', model: 'Yeezy Boost 350 V2', colorway: 'Bone' },
  { sku: 'HQ6316', brand: 'Adidas', model: 'Yeezy Slide', colorway: 'Onyx' },
  { sku: 'GZ5541', brand: 'Adidas', model: 'Yeezy 450', colorway: 'Cloud White' },

  // New Balance
  { sku: 'M990GL6', brand: 'New Balance', model: '990v6', colorway: 'Grey' },
  { sku: 'M2002RDA', brand: 'New Balance', model: '2002R', colorway: 'Rain Cloud' },
  { sku: 'U9060LIN', brand: 'New Balance', model: '9060', colorway: 'Castlerock' },

  // Asics
  { sku: '1201A789-250', brand: 'Asics', model: 'Gel-Kayano 14', colorway: 'Cream/Pure Silver' },
  { sku: '1203A413-103', brand: 'Asics', model: 'Gel-1130', colorway: 'White/Pure Silver' },

  // Nike Air Max
  { sku: 'DN8014-100', brand: 'Nike', model: 'Air Max 1', colorway: 'White/University Red' },
  { sku: 'FD9082-101', brand: 'Nike', model: 'Air Max 90', colorway: 'White/Black' },
  { sku: 'DR9609-100', brand: 'Nike', model: 'Air Max 97', colorway: 'White/Wolf Grey' },

  // Travis Scott Collabs
  { sku: 'DM0121-001', brand: 'Nike', model: 'Air Jordan 1 Low x Travis Scott', colorway: 'Mocha' },
  { sku: 'DN4575-200', brand: 'Nike', model: 'Air Max 1 x Travis Scott', colorway: 'Baroque Brown' },

  // Supreme Collabs
  { sku: 'DH3228-102', brand: 'Nike', model: 'Dunk Low Pro SB x Supreme', colorway: 'White/Mean Green' },

  // Off-White Collabs
  { sku: 'AA3830-101', brand: 'Nike', model: 'Air Jordan 1 x Off-White', colorway: 'Chicago' },

  // Salomon
  { sku: 'L47452100', brand: 'Salomon', model: 'XT-6', colorway: 'Vanilla Ice/Lunar Rock' },

  // Hoka
  { sku: '1123202-BWHT', brand: 'Hoka', model: 'Clifton 9', colorway: 'Black/White' },

  // On Running
  { sku: '3MD10251539', brand: 'On', model: 'Cloudmonster', colorway: 'All Black' },

  // Nike SB
  { sku: 'FD2562-400', brand: 'Nike', model: 'SB Dunk Low Pro', colorway: 'Blue Raspberry' }
];

/**
 * UK Sizes for sneakers
 */
const UK_SIZES = ['6', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12'];

/**
 * Generate mock market prices for all SKUs
 */
function generateMarketPrices() {
  const prices = [];
  const today = new Date();

  SEED_SKUS.forEach(product => {
    // Generate base price (£100-£500)
    const basePrice = 100 + Math.random() * 400;

    // Generate prices for 3-4 sizes per SKU
    const numSizes = 3 + Math.floor(Math.random() * 2);
    const selectedSizes = UK_SIZES.sort(() => 0.5 - Math.random()).slice(0, numSizes);

    selectedSizes.forEach(size => {
      // Generate last 30 days of prices with variation
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        // Add daily variation (±5%)
        const dailyVariation = 1 + (Math.random() * 0.1 - 0.05);
        const price = basePrice * dailyVariation;

        prices.push({
          sku: product.sku,
          size,
          price: Number(price.toFixed(2)),
          as_of: dateStr,
          source: 'seed_mock',
          meta: {
            brand: product.brand,
            model: product.model,
            colorway: product.colorway
          }
        });
      }
    });
  });

  return prices;
}

/**
 * Generate inventory items
 */
function generateInventory(userId) {
  const inventory = [];
  const today = new Date();

  // Select 10 random SKUs
  const selectedSkus = SEED_SKUS.sort(() => 0.5 - Math.random()).slice(0, 10);

  selectedSkus.forEach((product, idx) => {
    const size = UK_SIZES[Math.floor(Math.random() * UK_SIZES.length)];
    const purchasePrice = 80 + Math.random() * 200;

    // Purchase date in last 6 months
    const purchaseDate = new Date(today);
    purchaseDate.setDate(purchaseDate.getDate() - Math.floor(Math.random() * 180));

    // Mark first 5 as sold
    const isSold = idx < 5;

    const item = {
      user_id: userId,
      sku: product.sku,
      brand: product.brand,
      model: product.model,
      colorway: product.colorway,
      size_uk: size,
      size,
      category: 'sneaker',
      condition: 'new',
      purchase_price: Number(purchasePrice.toFixed(2)),
      purchase_currency: 'GBP',
      purchase_date: purchaseDate.toISOString().split('T')[0],
      tax: Number((purchasePrice * 0.2).toFixed(2)),
      shipping: Number((10 + Math.random() * 10).toFixed(2)),
      place_of_purchase: ['Nike.com', 'Size?', 'JD Sports', 'END Clothing'][Math.floor(Math.random() * 4)],
      status: isSold ? 'sold' : 'active',
      location: 'Home',
      notes: isSold ? 'Quick flip for profit' : null
    };

    // Add sold info for sold items
    if (isSold) {
      const soldDate = new Date(purchaseDate);
      soldDate.setDate(soldDate.getDate() + 30 + Math.floor(Math.random() * 60));

      const soldPrice = purchasePrice * (1.2 + Math.random() * 0.5); // 20-70% markup

      item.sold_price = Number(soldPrice.toFixed(2));
      item.sold_date = soldDate.toISOString().split('T')[0];
      item.platform = ['ebay', 'stockx', 'goat', 'private'][Math.floor(Math.random() * 4)];
      item.sales_fee = Number((soldPrice * 0.1).toFixed(2)); // 10% fees
    }

    inventory.push(item);
  });

  return inventory;
}

/**
 * Generate expenses
 */
function generateExpenses(userId) {
  const today = new Date();

  return [
    {
      user_id: userId,
      category: 'shipping',
      amount: 45.50,
      date: new Date(today.setDate(today.getDate() - 5)).toISOString().split('T')[0],
      description: 'Royal Mail tracked shipping x5 parcels',
      expense_currency: 'GBP'
    },
    {
      user_id: userId,
      category: 'fees',
      amount: 89.99,
      date: new Date(today.setDate(today.getDate() - 15)).toISOString().split('T')[0],
      description: 'eBay final value fees',
      expense_currency: 'GBP'
    },
    {
      user_id: userId,
      category: 'ads',
      amount: 120.00,
      date: new Date(today.setDate(today.getDate() - 20)).toISOString().split('T')[0],
      description: 'Instagram promoted posts',
      expense_currency: 'GBP'
    },
    {
      user_id: userId,
      category: 'supplies',
      amount: 35.75,
      date: new Date(today.setDate(today.getDate() - 25)).toISOString().split('T')[0],
      description: 'Packaging materials - boxes, bubble wrap',
      expense_currency: 'GBP'
    },
    {
      user_id: userId,
      category: 'supplies',
      amount: 15.99,
      date: new Date(today.setDate(today.getDate() - 30)).toISOString().split('T')[0],
      description: 'Printer labels',
      expense_currency: 'GBP'
    },
    {
      user_id: userId,
      category: 'misc',
      amount: 49.00,
      date: new Date(today.setDate(today.getDate() - 35)).toISOString().split('T')[0],
      description: 'Authentication service fee',
      expense_currency: 'GBP'
    }
  ];
}

/**
 * Generate subscriptions
 */
function generateSubscriptions(userId) {
  return [
    {
      user_id: userId,
      name: 'StockX Premium',
      vendor: 'StockX',
      amount: 9.99,
      currency: 'GBP',
      interval: 'monthly',
      subscription_currency: 'GBP',
      active: true
    },
    {
      user_id: userId,
      name: 'eBay Store',
      vendor: 'eBay',
      amount: 24.99,
      currency: 'GBP',
      interval: 'monthly',
      subscription_currency: 'GBP',
      active: true
    },
    {
      user_id: userId,
      name: 'Shipping Insurance',
      vendor: 'Parcel2Go',
      amount: 99.00,
      currency: 'GBP',
      interval: 'annual',
      subscription_currency: 'GBP',
      active: true
    }
  ];
}

/**
 * Generate watchlists
 */
function generateWatchlists(userId) {
  return [
    {
      user_id: userId,
      name: 'Release Tracker',
      description: 'Upcoming hyped releases to cop',
      tags: ['releases', 'hyped']
    },
    {
      user_id: userId,
      name: 'Archive Hunt',
      description: 'Vintage grails to find',
      tags: ['archive', 'vintage']
    }
  ];
}

/**
 * Main seeding function
 */
async function main() {
  console.log('🌱 Comprehensive Seed Script\n');

  // Get first user (or create test user)
  const { data: users } = await supabase.from('profiles').select('id').limit(1);

  if (!users || users.length === 0) {
    console.error('❌ No users found. Please create a user first.');
    process.exit(1);
  }

  const userId = users[0].id;
  console.log(`👤 Using user: ${userId}\n`);

  // 1. Seed market prices
  console.log('📊 Seeding market prices...');
  const marketPrices = generateMarketPrices();
  console.log(`   Generated ${marketPrices.length} price points for ${SEED_SKUS.length} SKUs`);

  let inserted = 0;
  for (let i = 0; i < marketPrices.length; i += 100) {
    const batch = marketPrices.slice(i, i + 100);
    const { error } = await supabase
      .from('product_market_prices')
      .upsert(batch, { onConflict: 'sku,size,as_of', ignoreDuplicates: true });

    if (error) {
      console.error(`   ❌ Error inserting batch ${i / 100 + 1}:`, error.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`\r   Inserted: ${inserted}/${marketPrices.length}`);
    }
  }
  console.log('\n✅ Market prices seeded\n');

  // 2. Seed inventory
  console.log('📦 Seeding inventory...');
  const inventory = generateInventory(userId);

  for (const item of inventory) {
    const { data, error } = await supabase
      .from('Inventory')
      .insert(item)
      .select()
      .single();

    if (error) {
      console.error(`   ❌ Error inserting ${item.sku}:`, error.message);
    } else {
      console.log(`   ✓ ${item.brand} ${item.model} (${item.size_uk}) - ${item.status}`);
    }
  }
  console.log('✅ Inventory seeded\n');

  // 3. Seed expenses
  console.log('💰 Seeding expenses...');
  const expenses = generateExpenses(userId);

  const { data: expensesData, error: expensesError } = await supabase
    .from('expenses')
    .insert(expenses)
    .select();

  if (expensesError) {
    console.error('   ❌ Error inserting expenses:', expensesError.message);
  } else {
    console.log(`   ✓ Inserted ${expensesData.length} expenses`);
  }
  console.log('✅ Expenses seeded\n');

  // 4. Seed subscriptions
  console.log('🔄 Seeding subscriptions...');
  const subscriptions = generateSubscriptions(userId);

  const { data: subsData, error: subsError } = await supabase
    .from('subscriptions')
    .insert(subscriptions)
    .select();

  if (subsError) {
    console.error('   ❌ Error inserting subscriptions:', subsError.message);
  } else {
    console.log(`   ✓ Inserted ${subsData.length} subscriptions`);
  }
  console.log('✅ Subscriptions seeded\n');

  // 5. Seed watchlists
  console.log('👀 Seeding watchlists...');
  const watchlists = generateWatchlists(userId);

  for (const watchlist of watchlists) {
    const { data: wlData, error: wlError } = await supabase
      .from('watchlists')
      .insert(watchlist)
      .select()
      .single();

    if (wlError) {
      console.error(`   ❌ Error creating watchlist "${watchlist.name}":`, wlError.message);
    } else {
      console.log(`   ✓ ${watchlist.name}`);

      // Add 2-3 items to each watchlist
      const watchlistSkus = SEED_SKUS.sort(() => 0.5 - Math.random()).slice(0, 3);

      for (const product of watchlistSkus) {
        const { error: itemError } = await supabase
          .from('watchlist_items')
          .insert({
            watchlist_id: wlData.id,
            sku: product.sku,
            brand: product.brand,
            model: product.model,
            colorway: product.colorway,
            size_preference: UK_SIZES[Math.floor(Math.random() * UK_SIZES.length)],
            target_price: 150 + Math.random() * 200,
            notes: 'Must cop!'
          });

        if (!itemError) {
          console.log(`      + ${product.brand} ${product.model}`);
        }
      }
    }
  }
  console.log('✅ Watchlists seeded\n');

  // Summary
  console.log('📋 Seeding Summary:');
  console.log(`   ✓ ${SEED_SKUS.length} SKUs`);
  console.log(`   ✓ ${marketPrices.length} price points`);
  console.log(`   ✓ ${inventory.length} inventory items (${inventory.filter(i => i.status === 'sold').length} sold)`);
  console.log(`   ✓ ${expenses.length} expenses`);
  console.log(`   ✓ ${subscriptions.length} subscriptions`);
  console.log(`   ✓ ${watchlists.length} watchlists`);
  console.log('');
  console.log('✨ Comprehensive seed complete!\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
