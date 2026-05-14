const { supabase } = require('./supabase');

async function verifySession(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    if (!token) return null;

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error) return null;
        return user;
    } catch (e) {
        return null;
    }
}

function unauthorizedResponse(res) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
}

module.exports = { verifySession, unauthorizedResponse };
