import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHistogramData() {
  // Get a sample product's histogram
  const { data: histogramSample, error } = await supabase
    .from('alias_offer_histograms')
    .select('*')
    .eq('size_value', 10)
    .order('price_cents', { ascending: true })
    .limit(20);
    
  console.log('Histogram data for size 10:');
  console.log(histogramSample);
  
  // Count total histogram records
  const { count } = await supabase
    .from('alias_offer_histograms')
    .select('*', { count: 'exact', head: true });
  console.log('\nTotal histogram records:', count);
  
  // Check unique SKUs with histogram data
  const { data: skus } = await supabase
    .from('alias_offer_histograms')
    .select('sku')
    .limit(10);
  console.log('\nSKUs with histogram data:', [...new Set(skus?.map(s => s.sku))]);
}

checkHistogramData().catch(console.error);
