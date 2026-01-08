#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data } = await supabase.from('master_market_data').select('provider').limit(10000);
  const providers = new Set(data?.map(r => r.provider));

  console.log('Providers in database:', Array.from(providers).join(', '));
  console.log('\nHas Alias data:', providers.has('alias') ? 'YES ✅' : 'NO ❌');
  console.log('Has eBay data:', providers.has('ebay') ? 'YES ✅' : 'NO ❌');
  console.log('Has StockX data:', providers.has('stockx') ? 'YES ✅' : 'NO ❌');
}

check();
