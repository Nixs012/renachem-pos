const { supabase } = require('./utils/supabase');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const product = JSON.parse(event.body);

        if (!product.id || !product.name) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: 'Product ID and Name are required' })
            };
        }

        const { data, error } = await supabase
            .from('medicines')
            .insert([product]);

        if (error) throw error;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, message: 'Product added successfully' })
        };

    } catch (error) {
        console.error('Products Add Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Failed to add product' })
        };
    }
};
