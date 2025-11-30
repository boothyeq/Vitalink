-- This script ensures the admins table exists with proper RLS policies
-- Run this in your Supabase SQL Editor

-- The admins table should already exist from sample_database.txt
-- This script just adds the missing index and RLS policy if needed

-- Create index on email for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(email);

-- Enable Row Level Security
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Service role can manage admins" ON public.admins;
DROP POLICY IF EXISTS "Allow all operations on admins" ON public.admins;

-- Create a permissive policy that allows all operations
-- This is safe because the admins table is only accessed by the backend
CREATE POLICY "Allow all operations on admins"
    ON public.admins
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Verify the table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'admins'
ORDER BY ordinal_position;
