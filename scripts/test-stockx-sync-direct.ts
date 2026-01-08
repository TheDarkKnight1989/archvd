import { syncStockxProductBySku } from '../src/lib/services/stockx-v4/sync';

async function main() {
  console.log('Testing StockX sync for FV5029-010...');
  const result = await syncStockxProductBySku('FV5029-010');

  console.log('\nSync result:');
  console.log('  success:', result.success);
  console.log('  productId:', result.productId);
  console.log('  variantsSynced:', result.counts.variantsSynced);
  console.log('  marketDataRefreshed:', result.counts.marketDataRefreshed);
  console.log('  rateLimited:', result.counts.rateLimited);
  console.log('  errors:', result.errors.length);

  if (result.errors.length > 0) {
    console.log('\nFirst 3 errors:');
    result.errors.slice(0, 3).forEach(e => console.log('  -', e.error));
  }
}

main().catch(console.error);
