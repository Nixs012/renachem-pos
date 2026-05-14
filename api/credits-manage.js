const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    if (req.method === 'GET') {
        const { data, error } = await supabase.from('patient_credits').select('*').order('created_at', { ascending: false });
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.status(200).json({ success: true, data });
    }

    if (req.method === 'POST') {
        const { creditId, amount, paymentMode, receivedBy } = req.body;
        
        // 1. Get current credit
        const { data: credit, error: fetchErr } = await supabase.from('patient_credits').select('balance').eq('id', creditId).single();
        if (fetchErr) return res.status(500).json({ success: false, error: fetchErr.message });

        const newBalance = credit.balance - amount;

        // 2. Update balance
        const { error: updErr } = await supabase.from('patient_credits').update({ balance: newBalance }).eq('id', creditId);
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
