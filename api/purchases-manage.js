const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    if (req.method === 'GET') {
        const { data, error } = await supabase.from('purchases').select('*').order('id', { ascending: false });
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.status(200).json({ success: true, data });
    }

    if (req.method === 'POST') {
        const { med_id, med_name, batch, qty, supplier, unit_price, total_cost, date } = req.body;

        try {
            // 1. Log the purchase
            const { error: purchaseErr } = await supabase.from('purchases').insert([{
                med_name, batch, qty, date, supplier, unit_price, total_cost
            }]);
            if (purchaseErr) throw purchaseErr;

            // 2. Update stock in medicines table
            const { data: med, error: fetchErr } = await supabase.from('medicines').select('stock').eq('id', med_id).single();
            if (fetchErr) throw fetchErr;

            const { error: stockErr } = await supabase.from('medicines').update({ stock: med.stock + parseInt(qty) }).eq('id', med_id);
            if (stockErr) throw stockErr;

            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
