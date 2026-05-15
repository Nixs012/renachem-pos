const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    const { module, action, table } = req.query;

    try {
        // --- SUPPLIERS ---
        if (module === 'suppliers') {
            if (req.method === 'GET') {
                const { data, error } = await supabase.from('suppliers').select('*').order('name', { ascending: true });
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            if (req.method === 'POST') {
                const { id, name, contact, items } = req.body;
                const { data: result, error } = await supabase.from('suppliers').upsert([{ id, name, contact, items }]).select();
                if (error) throw error;
                return res.status(200).json({ success: true, data: result });
            }
        }

        // --- CLIENTS (Patients & Customers) ---
        if (module === 'clients') {
            if (req.method === 'GET') {
                const { data, error } = await supabase.from(table).select('*').order('name', { ascending: true });
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            if (req.method === 'POST') {
                const { id, name, age, gender, phone, diagnosis, prescriptions, history } = req.body;
                const payload = { id, name, diagnosis, prescriptions, history };
                if (table === 'patients') { payload.age = age; payload.gender = gender; } else { payload.phone = phone; }
                const { data: result, error } = await supabase.from(table).upsert([payload]).select();
                if (error) throw error;
                return res.status(200).json({ success: true, data: result });
            }
        }

        // --- PURCHASES ---
        if (module === 'purchases') {
            if (req.method === 'GET') {
                const { data, error } = await supabase.from('purchases').select('*').order('id', { ascending: false });
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            if (req.method === 'POST') {
                const { med_id, med_name, batch, qty, supplier, unit_price, total_cost, date } = req.body;
                const { error: purchaseErr } = await supabase.from('purchases').insert([{ med_name, batch, qty, date, supplier, unit_price, total_cost }]);
                if (purchaseErr) throw purchaseErr;
                const { data: med, error: fetchErr } = await supabase.from('medicines').select('stock').eq('id', med_id).single();
                if (fetchErr) throw fetchErr;
                const { error: stockErr } = await supabase.from('medicines').update({ stock: med.stock + parseInt(qty) }).eq('id', med_id);
                if (stockErr) throw stockErr;
                return res.status(200).json({ success: true });
            }
        }

        // --- SETTINGS & USERS ---
        if (module === 'settings') {
            if (req.method === 'GET') {
                if (action === 'getUsers') {
                    const { data, error } = await supabase.from('users').select('id, username, role, is_active, created_at');
                    if (error) throw error;
                    return res.status(200).json({ success: true, data });
                }
                const { data, error } = await supabase.from('settings').select('*');
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            if (req.method === 'POST') {
                if (action === 'createUser') {
                    const { username, password, role } = req.body;
                    const password_hash = await bcrypt.hash(password, 10);
                    const { error } = await supabase.from('users').insert([{ username, password_hash, role, is_active: 1 }]);
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }
            }
        }

        // --- AUDIT LOG ---
        if (module === 'audit') {
            if (req.method === 'GET') {
                const { data, error } = await supabase.from('audit_log').select('*').order('timestamp', { ascending: false }).limit(200);
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
        }

    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
