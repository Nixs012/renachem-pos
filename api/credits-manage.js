const { supabase } = require('./_utils/supabase');
const { verifySession, unauthorizedResponse } = require('./_utils/auth');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

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
        const data = req.body || {};
        const creditId = data.creditId || data.credit_id;
        const amount = parseFloat(data.amount);
        const paymentMode = data.paymentMode || data.payment_mode;
        const receivedBy = data.receivedBy || data.received_by;
        
        // 1. Get current credit
        const { data: credit, error: fetchErr } = await supabase.from('credits').select('amount_paid, total_amount').eq('id', creditId).single();
        if (fetchErr) return res.status(500).json({ success: false, error: fetchErr.message });

        const newPaid = (credit.amount_paid || 0) + amount;
        const newBalance = credit.total_amount - newPaid;
        let status = 'Pending';
        if (newBalance <= 0) {
            status = 'Paid';
        } else if (newBalance < credit.total_amount) {
            status = 'Partial';
        }

        // 2. Update balance, status, amount_paid, and last_payment_date
        const { error: updErr } = await supabase.from('credits').update({
            amount_paid: newPaid,
            balance: newBalance,
            status,
            last_payment_date: new Date().toISOString()
        }).eq('id', creditId);
        
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
