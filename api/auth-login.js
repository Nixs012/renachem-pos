const { supabase } = require('./utils/supabase');
const bcrypt = require('bcryptjs');

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
            console.log('Login failed: User not found', username);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // 2. Verify Password using bcrypt
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            console.log('Login failed: Password mismatch', username);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // 3. Generate a session token (using Supabase Auth for the web mode)
        // We use the Service Role to bypass some Auth restrictions for this custom flow
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: `${username}@renachem.local`,
            password: password
        });

        // If Supabase Auth fails (e.g. user not in GoTrue), we can still return success 
        // with the user data, but some RLS might be restricted.
        // For a simple POS, we'll return the user info.
        
        return res.status(200).json({
            success: true,
            token: authData ? authData.session.access_token : 'fallback-token',
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ success: false, error: 'Server error: ' + error.message });
    }
};
