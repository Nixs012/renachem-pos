const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    if (req.method === 'GET') {
        const { data, error } = await supabase.from('medicine_returns').select('*').order('created_at', { ascending: false });
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.status(200).json({ success: true, data });
    }

    if (req.method === 'POST') {
        const { saleId, medicineId, itemId, medicineName, qty, refund, refundAmount, reason, processedBy, saleDate } = req.body;
        const totalRefund = refund || refundAmount || 0;
        const finalMedId = medicineId || itemId;

        try {
            // 1. Record the return
            const { error: returnErr } = await supabase.from('medicine_returns').insert([{
                sale_id: saleId,
                medicine_id: finalMedId,
                medicine_name: medicineName || 'Unknown Medicine',
                qty,
                total_refund: totalRefund,
                reason,
                processed_by: processedBy,
                sale_date: saleDate
            }]);
            if (returnErr) throw returnErr;

            // 2. Increment stock back
            const { data: meds, error: fetchErr } = await supabase.from('medicines').select('stock').eq('id', finalMedId);
            if (fetchErr) throw fetchErr;

            if (meds && meds.length > 0) {
                const currentStock = meds[0].stock;
                const { error: stockErr } = await supabase.from('medicines').update({ stock: currentStock + parseInt(qty) }).eq('id', finalMedId);
                if (stockErr) throw stockErr;
            }

            // 3. Log Audit
            await supabase.from('audit_log').insert([{
                action: 'MEDICINE_RETURNED',
                details: `Returned ${qty} units of ${medicineName}. Refund: KES ${refund}`,
                user: processedBy
            }]);

            return res.status(200).json({ success: true });

        } catch (e) {
            console.error('Return Error:', e);
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
