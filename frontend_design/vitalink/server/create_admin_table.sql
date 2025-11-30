-- Create admin table
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- Enable Row Level Security
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to manage admins
CREATE POLICY "Service role can manage admins"
    ON admins
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert the first admin (password will be hashed by the backend)
-- Note: This is a placeholder. The actual password hash will be inserted via the backend
INSERT INTO admins (email, password_hash, first_name, last_name)
VALUES ('myhfguard.host@gmail.com', 'PLACEHOLDER', 'Admin', 'User')
ON CONFLICT (email) DO NOTHING;

-- Verify the table was created
SELECT * FROM admins;
