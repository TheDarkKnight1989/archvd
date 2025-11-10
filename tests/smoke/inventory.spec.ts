import { test, expect } from '@playwright/test';

/**
 * Smoke Test 1: Create item → appears in Inventory
 *
 * Tests the complete flow of creating an inventory item via API
 * and verifying it appears in the database.
 */
test('create item and verify in inventory', async ({ request }) => {
  // Create a new item via API
  const createResponse = await request.post('/api/v1/items', {
    data: {
      sku: 'TEST-001',
      brand: 'Nike',
      model: 'Air Jordan 1',
      size_uk: '10',
      size: '10',
      category: 'sneaker',
      condition: 'new',
      purchase_price: 150,
      purchase_currency: 'GBP',
      purchase_date: '2025-01-01',
      tax: 30,
      shipping: 10
    },
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Verify response
  expect(createResponse.ok()).toBeTruthy();
  const createData = await createResponse.json();

  expect(createData.success).toBe(true);
  expect(createData.item).toBeDefined();
  expect(createData.item.sku).toBe('TEST-001');
  expect(createData.item.status).toBe('active');
  expect(createData.item.purchase_total_base).toBeGreaterThan(0);
  expect(createData.fx_info).toBeDefined();

  // Verify item appears in list
  const listResponse = await request.get('/api/v1/items?status=active');
  expect(listResponse.ok()).toBeTruthy();

  const listData = await listResponse.json();
  expect(listData.success).toBe(true);

  const createdItem = listData.items.find((item: any) => item.sku === 'TEST-001');
  expect(createdItem).toBeDefined();
  expect(createdItem.id).toBe(createData.item.id);
});

/**
 * Smoke Test 2: Mark sold → moves to Sales, P&L updated
 *
 * Tests the complete flow of marking an item as sold and
 * verifying it creates a sales record with correct P&L.
 */
test('mark item as sold and verify sales record', async ({ request }) => {
  // First create an item
  const createResponse = await request.post('/api/v1/items', {
    data: {
      sku: 'TEST-002',
      brand: 'Adidas',
      model: 'Yeezy 350',
      size_uk: '9',
      purchase_price: 200,
      purchase_currency: 'GBP',
      purchase_date: '2025-01-01'
    }
  });

  const createData = await createResponse.json();
  const itemId = createData.item.id;

  // Mark as sold
  const soldResponse = await request.post(`/api/v1/items/${itemId}/mark-sold`, {
    data: {
      sold_price: 300,
      sold_date: '2025-01-15',
      sale_currency: 'GBP',
      platform: 'stockx',
      fees: 30,
      shipping: 10
    }
  });

  expect(soldResponse.ok()).toBeTruthy();
  const soldData = await soldResponse.json();

  // Verify response structure
  expect(soldData.success).toBe(true);
  expect(soldData.item.status).toBe('sold');
  expect(soldData.sales_id).toBeDefined();
  expect(soldData.accounting).toBeDefined();

  // Verify accounting calculations
  const { accounting } = soldData;
  expect(accounting.sale_total_base).toBe(300);
  expect(accounting.fees_base).toBe(30);
  expect(accounting.shipping_base).toBe(10);
  expect(accounting.profit_base).toBeGreaterThan(0); // Should be positive (300 - 200 - 30 - 10 = 60)

  // Verify item no longer in active inventory
  const activeListResponse = await request.get('/api/v1/items?status=active');
  const activeData = await activeListResponse.json();
  const soldItemInActive = activeData.items.find((item: any) => item.id === itemId);
  expect(soldItemInActive).toBeUndefined();

  // Verify item in sold inventory
  const soldListResponse = await request.get('/api/v1/items?status=sold');
  const soldListData = await soldListResponse.json();
  const soldItemInList = soldListData.items.find((item: any) => item.id === itemId);
  expect(soldItemInList).toBeDefined();
});

/**
 * Smoke Test 3: Market data endpoint
 *
 * Tests fetching mock market data for a SKU
 */
test('fetch market data for SKU', async ({ request }) => {
  const marketResponse = await request.get('/api/v1/market/DZ5485-410');

  expect(marketResponse.ok()).toBeTruthy();
  const marketData = await marketResponse.json();

  expect(marketData.success).toBe(true);
  expect(marketData.sku).toBe('DZ5485-410');
  expect(marketData.data_points).toBeDefined();
  expect(marketData.meta).toBeDefined();
  expect(marketData.meta.source).toBe('mock');
});
