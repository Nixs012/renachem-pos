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
