module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    return res.status(200).json({
        SUPABASE_URL: process.env.SUPABASE_URL || 'NOT_DEFINED',
        SUPABASE_SERVICE_KEY_EXISTS: !!process.env.SUPABASE_SERVICE_KEY,
        SUPABASE_SERVICE_ROLE_KEY_EXISTS: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        APP_SECRET_EXISTS: !!process.env.APP_SECRET
    });
};
