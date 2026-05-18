const { supabase } = require('./utils/supabase');
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
        const { data: users, error } = await supabase.from('users').select('*');
        return res.status(200).json({
            success: true,
            error: error ? error.message : null,
            count: users ? users.length : 0,
            users: users
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
