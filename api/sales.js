const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    if (req.method === 'GET') {
        const { data, error } = await supabase.from('sales').select('*').order('id', { ascending: false });
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.status(200).json({ success: true, data });
    }

    if (req.method === 'POST') {
        const { date, date_time, items_json, total, payment_mode, customer_name } = req.body;
        try {
            const { data: sale, error: saleErr } = await supabase.from('sales').insert([{
                date, date_time, items_json, total, payment_mode, customer_name
            }]).select().single();

            if (saleErr) throw saleErr;

            if (payment_mode === 'Credit') {
                await supabase.from('credits').insert([{
                    customer_name: customer_name,
                    total_amount: total,
                    balance: total,
                    sale_id: sale.id,
                    status: 'Pending'
                }]);
            }

            return res.status(200).json({ success: true, sale_id: sale.id });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
