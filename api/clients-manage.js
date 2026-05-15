const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    const { table } = req.query;
    if (!table) return res.status(400).json({ error: 'Table name required' });

    if (req.method === 'GET') {
        const { data, error } = await supabase.from(table).select('*').order('name', { ascending: true });
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.status(200).json({ success: true, data });
    }

    if (req.method === 'POST') {
        const { id, name, age, gender, phone, diagnosis, prescriptions, history } = req.body;
        
        const payload = { id, name, diagnosis, prescriptions, history };
        if (table === 'patients') {
            payload.age = age;
            payload.gender = gender;
        } else {
            payload.phone = phone;
        }

        const { data: result, error } = await supabase.from(table).upsert([payload]).select();
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.status(200).json({ success: true, data: result });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
