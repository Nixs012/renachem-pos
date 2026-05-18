const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ success: false, error: 'Password required' });
        }

        // Fetch current user from DB to get their hash
        const { data: users, error: fetchErr } = await supabase.from('users').select('password_hash').eq('id', user.id || 0);
        
        if (fetchErr || !users || users.length === 0) {
            return res.status(200).json({ success: false, error: 'User not found' });
        }

        const dbUser = users[0];
        const isValid = await bcrypt.compare(password, dbUser.password_hash);
        return res.status(200).json({ success: isValid });

    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
};
