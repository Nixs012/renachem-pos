const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    const { action } = req.query;

    if (req.method === 'GET') {
        if (action === 'getUsers') {
            const { data, error } = await supabase.from('users').select('id, username, role, is_active, created_at');
            if (error) return res.status(500).json({ success: false, error: error.message });
            return res.status(200).json({ success: true, data });
        }
        if (action === 'getSettings') {
            const { data, error } = await supabase.from('settings').select('*');
            if (error) return res.status(500).json({ success: false, error: error.message });
            return res.status(200).json({ success: true, data });
        }
    }

    if (req.method === 'POST') {
        const { username, password, role, is_active } = req.body;
        
        if (action === 'createUser') {
            const password_hash = await bcrypt.hash(password, 10);
            const { error } = await supabase.from('users').insert([{ username, password_hash, role, is_active: 1 }]);
            if (error) return res.status(500).json({ success: false, error: error.message });
            return res.status(200).json({ success: true });
        }
        
        if (action === 'updateUser') {
            const { userId, role, is_active } = req.body;
            const { error } = await supabase.from('users').update({ role, is_active }).eq('id', userId);
            if (error) return res.status(500).json({ success: false, error: error.message });
            return res.status(200).json({ success: true });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
