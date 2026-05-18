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
        const { saleObj, cartItems } = req.body;
        const payload = saleObj || req.body;
        const { date, date_time, items_json, total, payment_mode, customer_name } = payload;
        
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

            // Deduct from inventory
            const itemsToProcess = cartItems || (items_json ? JSON.parse(items_json) : []);
            for (let item of itemsToProcess) {
                if (!item.id || !item.qty) continue;
                const { data: medData } = await supabase.from('medicines').select('stock').eq('id', item.id).single();
                if (medData) {
                    const newStock = Math.max(0, (parseInt(medData.stock) || 0) - parseInt(item.qty));
                    await supabase.from('medicines').update({ stock: newStock }).eq('id', item.id);
                }
            }

            return res.status(200).json({ success: true, sale_id: sale.id });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
