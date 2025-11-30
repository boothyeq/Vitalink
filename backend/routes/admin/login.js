const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = (supabase) => async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Hash the provided password
        const passwordHash = hashPassword(password);

        // Query the admins table
        const { data: admin, error } = await supabase
            .from('admins')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .eq('password_hash', passwordHash)
            .eq('is_active', true)
            .single();

        if (error || !admin) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last login time
        await supabase
            .from('admins')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', admin.id);

        // Return admin data (without password hash)
        const { password_hash, ...adminData } = admin;

        res.json({
            success: true,
            admin: adminData,
            message: 'Login successful'
        });

    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
