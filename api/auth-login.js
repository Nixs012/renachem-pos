const { supabase } = require('./utils/supabase');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password required' });
        }

        // 1. Get user by username
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (fetchError || !user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // 2. Verify Password (simplified for demo, should use bcrypt in production if possible)
        // Note: For full security, use Supabase Auth or a secure bridge
        if (user.password !== password) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // 3. Generate a session token (using Supabase Auth for the web mode)
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: `${username}@renachem.local`,
            password: password
        });

        if (authError) {
            return res.status(401).json({ success: false, error: 'Cloud auth failed: ' + authError.message });
        }

        return res.status(200).json({
            success: true,
            token: authData.session.access_token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
};
