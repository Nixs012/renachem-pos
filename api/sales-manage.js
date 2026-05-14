const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    if (req.method === 'GET') {
        const { data, error } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.status(200).json({ success: true, data });
    }

    if (req.method === 'POST') {
        const { date, date_time, items_json, total, payment_mode, customer_name, client_id, client_type } = req.body;

        try {
            // 1. Record the sale
            const { data: sale, error: saleErr } = await supabase.from('sales').insert([{
                date,
                date_time,
                items_json,
                total,
                payment_mode,
                customer_name,
                client_id,
                client_type
            }]).select().single();

            if (saleErr) throw saleErr;

            // 2. If it's a credit sale, create a credit record
            if (payment_mode === 'Credit' && client_id) {
                await supabase.from('patient_credits').insert([{
                    patient_id: client_id,
                    total_amount: total,
                    balance: total,
                    sale_id: sale.id
                }]);
            }

            return res.status(200).json({ success: true, sale_id: sale.id });

        } catch (e) {
            console.error('Sale Add Error:', e);
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
