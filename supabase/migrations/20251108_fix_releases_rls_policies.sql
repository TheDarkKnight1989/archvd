-- Fix RLS policies for releases table to allow proper authenticated access
-- This fixes the issue where authenticated users couldn't read releases

-- Re-enable RLS (in case it was disabled during testing)
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies and recreate them correctly
DROP POLICY IF EXISTS "Authenticated users can read releases" ON releases;
DROP POLICY IF EXISTS "Authenticated users can insert releases" ON releases;
DROP POLICY IF EXISTS "Authenticated users can update releases" ON releases;
DROP POLICY IF EXISTS "Service role can insert releases" ON releases;
DROP POLICY IF EXISTS "Service role can update releases" ON releases;
DROP POLICY IF EXISTS "allow_authenticated_read_releases" ON releases;
DROP POLICY IF EXISTS "allow_authenticated_insert_releases" ON releases;
DROP POLICY IF EXISTS "allow_authenticated_update_releases" ON releases;

-- Create simple, permissive policies for authenticated users
CREATE POLICY "allow_authenticated_read_releases"
  ON releases FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "allow_authenticated_insert_releases"
  ON releases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "allow_authenticated_update_releases"
  ON releases FOR UPDATE
  TO authenticated
  USING (true);

-- Grant explicit permissions
GRANT SELECT ON releases TO authenticated;
GRANT SELECT ON releases TO anon;
GRANT INSERT, UPDATE ON releases TO authenticated;
GRANT ALL ON releases TO service_role;
