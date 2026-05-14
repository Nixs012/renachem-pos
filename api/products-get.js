const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');

module.exports = async (req, res) => {
    // 1. Verify Authentication
    const user = await verifySession(req);
    if (!user) return unauthorizedResponse(res);

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { search, lowStock } = req.query;

        let query = supabase.from('medicines').select('*').order('name', { ascending: true });

        if (search) {
            query = query.or(`name.ilike.%${search}%,barcode.eq.${search}`);
        }

        const { data: products, error } = await query;

        if (error) throw error;

        let filteredProducts = products;
        if (lowStock === 'true') {
            filteredProducts = products.filter(p => p.stock <= p.reorder_level);
        }

        return res.status(200).json({ success: true, data: filteredProducts });

    } catch (error) {
        console.error('Products Get Error:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch products' });
    }
};
