const { supabase } = require('./_utils/supabase');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { username, password, role } = req.body;
        if (!username || !password || !role) {
            return res.status(400).json({ success: false, error: 'Username, password, and role are required' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const { error } = await supabase.from('users').insert([{ username, password_hash, role, is_active: 1 }]);

        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.message,
                details: error.details,
                hint: error.hint
            });
        }

        // Verification query to confirm user was saved
        const { data: saved, error: checkErr } = await supabase
            .from('users')
            .select('id, username, role')
            .eq('username', username)
            .single();
        console.log('User saved verification:', saved, checkErr);

        return res.status(200).json({ success: true, data: saved });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
};
