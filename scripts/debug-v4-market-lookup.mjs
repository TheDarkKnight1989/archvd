import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Simulate what useInventoryV4 does
 */
function convertToUsSize(ukSize, sizeUnit) {
  if (sizeUnit === 'US') return ukSize;
  const numeric = parseFloat(ukSize);
  if (isNaN(numeric)) return ukSize;
  // UK → US: add 1
  const usSize = numeric + 1;
  return String(usSize);
}

function normalizeSize(size) {
  const s = size.trim();
  const match = s.match(/^([0-9.]+)([WM]?)$/i);
  if (match) {
    const numPart = match[1].includes('.') ? String(Number(match[1])) : match[1];
    return numPart + match[2].toUpperCase();
  }
  return s;
}

async function debug() {
  // Get V4 items
  const { data: items } = await supabase
    .from('inventory_v4_items')
    .select(`*, style:inventory_v4_style_catalog (*)`)
    .in('style_id', ['FV5029-010', 'CT8012-047']);

  console.log('=== Debugging V4 Market Lookup ===\n');

  for (const item of items) {
    const style = item.style;
    console.log(`Item: ${style?.name || item.style_id}`);
    console.log(`  style_id: ${item.style_id}`);
    console.log(`  size: ${item.size} ${item.size_unit}`);

    // Convert to US
    const usSize = convertToUsSize(item.size, item.size_unit);
    const normalizedUsSize = normalizeSize(usSize);
    console.log(`  US size: ${usSize}, normalized: ${normalizedUsSize}`);

    // Call RPC
    const { data: marketData, error } = await supabase.rpc('get_unified_market_data_batch', {
      p_style_ids: [item.style_id],
      p_sizes: [usSize, normalizedUsSize],
      p_alias_region: '1',
      p_consigned: false,
      p_stockx_currency: 'GBP',
    });

    if (error) {
      console.log(`  RPC Error: ${error.message}`);
      continue;
    }

    console.log(`  RPC returned ${marketData?.length || 0} rows`);

    // Check if any row matches our size
    const matchingRow = marketData?.find(r => {
      const rpcNormalized = normalizeSize(r.size_display);
      return rpcNormalized === normalizedUsSize;
    });

    if (matchingRow) {
      console.log(`  ✓ MATCH FOUND:`);
      console.log(`    size_display: ${matchingRow.size_display}`);
      console.log(`    alias_lowest_ask: ${matchingRow.alias_lowest_ask}`);
      console.log(`    alias_highest_bid: ${matchingRow.alias_highest_bid}`);
      console.log(`    has_alias: ${matchingRow.has_alias}`);
    } else {
      console.log(`  ✗ NO MATCH - Available sizes from RPC:`);
      marketData?.forEach(r => {
        console.log(`    "${r.size_display}" (normalized: "${normalizeSize(r.size_display)}")`);
      });
    }
    console.log('');
  }
}

debug();
