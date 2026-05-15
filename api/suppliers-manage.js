const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    if (req.method === 'GET') {
        const { data, error } = await supabase.from('suppliers').select('*').order('name', { ascending: true });
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.status(200).json({ success: true, data });
    }

    if (req.method === 'POST') {
        const { id, name, contact, items } = req.body;
        const { data: result, error } = await supabase.from('suppliers').upsert([{ id, name, contact, items }]).select();
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.status(200).json({ success: true, data: result });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
