const { supabase } = require('./utils/supabase');

exports.handler = async (event) => {
    try {
        if (event.httpMethod === 'GET') {
            const { module, username, startDate, endDate } = event.queryStringParameters || {};
            let query = supabase.from('audit_log').select('*').order('timestamp', { ascending: false });

            if (module) query = query.eq('module', module);
            if (username) query = query.eq('username', username);
            if (startDate && endDate) query = query.gte('timestamp', startDate).lte('timestamp', endDate);

            const { data, error } = await query;
            if (error) throw error;
            return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
        }

        if (event.httpMethod === 'POST') {
            const logEntry = JSON.parse(event.body);
            const { error } = await supabase.from('audit_log').insert([logEntry]);
            if (error) throw error;
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, body: 'Method Not Allowed' };

    } catch (error) {
        console.error('Audit Log Error:', error);
        return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
