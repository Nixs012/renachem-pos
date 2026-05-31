const { supabase } = require('./_utils/supabase');
const bcrypt = require('bcryptjs');
require('dotenv').config();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { username, recoveryKey, newPassword } = req.body;
        const systemKey = process.env.APP_SECRET;

        if (!systemKey || systemKey !== recoveryKey) {
            return res.status(400).json({ success: false, error: 'Invalid System Recovery Key' });
        }

        if (!username || !newPassword) {
            return res.status(400).json({ success: false, error: 'Username and new password required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
        }

        // 1. Check if user exists and is Admin
        const { data: users, error: fetchErr } = await supabase.from('users').select('*').ilike('username', username.trim());
        if (fetchErr) throw fetchErr;

        let dbUser = (users && users.length > 0) ? users[0] : null;

        // SELF-HEALING AUTO-PROVISIONER: Seed admin if missing during recovery
        if (!dbUser && username.trim().toLowerCase() === 'admin') {
            console.log('Auto-creating missing admin during password recovery...');
            const defaultHash = await bcrypt.hash(newPassword, 10);
            const { data: seededUsers, error: seedError } = await supabase.from('users').insert([{
                username: 'admin',
                password_hash: defaultHash,
                role: 'Admin',
                is_active: 1
            }]).select();
            
            if (!seedError && seededUsers && seededUsers.length > 0) {
                dbUser = seededUsers[0];
            } else {
                console.error('Failed to seed missing admin user during recovery:', seedError);
            }
        }

        if (!dbUser) {
            return res.status(400).json({ success: false, error: 'Admin user not found' });
        }

        if (dbUser.role !== 'Admin') {
            return res.status(400).json({ success: false, error: 'Password recovery is restricted to Admins only' });
        }

        // 2. Hash new password and update public.users
        const hash = await bcrypt.hash(newPassword, 10);
        const { error: updateErr } = await supabase.from('users').update({ password_hash: hash, is_active: 1 }).eq('id', dbUser.id);
        if (updateErr) throw updateErr;

        return res.status(200).json({ success: true });

    } catch (e) {
        console.error('Recovery Error:', e);
        return res.status(500).json({ success: false, error: e.message });
    }
};
