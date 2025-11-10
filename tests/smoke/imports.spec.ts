import { test, expect } from '@playwright/test';

/**
 * Smoke Test: CSV Import
 *
 * Tests bulk import of inventory items:
 * - Imports 5 rows
 * - Verifies all succeed
 * - Verifies totals match
 */
test('import 5 inventory items via CSV', async ({ request }) => {
  const importData = {
    rows: [
      {
        sku: 'IMPORT-001',
        brand: 'Nike',
        model: 'Dunk Low',
        size_uk: '8',
        purchase_price: 100,
        purchase_date: '2025-01-01',
        condition: 'new',
        location: 'Warehouse A',
        status: 'active'
      },
      {
        sku: 'IMPORT-002',
        brand: 'Adidas',
        model: 'Yeezy Slide',
        size_uk: '9',
        purchase_price: 80,
        purchase_date: '2025-01-02',
        condition: 'new',
        location: 'Warehouse A',
        status: 'active'
      },
      {
        sku: 'IMPORT-003',
        brand: 'New Balance',
        model: '990v6',
        size_uk: '10',
        purchase_price: 150,
        purchase_date: '2025-01-03',
        condition: 'new',
        location: 'Warehouse B',
        status: 'active'
      },
      {
        sku: 'IMPORT-004',
        brand: 'Asics',
        model: 'Gel-Kayano 14',
        size_uk: '8.5',
        purchase_price: 120,
        purchase_date: '2025-01-04',
        condition: 'new',
        location: 'Warehouse B',
        status: 'active'
      },
      {
        sku: 'IMPORT-005',
        brand: 'Salomon',
        model: 'XT-6',
        size_uk: '9.5',
        purchase_price: 130,
        purchase_date: '2025-01-05',
        condition: 'new',
        location: 'Warehouse C',
        status: 'active'
      }
    ],
    batch_id: 'smoke-test-batch-001'
  };

  // Execute import
  const importResponse = await request.post('/api/v1/imports/inventory', {
    data: importData
  });

  expect(importResponse.ok()).toBeTruthy();
  const importResult = await importResponse.json();

  // Verify import summary
  expect(importResult.success).toBe(true);
  expect(importResult.summary).toBeDefined();
  expect(importResult.summary.total).toBe(5);
  expect(importResult.summary.imported).toBe(5);
  expect(importResult.summary.failed).toBe(0);
  expect(importResult.summary.batch_id).toBe('smoke-test-batch-001');

  // Verify all 5 items succeeded
  expect(importResult.results.success).toHaveLength(5);
  expect(importResult.results.errors).toHaveLength(0);

  // Calculate expected total purchase value
  const expectedTotal = 100 + 80 + 150 + 120 + 130; // 580

  // Fetch all imported items
  const listResponse = await request.get('/api/v1/items?status=active');
  const listData = await listResponse.json();

  const importedItems = listData.items.filter((item: any) =>
    ['IMPORT-001', 'IMPORT-002', 'IMPORT-003', 'IMPORT-004', 'IMPORT-005'].includes(item.sku)
  );

  expect(importedItems).toHaveLength(5);

  // Verify total purchase value matches
  const actualTotal = importedItems.reduce(
    (sum: number, item: any) => sum + item.purchase_price,
    0
  );

  expect(actualTotal).toBe(expectedTotal);

  // Verify FX snapshots exist for all items
  importedItems.forEach((item: any) => {
    expect(item.purchase_total_base).toBeGreaterThan(0);
    expect(item.fx_rate_at_purchase).toBeGreaterThan(0);
  });
});

/**
 * Smoke Test: Import Validation
 *
 * Tests that invalid imports are rejected properly
 */
test('reject invalid import rows', async ({ request }) => {
  const invalidData = {
    rows: [
      {
        // Missing SKU - should fail
        brand: 'Nike',
        model: 'Test',
        size_uk: '8',
        purchase_price: 100
      },
      {
        sku: 'INVALID-002',
        brand: 'Adidas',
        model: 'Test',
        size_uk: '9',
        purchase_price: -50 // Negative price - should fail
      }
    ]
  };

  const importResponse = await request.post('/api/v1/imports/inventory', {
    data: invalidData
  });

  // Should get validation error
  expect(importResponse.status()).toBe(400);
  const errorData = await importResponse.json();

  expect(errorData.code).toBe('VALIDATION_ERROR');
  expect(errorData.details).toBeDefined();
});
