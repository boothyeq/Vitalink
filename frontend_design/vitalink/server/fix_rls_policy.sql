-- This script allows server-side inserts to bp_readings table
-- Run this in your Supabase SQL Editor

-- Drop the restrictive insert policy if it exists
DROP POLICY IF EXISTS "Users can insert their own bp_readings" ON bp_readings;

-- Create a permissive policy that allows all inserts
-- This is needed because the server uses ANON_KEY, not SERVICE_ROLE_KEY
CREATE POLICY "Allow all inserts to bp_readings"
  ON bp_readings
  FOR INSERT
  WITH CHECK (true);

-- Verify the policy was created
SELECT * FROM pg_policies WHERE tablename = 'bp_readings';
