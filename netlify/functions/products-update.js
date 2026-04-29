const { supabase } = require('./utils/supabase');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { id, ...updates } = JSON.parse(event.body);

        if (!id) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: 'Product ID is required for update' })
            };
        }

        const { data, error } = await supabase
            .from('medicines')
            .update(updates)
            .eq('id', id);

        if (error) throw error;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, message: 'Product updated successfully' })
        };

    } catch (error) {
        console.error('Products Update Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Failed to update product' })
        };
    }
};
