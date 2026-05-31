const { supabase } = require('./_utils/supabase');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const action = req.query.action || req.body.action;

    try {
        if (action === 'get-app-version') {
            return res.status(200).json({
                success: true,
                version: process.env.APP_VERSION || '1.0.0',
                releaseNotes: process.env.RELEASE_NOTES || 'System running latest version',
                updatedAt: process.env.LAST_UPDATED || new Date().toISOString()
            });
        }

        if (action === 'generate-invoice-number') {
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const settingKey = 'invoice_counter_' + today;
            const { data: setting, error: selectErr } = await supabase.from('settings').select('value').eq('key', settingKey).maybeSingle();
            if (selectErr) throw selectErr;
            let counter = 1;
            if (setting) counter = parseInt(setting.value) + 1;
            const { error: upsertErr } = await supabase.from('settings').upsert({ key: settingKey, value: String(counter), updated_at: new Date().toISOString() });
            if (upsertErr) throw upsertErr;
            const invoiceNumber = `INV-${today}-${String(counter).padStart(4, '0')}`;
            return res.status(200).json({ success: true, invoiceNumber });
        }

        if (action === 'save-sale') {
            const payload = req.body;
            // Clean up the body to remove any 'action' property before inserting
            const insertPayload = { ...payload };
            delete insertPayload.action;
            
            const { data, error } = await supabase.from('sales').insert([insertPayload]).select().single();
            if (error) throw error;
            return res.status(200).json({ success: true, data });
        }

        if (action === 'update-medicine-stock') {
            const { id, quantityDeducted } = req.body;
            if (!id || typeof quantityDeducted !== 'number') {
                return res.status(400).json({ success: false, message: 'Invalid payload' });
            }
            const { data: currentMedicine, error: fetchError } = await supabase.from('medicines').select('stock').eq('id', id).single();
            if (fetchError) throw fetchError;
            const currentStock = currentMedicine.stock || 0;
            let newStock = currentStock - quantityDeducted;
            if (newStock < 0) newStock = 0;
            const { data: updatedMedicine, error: updateError } = await supabase.from('medicines').update({ stock: newStock }).eq('id', id).select().single();
            if (updateError) throw updateError;
            return res.status(200).json({ success: true, newStock: updatedMedicine.stock });
        }

        if (action === 'get-invoices') {
            const { dateFrom, dateTo, search } = req.body || {};
            let query = supabase.from('sales').select('*');
            if (dateFrom) query = query.gte('date', dateFrom);
            if (dateTo) query = query.lte('date', dateTo);
            const { data: sales, error } = await query.order('created_at', { ascending: false }).limit(100);
            if (error) throw error;
            let filteredSales = sales || [];
            if (search) {
                const q = search.toLowerCase().trim();
                filteredSales = filteredSales.filter(s => 
                    (s.invoice_number || '').toLowerCase().includes(q) ||
                    (s.customer_name || '').toLowerCase().includes(q) ||
                    (s.cashier_name || '').toLowerCase().includes(q) ||
                    (s.payment_mode || '').toLowerCase().includes(q)
                );
            }
            return res.status(200).json({ success: true, data: filteredSales });
        }

        if (action === 'get-medicine-sales-stats') {
            const { dateFrom, dateTo } = req.body || {};
            let query = supabase.from('sales').select('items_json, total, date');
            if (dateFrom) query = query.gte('date', dateFrom);
            if (dateTo) query = query.lte('date', dateTo);
            const { data: sales, error } = await query;
            if (error) throw error;
            const medicineStats = {};
            for (const sale of sales) {
                let items = [];
                try { items = JSON.parse(sale.items_json); } catch { continue; }
                for (const item of items) {
                    const name = item.name || item;
                    if (!medicineStats[name]) medicineStats[name] = { name, totalQty: 0, totalRevenue: 0, saleCount: 0 };
                    medicineStats[name].totalQty += (item.qty || 1);
                    medicineStats[name].totalRevenue += (item.subtotal || item.price || 0);
                    medicineStats[name].saleCount += 1;
                }
            }
            const sorted = Object.values(medicineStats).sort((a, b) => b.totalQty - a.totalQty).slice(0, 15);
            return res.status(200).json({ success: true, stats: sorted });
        }

        return res.status(400).json({ success: false, message: 'Invalid action' });
    } catch (error) {
        console.error('[pos.js] Error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal error' });
    }
};
