const { supabase } = require('./utils/supabase');

exports.handler = async (event) => {
    try {
        if (event.httpMethod === 'GET') {
            const { data, error } = await supabase
                .from('medicine_returns')
                .select(`
                    *,
                    medicine_name:medicines(name),
                    sale_info:sales(date, customer_name)
                `)
                .order('created_at', { ascending: false });
            
            if (error) throw error;

            // Flatten data to match the Electron DB output format
            const formattedData = data.map(r => ({
                ...r,
                medicine_name: r.medicine_name?.name || 'Unknown Item',
                sale_date: r.sale_info?.date || 'N/A',
                customer_name: r.sale_info?.customer_name || 'Walk-in'
            }));

            return { statusCode: 200, body: JSON.stringify({ success: true, data: formattedData }) };
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { action, saleId, itemId, qty, refundAmount, reason, processedBy } = body;

            if (action === 'record') {
                // 1. Get current stock
                const { data: med, error: medError } = await supabase
                    .from('medicines')
                    .select('stock')
                    .eq('id', itemId)
                    .single();
                
                if (medError) throw medError;

                // 2. Increase stock
                const { error: stockError } = await supabase
                    .from('medicines')
                    .update({ stock: med.stock + qty })
                    .eq('id', itemId);
                
                if (stockError) throw stockError;

                // 3. Insert return record
                const { error: returnError } = await supabase
                    .from('medicine_returns')
                    .insert([{
                        sale_id: saleId,
                        medicine_id: itemId,
                        qty: qty,
                        total_refund: refundAmount,
                        reason: reason,
                        processed_by: processedBy
                    }]);
                
                if (returnError) throw returnError;

                // 4. Log to audit trail
                await supabase.from('audit_log').insert([{
                    action: 'MEDICINE_RETURNED',
                    module: 'INVENTORY',
                    details: `Return processed for Sale #${saleId}. Qty: ${qty}`,
                    username: processedBy
                }]);

                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }
        }

        return { statusCode: 405, body: 'Method Not Allowed' };

    } catch (error) {
        console.error('Returns Manager Error:', error);
        return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
