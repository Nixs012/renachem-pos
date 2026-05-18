const { supabase } = require('./utils/supabase');

exports.handler = async (event) => {
    try {
        if (event.httpMethod === 'GET') {
            const { creditId } = event.queryStringParameters || {};
            
            if (creditId) {
                const { data, error } = await supabase.from('credit_payments').select('*').eq('credit_id', creditId).order('payment_date', { ascending: false });
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
            }

            const { data, error } = await supabase.from('credits').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
        }

        if (event.httpMethod === 'POST') {
            const { action, ...data } = JSON.parse(event.body);

            if (action === 'addPayment') {
                const credit_id = data.creditId || data.credit_id;
                const amount = parseFloat(data.amount);
                const payment_mode = data.paymentMode || data.payment_mode;
                const received_by = data.receivedBy || data.received_by;

                // 1. Record Payment
                const { error: payError } = await supabase.from('credit_payments').insert([{ credit_id, amount, payment_mode, received_by }]);
                if (payError) throw payError;

                // 2. Update Credit Balance
                const { data: credit } = await supabase.from('credits').select('amount_paid, total_amount').eq('id', credit_id).single();
                const newPaid = (credit.amount_paid || 0) + amount;
                const newBalance = credit.total_amount - newPaid;
                const newStatus = newBalance <= 0 ? 'Paid' : 'Partial';

                const { error: updateError } = await supabase.from('credits').update({
                    amount_paid: newPaid,
                    balance: newBalance,
                    status: newStatus,
                    last_payment_date: new Date().toISOString()
                }).eq('id', credit_id);

                if (updateError) throw updateError;

                return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Payment recorded' }) };
            }
        }

        return { statusCode: 405, body: 'Method Not Allowed' };

    } catch (error) {
        console.error('Credits Error:', error);
        return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
