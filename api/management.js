const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    let { module: queryModule, action, table } = req.query;
    const body = req.body || {};
    
    // Robust detection: Check body if missing in query
    let activeModule = queryModule || body.module;
    let activeAction = action || body.action;
    let activeTable = table || body.table;

    // Automatic fallback based on known endpoints
    if (!activeModule) {
        if (activeAction === 'add' || activeAction === 'update' || activeTable === 'customers' || activeTable === 'patients') activeModule = 'clients';
        if (activeTable === 'suppliers') activeModule = 'suppliers';
    }

    const method = req.method.toUpperCase();

    try {
        // --- SUPPLIERS ---
        if (activeModule === 'suppliers') {
            if (method === 'GET') {
                const { data, error } = await supabase.from('suppliers').select('*').order('name', { ascending: true });
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            if (method === 'POST') {
                const { id, name, contact, contact_person, phone, email, address, items } = req.body;
                
                if (activeAction === 'delete') {
                    if (!id) return res.status(400).json({ success: false, error: 'Supplier ID is required for deletion' });
                    const { error } = await supabase.from('suppliers').delete().eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true, message: 'Deleted successfully' });
                }

                // Construct a consolidated contact string if detailed fields are provided
                const finalContact = contact || `${contact_person || ''} | ${phone || ''} | ${email || ''} | ${address || ''}`.trim();
                const finalId = id || `sup_${Date.now()}`;

                const { data: result, error } = await supabase.from('suppliers').upsert([{ 
                    id: finalId, 
                    name, 
                    contact: finalContact, 
                    contact_person,
                    phone,
                    email,
                    address,
                    items 
                }]).select();
                if (error) throw error;
                return res.status(200).json({ success: true, data: result });
            }
        }

        // --- CLIENTS (Patients & Customers) ---
        if (activeModule === 'clients') {
            const finalTable = activeTable || 'customers';
            if (method === 'GET') {
                const { data, error } = await supabase.from(finalTable).select('*').order('name', { ascending: true });
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            if (method === 'POST') {
                const { action: postAction, id, name, age, gender, phone, email, diagnosis, prescriptions, history } = req.body;
                
                const finalAction = postAction || activeAction;

                if (finalAction === 'delete') {
                    if (!id) return res.status(400).json({ success: false, error: 'ID is required for deletion' });
                    const { error } = await supabase.from(finalTable).delete().eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true, message: 'Deleted successfully' });
                }

                // Construction for add or update/upsert
                const finalId = id || (finalTable === 'patients' ? 'P-' : 'C-') + Date.now();
                
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
        if (activeModule === 'purchases') {
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
        if (activeModule === 'settings') {
            if (method === 'GET') {
                if (activeAction === 'getUsers') {
                    const { data, error } = await supabase.from('users').select('id, username, role, is_active, created_at');
                    if (error) throw error;
                    return res.status(200).json({ success: true, data });
                }
                const { data, error } = await supabase.from('settings').select('*');
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            if (method === 'POST') {
                if (activeAction === 'createUser') {
                    const { username, password, role } = req.body;
                    const password_hash = await bcrypt.hash(password, 10);
                    const { error } = await supabase.from('users').insert([{ username, password_hash, role, is_active: 1 }]);
                    
                    if (error) {
                        return res.status(400).json({ 
                            success: false, 
                            message: error.message,
                            details: error.details,
                            hint: error.hint
                        });
                    }

                    // Verification query to confirm user was saved
                    const { data: saved, error: checkErr } = await supabase
                        .from('users')
                        .select('id, username, role')
                        .eq('username', username)
                        .single();
                    console.log('User saved verification:', saved, checkErr);

                    return res.status(200).json({ success: true });
                }
                if (activeAction === 'updateUserRole') {
                    const { id, role } = req.body;
                    const { error } = await supabase.from('users').update({ role }).eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }
                if (activeAction === 'resetUserPassword') {
                    const { id, password } = req.body;
                    const password_hash = await bcrypt.hash(password, 10);
                    const { error } = await supabase.from('users').update({ password_hash }).eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }
                if (activeAction === 'deactivateUser') {
                    const { id } = req.body;
                    const { error } = await supabase.from('users').update({ is_active: 0 }).eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }
                if (activeAction === 'reactivateUser') {
                    const { id } = req.body;
                    const { error } = await supabase.from('users').update({ is_active: 1 }).eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }
                if (activeAction === 'deleteUser') {
                    const { id } = req.body;
                    const { error } = await supabase.from('users').delete().eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }
                if (activeAction === 'updateSetting') {
                    const { key, value } = req.body;
                    const { error } = await supabase.from('settings').upsert([{ key, value }]);
                    if (error) throw error;
                    return res.status(200).json({ success: true });
                }
            }
        }

        // --- AUDIT LOG ---
        if (activeModule === 'audit') {
            if (method === 'GET') {
                const { data, error } = await supabase.from('audit_log').select('*').order('timestamp', { ascending: false }).limit(200);
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            if (method === 'POST') {
                const { user_id, username, action: auditAction, details } = req.body;
                const { error } = await supabase.from('audit_log').insert([{
                    user_id, username, action: auditAction, details
                }]);
                if (error) throw error;
                return res.status(200).json({ success: true });
            }
        }

    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
