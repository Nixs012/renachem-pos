const { supabase } = require('./utils/supabase');
const bcrypt = require('bcryptjs');
const { verifySession, unauthorizedResponse } = require('./utils/auth');

exports.handler = async (event) => {
    // 1. Verify Authentication
    const user = await verifySession(event);
    if (!user) return unauthorizedResponse();

    // 2. Role-Based Access Control (Most actions here require Admin)
    const isAdminAction = (event.httpMethod === 'POST' || (event.queryStringParameters && event.queryStringParameters.action === 'getUsers'));
    if (isAdminAction && user.role !== 'Admin') {
        return {
            statusCode: 403,
            body: JSON.stringify({ success: false, error: 'Forbidden: Admin access required.' })
        };
    }

    try {
        if (event.httpMethod === 'GET') {
            const { action, key } = event.queryStringParameters || {};

            if (action === 'getUsers') {
                const { data, error } = await supabase.from('users').select('*').order('username', { ascending: true });
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
            }

            if (action === 'getSettings') {
                const { data, error } = await supabase.from('settings').select('*');
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
            }

            if (key) {
                const { data, error } = await supabase.from('settings').select('value').eq('key', key).single();
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true, value: data?.value }) };
            }
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { action, ...data } = body;

            if (action === 'updateSetting') {
                const { error } = await supabase.from('settings').upsert([{ key: data.key, value: data.value }], { onConflict: 'key' });
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }

            if (action === 'createUser') {
                const salt = bcrypt.genSaltSync(10);
                const password_hash = bcrypt.hashSync(data.password, salt);
                const { error } = await supabase.from('users').insert([{ 
                    username: data.username, 
                    password_hash, 
                    role: data.role,
                    is_active: 1,
                    is_temp_password: 1
                }]);
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }

            if (action === 'updateUserRole') {
                const { error } = await supabase.from('users').update({ role: data.role }).eq('id', data.id);
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }

            if (action === 'deactivateUser' || action === 'reactivateUser') {
                const { error } = await supabase.from('users').update({ is_active: action === 'reactivateUser' ? 1 : 0 }).eq('id', data.id);
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }

            if (action === 'deleteUser') {
                const { error } = await supabase.from('users').delete().eq('id', data.id);
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }
        }

        return { statusCode: 405, body: 'Method Not Allowed' };

    } catch (error) {
        console.error('Settings/User Error:', error);
        return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
