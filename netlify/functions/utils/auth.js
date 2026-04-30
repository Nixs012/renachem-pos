const { supabase } = require('./supabase');

/**
 * Verifies the session token from the request headers.
 * @param {Object} event - The Netlify function event object.
 * @returns {Promise<Object|null>} - Returns the user object if valid, null otherwise.
 */
async function verifySession(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];
    
    const { data: session, error } = await supabase
        .from('sessions')
        .select('*, users(*)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

    if (error || !session || !session.users) {
        return null;
    }

    // Return user info
    return {
        id: session.users.id,
        username: session.users.username,
        role: session.users.role
    };
}

function unauthorizedResponse() {
    return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Unauthorized. Please login again.' })
    };
}

/**
 * Logs an action to the audit_log table.
 */
async function logAction(user, action, module, details) {
    try {
        const logEntry = {
            user_id: user.id,
            username: user.username,
            action,
            module,
            details,
            timestamp: new Date().toISOString()
        };
        await supabase.from('audit_log').insert([logEntry]);
    } catch (e) {
        console.error('Audit Log Insertion Failed:', e);
    }
}

module.exports = { verifySession, unauthorizedResponse, logAction };
