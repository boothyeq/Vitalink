const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

// Simple password hashing using Node.js crypto
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

async function setupAdmin() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env file');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const email = 'myhfguard.host@gmail.com';
    const password = "don'tmissabeat";
    const passwordHash = hashPassword(password);

    console.log('Setting up admin account...');
    console.log('Email:', email);

    try {
        // Check if admin already exists
        const { data: existing, error: checkError } = await supabase
            .from('admins')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (checkError) {
            console.error('Error checking for existing admin:', checkError);
            console.error('\nMake sure you have run the SQL schema from sample_database.txt in your Supabase SQL Editor first!');
            process.exit(1);
        }

        if (existing) {
            console.log('Admin already exists. Updating password...');
            const { error: updateError } = await supabase
                .from('admins')
                .update({
                    password_hash: passwordHash,
                    is_active: true
                })
                .eq('email', email);

            if (updateError) {
                console.error('Error updating admin:', updateError);
                process.exit(1);
            }
            console.log('✓ Admin password updated successfully!');
        } else {
            console.log('Creating new admin...');
            const { error: insertError } = await supabase
                .from('admins')
                .insert([{
                    email: email,
                    password_hash: passwordHash,
                    first_name: 'Admin',
                    last_name: 'User',
                    is_active: true
                }]);

            if (insertError) {
                console.error('Error creating admin:', insertError);
                process.exit(1);
            }
            console.log('✓ Admin created successfully!');
        }

        console.log('\nAdmin credentials:');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('\nYou can now log in at http://localhost:5173/admin/login');
    } catch (err) {
        console.error('Unexpected error:', err);
        process.exit(1);
    }
}

setupAdmin().catch(console.error);
