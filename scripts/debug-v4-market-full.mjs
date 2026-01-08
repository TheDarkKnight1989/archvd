import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Replicate the hook logic exactly
function normalizeSize(size) {
  const s = size.trim();
  const match = s.match(/^([0-9.]+)([WM]?)$/i);
  if (match) {
    const numPart = match[1].includes('.') ? String(Number(match[1])) : match[1];
    return numPart + match[2].toUpperCase();
  }
  return s;
}

function detectBrand(brandName, productTitle) {
  const text = `${brandName || ''} ${productTitle || ''}`.toLowerCase();
  if (text.includes('jordan')) return 'jordan';
  if (text.includes('nike')) return 'nike';
  return 'generic';
}

function detectGender(productTitle) {
  const title = (productTitle || '').toLowerCase();
  if (title.includes("women's") || title.includes('wmns')) return 'women';
  return 'men';
}

// Nike/Jordan Men's US→UK chart (we need UK→US reverse lookup)
const NIKE_MENS_US_TO_UK = {
  7.5: 6.5, 8: 7, 8.5: 7.5, 9: 8, 9.5: 8.5, 10: 9, 10.5: 9.5, 11: 10
};

function convertUkToUs(ukSize, brand, gender) {
  // Reverse lookup
  for (const [us, uk] of Object.entries(NIKE_MENS_US_TO_UK)) {
    if (uk === ukSize) return parseFloat(us);
  }
  return null;
}

function convertToUsSize(size, unit, gender, brandName, productName) {
  const num = parseFloat(size);
  if (isNaN(num)) return size;
  const brand = detectBrand(brandName, productName);

  let isWomens;
  if (gender) {
    isWomens = gender === 'women';
  } else {
    const detected = detectGender(productName);
    isWomens = detected === 'women';
  }

  let usSize;
  if (unit === 'US') {
    usSize = num;
  } else if (unit === 'UK') {
    const detected = isWomens ? null : convertUkToUs(num, brand, 'men');
    if (detected !== null) {
      usSize = detected;
    } else {
      usSize = num + (isWomens ? 2.5 : 1);
    }
  }

  const rounded = Math.round(usSize * 2) / 2;
  const formatted = rounded % 1 === 0 ? String(rounded) : String(rounded);
  return isWomens ? formatted + 'W' : formatted;
}

async function debug() {
  // The actual items
  const items = [
    { style_id: 'CT8012-047', size: '9', size_unit: 'UK', brand: 'Jordan', name: 'Jordan 11 Retro Gamma Blue (2025)', gender: null },
    { style_id: 'FV5029-010', size: '7.5', size_unit: 'UK', brand: 'Jordan', name: 'Jordan 4 Retro Black Cat (2025)', gender: null },
  ];

  console.log('=== Size Conversion Test ===');
  const sizes = [];
  for (const item of items) {
    const usSize = convertToUsSize(item.size, item.size_unit, item.gender, item.brand, item.name);
    const normalized = normalizeSize(usSize);
    console.log(`${item.style_id}: ${item.size} ${item.size_unit} → US ${usSize} → normalized: ${normalized}`);
    sizes.push(usSize);
    sizes.push(normalized);
  }

  // Call RPC
  console.log('\n=== RPC Call ===');
  const styleIds = items.map(i => i.style_id);
  const uniqueSizes = [...new Set(sizes)];
  console.log('Querying styleIds:', styleIds);
  console.log('Querying sizes:', uniqueSizes);

  const { data: rpcData, error } = await supabase.rpc('get_unified_market_data_batch', {
    p_style_ids: styleIds,
    p_sizes: uniqueSizes,
    p_alias_region: '1',
    p_consigned: false,
    p_stockx_currency: 'GBP'
  });

  if (error) {
    console.log('RPC error:', error);
    return;
  }

  console.log('RPC returned', rpcData?.length, 'rows');

  // Build map like hook does
  const marketDataMap = new Map();
  for (const row of rpcData) {
    const key = `${row.style_id}|${normalizeSize(row.size_display)}`;
    marketDataMap.set(key, row);
  }
  console.log('Map keys:', Array.from(marketDataMap.keys()));

  // Now try to lookup like hook does
  console.log('\n=== Lookup Test ===');
  for (const item of items) {
    const usSize = convertToUsSize(item.size, item.size_unit, item.gender, item.brand, item.name);
    const normalized = normalizeSize(usSize);
    const key = `${item.style_id}|${normalized}`;
    const row = marketDataMap.get(key);

    console.log(`${item.style_id}:`);
    console.log(`  lookup key: ${key}`);
    console.log(`  found: ${!!row}`);
    if (row) {
      console.log(`  has_alias: ${row.has_alias}`);
      console.log(`  alias_lowest_ask: ${row.alias_lowest_ask}`);
      console.log(`  alias_highest_bid: ${row.alias_highest_bid}`);
      console.log(`  alias_last_sale: ${row.alias_last_sale}`);
    }
  }

  // Now simulate the pricing calculation
  console.log('\n=== Pricing Calculation Simulation ===');
  for (const item of items) {
    const usSize = convertToUsSize(item.size, item.size_unit, item.gender, item.brand, item.name);
    const normalized = normalizeSize(usSize);
    const key = `${item.style_id}|${normalized}`;
    const marketRow = marketDataMap.get(key);

    if (!marketRow) {
      console.log(`${item.style_id}: No market data found`);
      continue;
    }

    // Build marketInput like hook does
    const marketInput = {
      styleId: item.style_id,
      size: item.size,
      sizeUnit: item.size_unit,
      stockx: marketRow?.has_stockx ? {
        lowestAsk: marketRow.stockx_lowest_ask,
        highestBid: marketRow.stockx_highest_bid,
        currency: 'GBP',
      } : null,
      alias: marketRow?.has_alias ? {
        lowestAsk: marketRow.alias_lowest_ask,
        highestBid: marketRow.alias_highest_bid,
        lastSalePrice: marketRow.alias_last_sale,
        salesLast72h: marketRow.alias_sales_72h,
        salesLast30d: marketRow.alias_sales_30d,
      } : null,
    };

    console.log(`${item.style_id}:`);
    console.log(`  has_alias: ${marketRow.has_alias}`);
    console.log(`  marketInput.alias:`, marketInput.alias);
    console.log(`  alias.lowestAsk: ${marketInput.alias?.lowestAsk}`);
  }
}

debug().catch(console.error);
