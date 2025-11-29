#!/usr/bin/env node
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const client = await pool.connect();
  try {
    // Find items with Alias mappings
    const result = await client.query(`
      SELECT
        i.id,
        i.sku,
        i.brand,
        i.model,
        i.size_uk,
        ial.alias_catalog_id,
        aci.sku as alias_sku
      FROM "Inventory" i
      JOIN inventory_alias_links ial ON i.id = ial.inventory_id
      LEFT JOIN alias_catalog_items aci ON ial.alias_catalog_id = aci.catalog_id
      WHERE ial.alias_catalog_id IS NOT NULL
        AND ial.mapping_status = 'ok'
      ORDER BY i.created_at DESC
      LIMIT 5;
    `);

    console.log('\n📦 Inventory items with Alias mappings:\n');
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.brand} ${row.model}`);
      console.log(`   SKU: ${row.sku}`);
      console.log(`   Size UK: ${row.size_uk}`);
      console.log(`   Inventory ID: ${row.id}`);
      console.log(`   Alias Catalog ID: ${row.alias_catalog_id}`);
      console.log(`   Market page URL: http://localhost:3000/portfolio/market/${row.alias_catalog_id}?itemId=${row.id}`);
      console.log('');
    });

    if (result.rows.length === 0) {
      console.log('❌ No items with Alias mappings found');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
