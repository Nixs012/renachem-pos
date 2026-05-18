const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    if (req.method === 'GET') {
        const { creditId } = req.query;
        if (creditId) {
            const { data, error } = await supabase.from('credit_payments').select('*').eq('credit_id', creditId).order('payment_date', { ascending: false });
            if (error) return res.status(500).json({ success: false, error: error.message });
            return res.status(200).json({ success: true, data });
        } else {
            // Auto-repair any credits that have balance <= 0 but status != 'Paid'
            await supabase.from('credits').update({ status: 'Paid' }).lte('balance', 0).neq('status', 'Paid');
            
            const { data, error } = await supabase.from('credits').select('*').order('created_at', { ascending: false });
            if (error) return res.status(500).json({ success: false, error: error.message });
            return res.status(200).json({ success: true, data });
        }
    }

    if (req.method === 'POST') {
        const { creditId, amount, paymentMode, receivedBy } = req.body;
        
        // 1. Get current credit
        const { data: credit, error: fetchErr } = await supabase.from('credits').select('balance, total_amount').eq('id', creditId).single();
        if (fetchErr) return res.status(500).json({ success: false, error: fetchErr.message });

        const newBalance = Math.max(0, credit.balance - amount);
        let status = 'Pending';
        if (newBalance <= 0) {
            status = 'Paid';
        } else if (newBalance < credit.total_amount) {
            status = 'Partial';
        }

        // 2. Update balance and status
        const { error: updErr } = await supabase.from('credits').update({ balance: newBalance, status }).eq('id', creditId);
        if (updErr) return res.status(500).json({ success: false, error: updErr.message });

        // 3. Log payment
        const { error: logErr } = await supabase.from('credit_payments').insert([{
            credit_id: creditId,
            amount,
            payment_mode: paymentMode,
            received_by: receivedBy
        }]);

        if (logErr) return res.status(500).json({ success: false, error: logErr.message });

        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
