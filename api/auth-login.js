const { supabase } = require('./utils/supabase');
const bcrypt = require('bcryptjs');
const { logAction } = require('./utils/auth');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { username, password } = JSON.parse(event.body);

        if (!username || !password) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: 'Username and password required' })
            };
        }

        // Fetch user from Supabase
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username);

        if (error) throw error;

        const user = users[0];

        if (!user) {
            return {
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: 'Invalid username or password' })
            };
        }

        // Check if active
        if (user.is_active !== 1) {
            return {
                statusCode: 403,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: 'Account is deactivated' })
            };
        }

        // Check lock status
        const { data: locks } = await supabase
            .from('login_attempts')
            .select('*')
            .eq('username', username)
            .single();

        if (locks && locks.locked_until && new Date(locks.locked_until) > new Date()) {
            const minutesLeft = Math.ceil((new Date(locks.locked_until) - new Date()) / 60000);
            return {
                statusCode: 403,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: `Account locked. Try again in ${minutesLeft} minutes.` })
            };
        }

        // Verify password
        const isMatch = bcrypt.compareSync(password, user.password_hash);

        if (!isMatch) {
            // Increment failed attempts
            const attempts = locks ? locks.attempts + 1 : 1;
            let locked_until = null;
            
            if (attempts >= 5) {
                locked_until = new Date(Date.now() + 15 * 60000).toISOString(); // Lock for 15 mins
            }

            await supabase.from('login_attempts').upsert({ 
                username, 
                attempts, 
                locked_until 
            }, { onConflict: 'username' });

            return {
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: 'Invalid username or password' })
            };
        }

        // Success - reset attempts
        await supabase.from('login_attempts').delete().eq('username', username);

        // Generate Session Token (for Web Auth)
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

        await supabase.from('sessions').insert([{
            user_id: user.id,
            token,
            expires_at
        }]);

        // Log the Login Action
        await logAction({ id: user.id, username: user.username }, 'USER_LOGIN', 'AUTH', `User logged in from web.`);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    is_temp_password: user.is_temp_password
                }
            })
        };

    } catch (error) {
        console.error('Auth Login Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Internal Server Error' })
        };
    }
};
