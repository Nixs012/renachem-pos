const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    let { module, action, table } = req.query;
    const body = req.body || {};
    
    // Robust detection: Check body if missing in query
    if (!module) module = body.module;
    if (!action) action = body.action;
    if (!table) table = body.table;

    // Automatic fallback based on known endpoints
    if (!module) {
        if (action === 'add' || action === 'update' || table === 'customers' || table === 'patients') module = 'clients';
        if (table === 'suppliers') module = 'suppliers';
    }

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
                const { id, name, age, gender, phone, email, diagnosis, prescriptions, history } = req.body;
                const finalId = id || `cli_${Date.now()}`;
                
                // Build specific payload based on table
                let payload = { id: finalId, name, prescriptions, history };
                
                if (finalTable === 'patients') {
                    payload.age = age;
                    payload.gender = gender;
                    payload.diagnosis = diagnosis; // Patients have diagnosis
                } else {
                    payload.phone = phone;
                    payload.email = email; // Customers have phone/email
                }
                
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
                const { med_id, med_name, batch, qty, supplier, unit_price, total_cost, date, selling_price, expiry, barcode } = req.body;
                
                // 1. Record the purchase receipt
                const { error: purchaseErr } = await supabase.from('purchases').insert([{ med_name, batch, qty, date, supplier, unit_price, total_cost }]);
                if (purchaseErr) throw purchaseErr;
                
                // 2. Sync with Inventory (Upsert Medicine)
                // Use med_id if available, otherwise use med_name as ID or generate one
                const finalMedId = med_id || `med_${Date.now()}`;
                
                // Get current stock to add to it
                const { data: meds } = await supabase.from('medicines').select('stock').eq('id', finalMedId);
                const currentStock = (meds && meds.length > 0) ? meds[0].stock : 0;

                const { error: syncErr } = await supabase.from('medicines').upsert([{
                    id: finalMedId,
                    name: med_name,
                    stock: currentStock + parseInt(qty),
                    price: parseFloat(selling_price) || 0,
                    cost_price: parseFloat(unit_price) || 0,
                    batch: batch,
                    expiry: expiry,
                    supplier: supplier,
                    barcode: barcode
                }]);

                if (syncErr) throw syncErr;
                
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
