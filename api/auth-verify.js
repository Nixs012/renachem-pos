const { supabase } = require('./utils/supabase');
const bcrypt = require('bcryptjs');
require('dotenv').config();

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { username, password, requireAdmin } = JSON.parse(event.body);

        if (!username || !password) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: 'Username and password required' })
            };
        }

        // Fetch user
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username);

        if (error) throw error;
        const user = users[0];

        if (!user || user.is_active !== 1) {
            return {
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: 'Invalid or inactive account' })
            };
        }

        if (requireAdmin && user.role !== 'Admin') {
            return {
                statusCode: 403,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: 'Administrator privileges required' })
            };
        }

        const isMatch = bcrypt.compareSync(password, user.password_hash);
        
        if (!isMatch) {
            return {
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: 'Incorrect password' })
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, message: 'Password verified' })
        };

    } catch (error) {
        console.error('Auth Verify Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Internal Server Error' })
        };
    }
};
