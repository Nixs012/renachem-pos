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
        const { date, date_time, items_json, total, payment_mode, customer_name, mpesa_code, client_id, client_type } = payload;
        
        try {
            const { data: sale, error: saleErr } = await supabase.from('sales').insert([{
                date, date_time, items_json, total, payment_mode, customer_name, mpesa_code
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

            // Update Patient or Customer Clinical Record / Active Prescriptions & History
            if (client_id && client_type) {
                const finalTable = client_type === 'Patient' ? 'patients' : 'customers';
                const { data: client, error: clientFetchErr } = await supabase.from(finalTable).select('prescriptions, history').eq('id', client_id).single();
                if (!clientFetchErr && client) {
                    const newItems = itemsToProcess.map(item => `${item.name} (Qty: ${item.qty})`).join(', ');
                    
                    // Auto-update Active Prescriptions
                    const updatedPresc = client.prescriptions ? `${client.prescriptions}\n${newItems}` : newItems;

                    // Auto-update Clinical / Purchase History
                    const historyEntry = `[${new Date().toLocaleDateString()}] POS Sale: ${newItems} | Total: KES ${total} | Paid via: ${payment_mode}`;
                    const updatedHist = client.history ? `${client.history}\n${historyEntry}` : historyEntry;

                    await supabase.from(finalTable).update({ prescriptions: updatedPresc, history: updatedHist }).eq('id', client_id);
                }
            }

            return res.status(200).json({ success: true, sale_id: sale.id });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
