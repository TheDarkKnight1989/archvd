-- FIX: Sync queue trigger functions
-- Issues fixed:
-- 1. ON CONFLICT doesn't work with partial unique index → use IF NOT EXISTS
-- 2. RLS blocks insert from user context → add SECURITY DEFINER

CREATE OR REPLACE FUNCTION queue_stockx_sync_job()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stockx_url_key IS NOT NULL THEN
    IF (TG_OP = 'INSERT') OR
       (TG_OP = 'UPDATE' AND (NEW.stockx_url_key IS DISTINCT FROM OLD.stockx_url_key)) THEN
      IF NOT EXISTS (
        SELECT 1 FROM inventory_v4_sync_queue
        WHERE style_id = NEW.style_id
          AND provider = 'stockx'
          AND status = 'pending'
      ) THEN
        INSERT INTO inventory_v4_sync_queue (style_id, provider, status)
        VALUES (NEW.style_id, 'stockx', 'pending');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION queue_alias_sync_job()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.alias_catalog_id IS NOT NULL THEN
    IF (TG_OP = 'INSERT') OR
       (TG_OP = 'UPDATE' AND (NEW.alias_catalog_id IS DISTINCT FROM OLD.alias_catalog_id)) THEN
      IF NOT EXISTS (
        SELECT 1 FROM inventory_v4_sync_queue
        WHERE style_id = NEW.style_id
          AND provider = 'alias'
          AND status = 'pending'
      ) THEN
        INSERT INTO inventory_v4_sync_queue (style_id, provider, status)
        VALUES (NEW.style_id, 'alias', 'pending');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
