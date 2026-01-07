-- Add partial unique index to prevent duplicate active sync jobs
-- Only one pending/processing job allowed per style_id + provider

CREATE UNIQUE INDEX IF NOT EXISTS uq_v4_sync_active_job
ON inventory_v4_sync_queue (style_id, provider)
WHERE status IN ('pending', 'processing');

-- Create incremental enqueue function (only stale styles, skip recent failures)
CREATE OR REPLACE FUNCTION enqueue_stale_v4_sync_jobs(
  hours_back INT DEFAULT 12,
  cooldown_days INT DEFAULT 7
)
RETURNS TABLE (
  enqueued_alias INT,
  enqueued_stockx INT,
  skipped_fresh INT,
  skipped_missing_mapping INT,
  skipped_failed_cooldown INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_enqueued_alias INT := 0;
  v_enqueued_stockx INT := 0;
  v_skipped_fresh INT := 0;
  v_skipped_missing_mapping INT := 0;
  v_skipped_failed_cooldown INT := 0;
  v_cutoff TIMESTAMPTZ := NOW() - (hours_back || ' hours')::INTERVAL;
  v_cooldown_cutoff TIMESTAMPTZ := NOW() - (cooldown_days || ' days')::INTERVAL;
  v_style RECORD;
  v_alias_fresh BOOLEAN;
  v_stockx_fresh BOOLEAN;
  v_alias_in_cooldown BOOLEAN;
  v_stockx_in_cooldown BOOLEAN;
BEGIN
  FOR v_style IN
    SELECT style_id, alias_catalog_id, stockx_url_key
    FROM inventory_v4_style_catalog
  LOOP
    -- Check Alias freshness and cooldown
    IF v_style.alias_catalog_id IS NOT NULL THEN
      -- Check if there's a recent failed job in cooldown (max retries exhausted)
      SELECT EXISTS(
        SELECT 1 FROM inventory_v4_sync_queue
        WHERE style_id = v_style.style_id
          AND provider = 'alias'
          AND status = 'failed'
          AND (attempts >= max_attempts OR max_attempts = 0)
          AND completed_at >= v_cooldown_cutoff
        LIMIT 1
      ) INTO v_alias_in_cooldown;

      IF v_alias_in_cooldown THEN
        v_skipped_failed_cooldown := v_skipped_failed_cooldown + 1;
      ELSE
        -- Check freshness
        SELECT EXISTS(
          SELECT 1 FROM inventory_v4_alias_market_data md
          JOIN inventory_v4_alias_variants v ON v.id = md.alias_variant_id
          WHERE v.alias_catalog_id = v_style.alias_catalog_id
            AND md.updated_at >= v_cutoff
          LIMIT 1
        ) INTO v_alias_fresh;

        IF NOT v_alias_fresh THEN
          -- Enqueue alias job (ON CONFLICT DO NOTHING due to unique index)
          INSERT INTO inventory_v4_sync_queue (style_id, provider, status)
          VALUES (v_style.style_id, 'alias', 'pending')
          ON CONFLICT DO NOTHING;

          IF FOUND THEN
            v_enqueued_alias := v_enqueued_alias + 1;
          END IF;
        ELSE
          v_skipped_fresh := v_skipped_fresh + 1;
        END IF;
      END IF;
    ELSE
      v_skipped_missing_mapping := v_skipped_missing_mapping + 1;
    END IF;

    -- Check StockX freshness and cooldown
    IF v_style.stockx_url_key IS NOT NULL THEN
      -- Check if there's a recent failed job in cooldown
      SELECT EXISTS(
        SELECT 1 FROM inventory_v4_sync_queue
        WHERE style_id = v_style.style_id
          AND provider = 'stockx'
          AND status = 'failed'
          AND (attempts >= max_attempts OR max_attempts = 0)
          AND completed_at >= v_cooldown_cutoff
        LIMIT 1
      ) INTO v_stockx_in_cooldown;

      IF v_stockx_in_cooldown THEN
        v_skipped_failed_cooldown := v_skipped_failed_cooldown + 1;
      ELSE
        -- Check freshness
        SELECT EXISTS(
          SELECT 1 FROM inventory_v4_stockx_market_data md
          JOIN inventory_v4_stockx_variants v ON v.stockx_variant_id = md.stockx_variant_id
          JOIN inventory_v4_stockx_products p ON p.stockx_product_id = v.stockx_product_id
          WHERE p.url_key = v_style.stockx_url_key
            AND md.updated_at >= v_cutoff
          LIMIT 1
        ) INTO v_stockx_fresh;

        IF NOT v_stockx_fresh THEN
          -- Enqueue stockx job
          INSERT INTO inventory_v4_sync_queue (style_id, provider, status)
          VALUES (v_style.style_id, 'stockx', 'pending')
          ON CONFLICT DO NOTHING;

          IF FOUND THEN
            v_enqueued_stockx := v_enqueued_stockx + 1;
          END IF;
        ELSE
          v_skipped_fresh := v_skipped_fresh + 1;
        END IF;
      END IF;
    ELSE
      v_skipped_missing_mapping := v_skipped_missing_mapping + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_enqueued_alias, v_enqueued_stockx, v_skipped_fresh, v_skipped_missing_mapping, v_skipped_failed_cooldown;
END;
$$;

-- Function to reset a failed job for manual retry
CREATE OR REPLACE FUNCTION reset_failed_sync_job(
  p_style_id TEXT,
  p_provider TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated BOOLEAN := FALSE;
BEGIN
  -- Update existing failed job to pending, reset attempts
  UPDATE inventory_v4_sync_queue
  SET
    status = 'pending',
    attempts = 0,
    max_attempts = 3,
    last_error = NULL,
    next_retry_at = NOW(),
    completed_at = NULL
  WHERE style_id = p_style_id
    AND provider = p_provider
    AND status = 'failed';

  IF FOUND THEN
    v_updated := TRUE;
  ELSE
    -- No failed job exists, create a new pending job
    INSERT INTO inventory_v4_sync_queue (style_id, provider, status)
    VALUES (p_style_id, p_provider, 'pending')
    ON CONFLICT DO NOTHING;

    v_updated := FOUND;
  END IF;

  RETURN v_updated;
END;
$$;
