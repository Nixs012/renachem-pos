const { supabase } = require('./supabase');

const tokenCache = new Map();

async function verifySession(req) {
    // 1. Get token from Authorization header or cookie
    let authHeader = req.headers.authorization || req.headers['x-auth-token'];
    let token = '';

    if (authHeader) {
        token = authHeader.replace('Bearer ', '');
    } else if (req.headers.cookie) {
        const cookies = Object.fromEntries(req.headers.cookie.split('; ').map(c => c.split('=')));
        token = cookies['sb-access-token']; // Common Supabase cookie name
    }

    if (!token || token === 'undefined' || token === 'null') {
        console.log('VerifySession: No valid token found');
        return null;
    }

    // Check memory cache first
    const now = Date.now();
    if (tokenCache.has(token)) {
        const cached = tokenCache.get(token);
        if (cached.exp > now) {
            return cached.user;
        } else {
            tokenCache.delete(token);
        }
    }

    try {
        // 2. Validate with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error) {
            console.error('VerifySession: Supabase error:', error.message);
            return null;
        }

        if (!user) {
            console.log('VerifySession: No user found for token');
            return null;
        }

        // Cache for 10 minutes to prevent rate limits
        tokenCache.set(token, { user, exp: now + 600000 });

        return user;
    } catch (e) {
        console.error('VerifySession: Exception:', e.message);
        return null;
    }
}

function unauthorizedResponse(res) {
    return res.status(401).json({ success: false, error: 'Session invalid or expired. Please login again.' });
}

module.exports = { verifySession, unauthorizedResponse };
