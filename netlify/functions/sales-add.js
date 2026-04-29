const { supabase } = require('./utils/supabase');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { saleObj, cartItems } = JSON.parse(event.body);

        // 1. Start Stock Deduction
        for (const item of cartItems) {
            const { data: med, error: medError } = await supabase
                .from('medicines')
                .select('stock, name')
                .eq('id', item.id)
                .single();

            if (medError || !med) throw new Error(`Medicine "${item.name}" not found.`);
            if (med.stock < item.qty) throw new Error(`Insufficient stock for "${med.name}". Available: ${med.stock}`);

            const { error: updateError } = await supabase
                .from('medicines')
                .update({ stock: med.stock - item.qty })
                .eq('id', item.id);

            if (updateError) throw updateError;
        }

        // 2. Insert Sale
        const { data: saleData, error: saleError } = await supabase
            .from('sales')
            .insert([{
                date: saleObj.date,
                date_time: saleObj.date_time,
                items_json: saleObj.items_json,
                total: saleObj.total,
                payment_mode: saleObj.payment_mode,
                customer_name: saleObj.customer_name,
                mpesa_code: saleObj.mpesa_code // Manual M-Pesa entry
            }])
            .select();

        if (saleError) throw saleError;
        const saleId = saleData[0].id;

        // 3. Record Credit if applicable
        if (saleObj.payment_mode === 'Credit') {
            const { error: creditError } = await supabase
                .from('credits')
                .insert([{
                    sale_id: saleId,
                    customer_name: saleObj.customer_name,
                    total_amount: saleObj.total,
                    balance: saleObj.total
                }]);
            if (creditError) throw creditError;
        }

        // 4. Clinical Record Sync
        if (saleObj.client_id && saleObj.client_type) {
            try {
                const table = saleObj.client_type === 'Patient' ? 'patients' : 'customers';
                const { data: client } = await supabase
                    .from(table)
                    .select('prescriptions, history')
                    .eq('id', saleObj.client_id)
                    .single();

                if (client) {
                    const datePrefix = `\n[${saleObj.date}] `;
                    const medSummary = cartItems.map(i => `${i.name || 'Unknown Item'} (${i.qty || 0})`).join(', ');
                    const newPresc = (client.prescriptions ? client.prescriptions + '\n' : '') + datePrefix + medSummary;
                    const newHistory = (client.history ? client.history + '\n' : '') + datePrefix + `Purchased: ${medSummary}`;

                    await supabase
                        .from(table)
                        .update({ prescriptions: newPresc, history: newHistory })
                        .eq('id', saleObj.client_id);
                }
            } catch (clinicalError) {
                console.error("Clinical Sync Failed:", clinicalError);
            }
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, saleId: saleId })
        };

    } catch (error) {
        console.error('Sales Add Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
