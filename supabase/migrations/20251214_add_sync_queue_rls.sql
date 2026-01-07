-- Add RLS policy for inventory_v4_sync_queue (read-only for authenticated users)
-- This allows the client to poll sync status

ALTER TABLE inventory_v4_sync_queue ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read sync queue status
CREATE POLICY "Users can read sync queue status"
  ON inventory_v4_sync_queue
  FOR SELECT
  TO authenticated
  USING (true);
