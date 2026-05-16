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

        // 1. Get user from the 'public.users' table
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .ilike('username', username)
            .single();

        if (fetchError || !user) {
            return res.status(401).json({ success: false, error: 'User account not found' });
        }

        // 2. Verify Password using bcrypt
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Incorrect password' });
        }

        // 3. Authenticate with Supabase Auth (GoTrue)
        const userEmail = `${username}@renachem.local`;
        let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password: password
        });

        // 4. AUTO-ACTIVATION: If user is not in Supabase Auth yet, create them now
        if (authError && (authError.status === 400 || authError.message.includes('Invalid login credentials'))) {
            console.log('User not in Auth system. Attempting auto-activation...');
            
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: userEmail,
                password: password,
                email_confirm: true,
                user_metadata: { username, role: user.role }
            });

            if (!createError) {
                // Try logging in again after creation
                const retry = await supabase.auth.signInWithPassword({
                    email: userEmail,
                    password: password
                });
                authData = retry.data;
            } else {
                console.error('Auto-activation failed:', createError.message);
            }
        }

        if (!authData || !authData.session) {
            return res.status(401).json({ success: false, error: 'Cloud session failed to initialize. Please contact admin.' });
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
        return res.status(500).json({ success: false, error: 'Server error: ' + error.message });
    }
};
