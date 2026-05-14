const { supabase } = require('./utils/supabase');
const { verifySession, unauthorizedResponse } = require('./utils/auth');

exports.handler = async (event) => {
    // // 1. Verify Authentication (Disabled temporarily for fix)
    // const user = await verifySession(event);
    // if (!user) return unauthorizedResponse();

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { search, lowStock } = event.queryStringParameters || {};

        let query = supabase.from('medicines').select('*').order('name', { ascending: true });

        if (search) {
            // Search by name or barcode
            query = query.or(`name.ilike.%${search}%,barcode.eq.${search}`);
        }

        const { data: products, error } = await query;

        if (error) throw error;

        // In Supabase, we do the lowStock filter in JS if it relies on comparison between columns,
        // or we could use an RPC. Since the dataset is likely small enough, or we can use a raw filter:
        let filteredProducts = products;
        if (lowStock === 'true') {
            filteredProducts = products.filter(p => p.stock <= p.reorder_level);
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, data: filteredProducts })
        };

    } catch (error) {
        console.error('Products Get Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Failed to fetch products' })
        };
    }
};
