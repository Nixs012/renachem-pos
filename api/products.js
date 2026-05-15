const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    const { action } = req.query;

    try {
        if (req.method === 'GET') {
            const { data, error } = await supabase.from('medicines').select('*').order('name', { ascending: true });
            if (error) throw error;
            return res.status(200).json({ success: true, data });
        }

        if (req.method === 'POST') {
            const { id, name, supplier, batch, expiry, stock, reorder_level, price, cost_price, barcode } = req.body;
            
            if (action === 'add') {
                const { data, error } = await supabase.from('medicines').insert([{
                    id, name, supplier, batch, expiry, stock, reorder_level, price, cost_price, barcode
                }]).select();
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            
            if (action === 'update') {
                const { data, error } = await supabase.from('medicines').update({
                    name, supplier, batch, expiry, stock, reorder_level, price, cost_price, barcode
                }).eq('id', id).select();
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            
            if (action === 'delete') {
                const { error } = await supabase.from('medicines').delete().eq('id', id);
                if (error) throw error;
                return res.status(200).json({ success: true });
            }
        }
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
