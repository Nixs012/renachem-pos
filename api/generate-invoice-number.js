const { supabase } = require('./utils/supabase');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const settingKey = 'invoice_counter_' + today;

        // Get today's counter
        const { data: setting, error: selectErr } = await supabase
            .from('settings')
            .select('value')
            .eq('key', settingKey)
            .maybeSingle();

        if (selectErr) throw selectErr;

        let counter = 1;
        if (setting) {
            counter = parseInt(setting.value) + 1;
        }

        // Save updated counter
        const { error: upsertErr } = await supabase
            .from('settings')
            .upsert({ 
                key: settingKey, 
                value: String(counter), 
                updated_at: new Date().toISOString() 
            });

        if (upsertErr) throw upsertErr;

        const invoiceNumber = `INV-${today}-${String(counter).padStart(4, '0')}`;

        res.status(200).json({ success: true, invoiceNumber });
    } catch (error) {
        console.error('Invoice number generation failed:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
