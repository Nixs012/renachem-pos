const { supabase } = require('./supabase');
const crypto = require('crypto');

const tokenCache = new Map();

function verifyToken(token, secret) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [header, body, signature] = parts;
        const expectedSignature = crypto.createHmac('sha256', secret)
            .update(`${header}.${body}`)
            .digest('base64url');
        if (signature !== expectedSignature) return null;
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (payload.exp && payload.exp < Date.now()) return null;
        return payload;
    } catch (e) {
        return null;
    }
}

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
        // 2. Validate with Custom JWT signature using APP_SECRET
        const secret = process.env.APP_SECRET || 'renachem_fallback_secret_key_12345';
        const payload = verifyToken(token, secret);
        
        if (!payload) {
            console.log('VerifySession: Invalid or expired custom token');
            return null;
        }

        const username = payload.username;
        if (!username) {
            console.log('VerifySession: No username in token payload');
            return null;
        }

        // Fetch the database user with correct integer ID and role
        const { data: dbUser, error: dbError } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (dbError || !dbUser) {
            console.error('VerifySession: Failed to fetch database user for username:', username, dbError?.message);
            return null;
        }

        // Cache for 10 minutes to prevent rate limits
        tokenCache.set(token, { user: dbUser, exp: now + 600000 });

        return dbUser;
    } catch (e) {
        console.error('VerifySession: Exception:', e.message);
        return null;
    }
}

function unauthorizedResponse(res) {
    return res.status(401).json({ success: false, error: 'Session invalid or expired. Please login again.' });
}

module.exports = { verifySession, unauthorizedResponse };
