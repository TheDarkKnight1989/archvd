import pg from 'pg'

const { Client } = pg

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  await client.connect()
  console.log('Connected to database')

  try {
    // 1. Create the unique index
    console.log('\n1. Creating partial unique index...')
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_v4_sync_active_job
      ON inventory_v4_sync_queue (style_id, provider)
      WHERE status IN ('pending', 'processing');
    `)
    console.log('   ✅ Index created')

    // 2. Create the RPC function
    console.log('\n2. Creating enqueue_stale_v4_sync_jobs function...')
    await client.query(`
      CREATE OR REPLACE FUNCTION enqueue_stale_v4_sync_jobs(
        hours_back INT DEFAULT 12,
        stockx_baseline BOOLEAN DEFAULT TRUE
      )
      RETURNS TABLE (
        enqueued_alias INT,
        enqueued_stockx INT,
        skipped_fresh INT,
        skipped_missing_mapping INT
      )
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_enqueued_alias INT := 0;
        v_enqueued_stockx INT := 0;
        v_skipped_fresh INT := 0;
        v_skipped_missing_mapping INT := 0;
        v_cutoff TIMESTAMPTZ := NOW() - (hours_back || ' hours')::INTERVAL;
        v_style RECORD;
        v_alias_fresh BOOLEAN;
        v_stockx_fresh BOOLEAN;
      BEGIN
        FOR v_style IN
          SELECT style_id, alias_catalog_id, stockx_url_key
          FROM inventory_v4_style_catalog
        LOOP
          -- Check Alias freshness
          IF v_style.alias_catalog_id IS NOT NULL THEN
            SELECT EXISTS(
              SELECT 1 FROM inventory_v4_alias_market_data md
              JOIN inventory_v4_alias_variants v ON v.id = md.alias_variant_id
              WHERE v.alias_catalog_id = v_style.alias_catalog_id
                AND md.recorded_at >= v_cutoff
              LIMIT 1
            ) INTO v_alias_fresh;

            IF NOT v_alias_fresh THEN
              INSERT INTO inventory_v4_sync_queue (style_id, provider, status)
              VALUES (v_style.style_id, 'alias', 'pending')
              ON CONFLICT DO NOTHING;

              IF FOUND THEN
                v_enqueued_alias := v_enqueued_alias + 1;
              END IF;
            ELSE
              v_skipped_fresh := v_skipped_fresh + 1;
            END IF;
          ELSE
            v_skipped_missing_mapping := v_skipped_missing_mapping + 1;
          END IF;

          -- Check StockX freshness
          IF v_style.stockx_url_key IS NOT NULL THEN
            SELECT EXISTS(
              SELECT 1 FROM inventory_v4_stockx_market_data md
              JOIN inventory_v4_stockx_variants v ON v.id = md.stockx_variant_id
              JOIN inventory_v4_stockx_products p ON p.stockx_product_id = v.stockx_product_id
              WHERE p.url_key = v_style.stockx_url_key
                AND md.recorded_at >= v_cutoff
              LIMIT 1
            ) INTO v_stockx_fresh;

            IF NOT v_stockx_fresh THEN
              INSERT INTO inventory_v4_sync_queue (style_id, provider, status)
              VALUES (v_style.style_id, 'stockx', 'pending')
              ON CONFLICT DO NOTHING;

              IF FOUND THEN
                v_enqueued_stockx := v_enqueued_stockx + 1;
              END IF;
            ELSE
              v_skipped_fresh := v_skipped_fresh + 1;
            END IF;
          ELSE
            v_skipped_missing_mapping := v_skipped_missing_mapping + 1;
          END IF;
        END LOOP;

        RETURN QUERY SELECT v_enqueued_alias, v_enqueued_stockx, v_skipped_fresh, v_skipped_missing_mapping;
      END;
      $$;
    `)
    console.log('   ✅ Function created')

    // Verify
    console.log('\n3. Verifying...')
    const { rows: indexes } = await client.query(`
      SELECT indexname FROM pg_indexes WHERE indexname = 'uq_v4_sync_active_job'
    `)
    console.log('   Index exists:', indexes.length > 0 ? '✅' : '❌')

    const { rows: funcs } = await client.query(`
      SELECT proname FROM pg_proc WHERE proname = 'enqueue_stale_v4_sync_jobs'
    `)
    console.log('   Function exists:', funcs.length > 0 ? '✅' : '❌')

  } finally {
    await client.end()
  }

  console.log('\n✅ Migration applied successfully')
}

main().catch(console.error)
