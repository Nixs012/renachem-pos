const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    const { module, action, table } = req.query;
    const method = req.method.toUpperCase();

    try {
        // --- SUPPLIERS ---
        if (module === 'suppliers') {
            if (method === 'GET') {
                const { data, error } = await supabase.from('suppliers').select('*').order('name', { ascending: true });
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            if (method === 'POST') {
                const { id, name, contact, contact_person, phone, email, address, items } = req.body;
                
                // Construct a consolidated contact string if detailed fields are provided
                const finalContact = contact || `${contact_person || ''} | ${phone || ''} | ${email || ''} | ${address || ''}`.trim();
                const finalId = id || `sup_${Date.now()}`;

                const { data: result, error } = await supabase.from('suppliers').upsert([{ 
                    id: finalId, 
                    name, 
                    contact: finalContact, 
                    items 
                }]).select();
                if (error) throw error;
                return res.status(200).json({ success: true, data: result });
            }
        }

        // --- CLIENTS (Patients & Customers) ---
        if (module === 'clients') {
            const finalTable = table || 'customers';
            if (method === 'GET') {
                const { data, error } = await supabase.from(finalTable).select('*').order('name', { ascending: true });
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            if (method === 'POST') {
                const { id, name, age, gender, phone, diagnosis, prescriptions, history } = req.body;
                const finalId = id || `cli_${Date.now()}`;
                const payload = { id: finalId, name, diagnosis, prescriptions, history };
                if (finalTable === 'patients') { payload.age = age; payload.gender = gender; } else { payload.phone = phone; }
                const { data: result, error } = await supabase.from(finalTable).upsert([payload]).select();
                if (error) throw error;
                return res.status(200).json({ success: true, data: result });
            }
        }

        // --- PURCHASES ---
        if (module === 'purchases') {
            if (method === 'GET') {
                const { data, error } = await supabase.from('purchases').select('*').order('id', { ascending: false });
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            if (method === 'POST') {
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
            if (method === 'GET') {
                if (action === 'getUsers') {
                    const { data, error } = await supabase.from('users').select('id, username, role, is_active, created_at');
                    if (error) throw error;
                    return res.status(200).json({ success: true, data });
                }
                const { data, error } = await supabase.from('settings').select('*');
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            if (method === 'POST') {
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
            if (method === 'GET') {
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
