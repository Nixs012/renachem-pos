const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { id } = req.body;
        const { error } = await supabase.from('medicines').delete().eq('id', id);

        if (error) throw error;
        return res.status(200).json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
};
