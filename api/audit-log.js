const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    if (req.method === 'GET') {
        const { data, error } = await supabase.from('audit_log').select('*').order('timestamp', { ascending: false }).limit(200);
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.status(200).json({ success: true, data });
    }

    if (req.method === 'POST') {
        const { action, module, details, username } = req.body;
        const { error } = await supabase.from('audit_log').insert([{ 
            action, module, details, username: username || user.username, timestamp: new Date().toISOString() 
        }]);
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
