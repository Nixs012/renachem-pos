const { supabase } = require('./utils/supabase');
const bcrypt = require('bcryptjs');
require('dotenv').config();

module.exports = async (req, res) => {
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
        const { data: users, error: fetchErr } = await supabase.from('users').select('*').ilike('username', username);
        if (fetchErr || !users || users.length === 0) {
            return res.status(400).json({ success: false, error: 'Admin user not found' });
        }

        const dbUser = users[0];
        if (dbUser.role !== 'Admin') {
            return res.status(400).json({ success: false, error: 'Password recovery is restricted to Admins only' });
        }

        // 2. Hash new password and update public.users
        const hash = await bcrypt.hash(newPassword, 10);
        const { error: updateErr } = await supabase.from('users').update({ password_hash: hash, is_active: 1 }).eq('id', dbUser.id);
        if (updateErr) throw updateErr;

        // 3. Update Supabase Auth if the user exists there as well
        const userEmail = `${username}@renachem.local`;
        
        // Find auth user ID first
        const { data: authUsers, error: listErr } = await supabase.auth.admin.listUsers();
        if (!listErr && authUsers && authUsers.users) {
            const authUser = authUsers.users.find(u => u.email === userEmail);
            if (authUser) {
                // Update their auth password
                await supabase.auth.admin.updateUserById(authUser.id, { password: newPassword });
            }
        }

        return res.status(200).json({ success: true });

    } catch (e) {
        console.error('Recovery Error:', e);
        return res.status(500).json({ success: false, error: e.message });
    }
};
