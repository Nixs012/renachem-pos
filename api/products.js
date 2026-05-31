const { supabase } = require('./_utils/supabase');
const { verifySession, unauthorizedResponse } = require('./_utils/auth');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

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
                const finalId = id || ('med_' + Date.now().toString() + Math.random().toString(36).substr(2, 5));
                const { data, error } = await supabase.from('medicines').insert([{
                    id: finalId, name, supplier, batch, expiry, stock, reorder_level, price, cost_price, barcode
                }]).select();
                if (error) throw error;

                // Auto-create purchase record in purchases if stock > 0
                if (stock && parseInt(stock) > 0) {
                    await supabase.from('purchases').insert([{
                        med_name: name,
                        batch: batch || 'N/A',
                        qty: parseInt(stock),
                        date: new Date().toISOString().slice(0, 10),
                        supplier: supplier || 'Initial Stock',
                        unit_price: parseFloat(cost_price) || 0,
                        total_cost: (parseFloat(cost_price) || 0) * parseInt(stock)
                    }]);
                }

                return res.status(200).json({ success: true, data });
            }
            
            if (action === 'update') {
                const { data: oldMed } = await supabase.from('medicines').select('name, batch').eq('id', id).single();

                const { data, error } = await supabase.from('medicines').update({
                    name, supplier, batch, expiry, stock, reorder_level, price, cost_price, barcode
                }).eq('id', id).select();
                if (error) throw error;

                if (oldMed) {
                    const oldBatchStr = oldMed.batch || 'N/A';
                    const { data: matchedPurchases } = await supabase.from('purchases').select('id, qty').eq('med_name', oldMed.name).eq('batch', oldBatchStr);
                    if (matchedPurchases) {
                        for (let p of matchedPurchases) {
                            const newTotal = p.qty * (parseFloat(cost_price) || 0);
                            await supabase.from('purchases').update({
                                med_name: name,
                                batch: batch || 'N/A',
                                supplier: supplier || 'Initial Stock',
                                unit_price: parseFloat(cost_price) || 0,
                                total_cost: newTotal
                            }).eq('id', p.id);
                        }
                    }
                }

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
