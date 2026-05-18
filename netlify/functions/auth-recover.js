const { supabase } = require('./utils/supabase');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { username, recoveryKey, newPassword } = JSON.parse(event.body);

        // 1. Verify the System Recovery Key (APP_SECRET)
        const systemSecret = process.env.APP_SECRET;
        if (!systemSecret || recoveryKey !== systemSecret) {
            return { 
                statusCode: 401, 
                body: JSON.stringify({ success: false, error: 'Invalid System Recovery Key.' }) 
            };
        }

        // 2. Find the user
        const { data: users, error: findError } = await supabase
            .from('users')
            .select('*')
            .ilike('username', username.trim());

        if (findError) throw findError;

        let user = (users && users.length > 0) ? users[0] : null;

        // SELF-HEALING AUTO-PROVISIONER: Seed admin if missing during recovery
        if (!user && username.trim().toLowerCase() === 'admin') {
            console.log('Auto-creating missing admin during password recovery...');
            const defaultHash = bcrypt.hashSync(newPassword, 10);
            const { data: seededUsers, error: seedError } = await supabase.from('users').insert([{
                username: 'admin',
                password_hash: defaultHash,
                role: 'Admin',
                is_active: 1
            }]).select();
            
            if (!seedError && seededUsers && seededUsers.length > 0) {
                user = seededUsers[0];
            } else {
                console.error('Failed to seed missing admin user during recovery:', seedError);
            }
        }

        if (!user) {
            return { 
                statusCode: 404, 
                body: JSON.stringify({ success: false, error: 'User not found.' }) 
            };
        }

        // 3. Reset the password
        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(newPassword, salt);

        const { error: updateError } = await supabase
            .from('users')
            .update({ password_hash, is_temp_password: 1 })
            .eq('id', user.id);

        if (updateError) throw updateError;

        // 4. Reset login attempts if locked
        await supabase.from('login_attempts').delete().eq('username', username);

        return { 
            statusCode: 200, 
            body: JSON.stringify({ success: true, message: 'Password reset successfully. You can now login.' }) 
        };

    } catch (error) {
        console.error('Recovery Error:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ success: false, error: error.message }) 
        };
    }
};
