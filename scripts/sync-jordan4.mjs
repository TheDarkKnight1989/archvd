#!/usr/bin/env node
import { syncStockxProduct } from '../src/lib/services/stockx/market-refresh.js'

async function sync() {
  const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'
  const productId = '15795a80-5cc8-4d2d-9ed0-20250d83be7f'

  console.log('Syncing Jordan 4 Black Cat market data...\n')

  const result = await syncStockxProduct(userId, productId, 'GBP')

  console.log('\n✅ Sync complete:', result)
}

sync().catch(console.error)
