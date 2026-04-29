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
            const { action, ...purchaseData } = body;

            if (action === 'add' || action === 'recordStockIntake') {
                // 1. Record Purchase
                const { data, error } = await supabase.from('purchases').insert([purchaseData]).select();
                if (error) throw error;

                // 2. Update Medicine Stock
                if (purchaseData.medicine_id && purchaseData.quantity) {
                    const { data: med } = await supabase.from('medicines').select('stock').eq('id', purchaseData.medicine_id).single();
                    if (med) {
                        await supabase.from('medicines').update({ stock: med.stock + purchaseData.quantity }).eq('id', purchaseData.medicine_id);
                    }
                }

                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }
        }

        return { statusCode: 405, body: 'Method Not Allowed' };

    } catch (error) {
        console.error('Purchases Error:', error);
        return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
