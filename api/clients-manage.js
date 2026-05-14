const { supabase } = require('./utils/supabase');

exports.handler = async (event) => {
    let table = 'customers'; // Default
    
    // Check query params (GET) or body (POST)
    if (event.queryStringParameters && event.queryStringParameters.table) {
        table = event.queryStringParameters.table;
    } else if (event.body) {
        try {
            const body = JSON.parse(event.body);
            if (body.table) table = body.table;
        } catch(e) {}
    }
    
    try {
        if (event.httpMethod === 'GET') {
            const { search } = event.queryStringParameters || {};
            let query = supabase.from(table).select('*').order('name', { ascending: true });
            
            if (search) {
                query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { action, id, table: bodyTable, ...clientData } = body;

            if (action === 'add') {
                const prefix = table === 'patients' ? 'P-' : 'C-';
                const id = prefix + Date.now();
                const { error } = await supabase.from(table).insert([{ id, ...clientData }]);
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Added successfully' }) };
            }

            if (action === 'update') {
                const { data, error } = await supabase.from(table).update(clientData).eq('id', id);
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Updated successfully' }) };
            }

            if (action === 'delete') {
                const { data, error } = await supabase.from(table).delete().eq('id', id);
                if (error) throw error;
                return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Deleted successfully' }) };
            }
        }

        return { statusCode: 405, body: 'Method Not Allowed' };

    } catch (error) {
        console.error(`${table} Error:`, error);
        return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
