-- Create purchase_places table
-- Stores user's frequently used places of purchase with last used timestamp

CREATE TABLE IF NOT EXISTS purchase_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique place names per user
  UNIQUE(user_id, name)
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_purchase_places_user_id ON purchase_places(user_id);

-- Index for ordering by last used
CREATE INDEX IF NOT EXISTS idx_purchase_places_last_used ON purchase_places(user_id, last_used_at DESC);

-- Enable RLS
ALTER TABLE purchase_places ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own purchase places
CREATE POLICY "Users can view own purchase places"
  ON purchase_places
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own purchase places
CREATE POLICY "Users can insert own purchase places"
  ON purchase_places
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own purchase places
CREATE POLICY "Users can update own purchase places"
  ON purchase_places
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own purchase places
CREATE POLICY "Users can delete own purchase places"
  ON purchase_places
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant access
GRANT ALL ON purchase_places TO authenticated;
GRANT ALL ON purchase_places TO service_role;
