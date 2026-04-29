const { supabase } = require('./utils/supabase');

exports.handler = async (event) => {
    try {
        if (event.httpMethod === 'GET') {
            const { data, error } = await supabase.from('purchases').select('*').order('date', { ascending: false });
            if (error) throw error;
            return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { action, ...d } = body;

            if (action === 'add' || action === 'recordStockIntake') {
                // 1. Find or Create Medicine
                let targetMedId = d.med_id;
                let med = null;

                if (targetMedId) {
                    const { data: m } = await supabase.from('medicines').select('*').eq('id', targetMedId).single();
                    med = m;
                } else {
                    const { data: m } = await supabase.from('medicines').select('*').ilike('name', d.med_name).maybeSingle();
                    med = m;
                }

                if (med) {
                    targetMedId = med.id;
                    // UPDATE EXISTING
                    const { error: updateError } = await supabase.from('medicines').update({
                        stock: (med.stock || 0) + (d.qty || 0),
                        price: d.selling_price || med.price,
                        cost_price: d.buying_price || med.cost_price,
                        expiry: d.expiry || med.expiry,
                        batch: d.batch || med.batch,
                        barcode: d.barcode || med.barcode,
                        supplier: d.supplier || med.supplier
                    }).eq('id', targetMedId);
                    if (updateError) throw updateError;
                } else {
                    // CREATE NEW
                    targetMedId = d.med_id || (Date.now().toString() + Math.random().toString(36).substr(2, 4));
                    const { error: insertError } = await supabase.from('medicines').insert([{
                        id: targetMedId,
                        name: d.med_name,
                        supplier: d.supplier || '',
                        batch: d.batch || '',
                        expiry: d.expiry || '',
                        stock: d.qty || 0,
                        reorder_level: 10,
                        price: d.selling_price || 0,
                        cost_price: d.buying_price || 0,
                        barcode: d.barcode || ''
                    }]);
                    if (insertError) throw insertError;
                }

                // 2. Record the Purchase (Only specific columns)
                const purchaseEntry = {
                    med_name: d.med_name,
                    batch: d.batch || '',
                    qty: d.qty || 0,
                    date: new Date().toISOString().slice(0, 10),
                    supplier: d.supplier || '',
                    unit_price: d.buying_price || 0,
                    total_cost: (d.qty * (d.buying_price || 0))
                };

                const { error: purError } = await supabase.from('purchases').insert([purchaseEntry]);
                if (purError) throw purError;

                return { statusCode: 200, body: JSON.stringify({ success: true, med_id: targetMedId }) };
            }
        }

        return { statusCode: 405, body: 'Method Not Allowed' };

    } catch (error) {
        console.error('Purchases Error:', error);
        return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
