import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProductHistogram() {
  // Get histogram for Jordan 4 Red Thunder (CT8527-016)
  const { data: histogram } = await supabase
    .from('alias_offer_histograms')
    .select('size_value, price_cents, offer_count, region_code')
    .eq('sku', 'CT8527-016')
    .order('size_value')
    .order('price_cents');
    
  if (histogram?.length) {
    console.log('=== CT8527-016 Bid Histogram ===');
    // Group by size
    const bySize = {};
    for (const row of histogram) {
      const key = `${row.size_value} (${row.region_code})`;
      if (!bySize[key]) bySize[key] = [];
      bySize[key].push({ price: row.price_cents / 100, count: row.offer_count });
    }
    console.log(bySize);
  } else {
    console.log('No histogram data for CT8527-016');
    
    // Get any product with multiple histogram entries
    const { data: sample } = await supabase
      .from('alias_offer_histograms')
      .select('sku, size_value, price_cents, offer_count')
      .order('sku')
      .limit(50);
    
    // Group by sku
    const byProduct = {};
    for (const row of sample || []) {
      if (!byProduct[row.sku]) byProduct[row.sku] = [];
      byProduct[row.sku].push({ size: row.size_value, price: row.price_cents / 100, count: row.offer_count });
    }
    
    // Find product with most entries
    const mostData = Object.entries(byProduct).sort((a, b) => b[1].length - a[1].length)[0];
    if (mostData) {
      console.log(`Product with most histogram data: ${mostData[0]}`);
      console.log(mostData[1]);
    }
  }
}

checkProductHistogram().catch(console.error);
