const { supabase } = require('./utils/supabase');

exports.handler = async (event) => {
    try {
        if (event.httpMethod === 'GET') {
            const { data, error } = await supabase.from('suppliers').select('*').order('name', { ascending: true });
            if (error) throw error;
            return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { action, id, ...supplierData } = body;

            if (action === 'add') {
                const id = 'S-' + Date.now();
                const { data, error } = await supabase.from('suppliers').insert([{ id, ...supplierData }]);
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }

            if (action === 'update') {
                const { data, error } = await supabase.from('suppliers').update(supplierData).eq('id', id);
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }

            if (action === 'delete') {
                const { data, error } = await supabase.from('suppliers').delete().eq('id', id);
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }
        }

        return { statusCode: 405, body: 'Method Not Allowed' };

    } catch (error) {
        console.error('Suppliers Error:', error);
        return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
