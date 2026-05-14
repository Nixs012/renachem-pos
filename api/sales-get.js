const { supabase } = require('./utils/supabase');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { date, startDate, endDate, limit } = event.queryStringParameters || {};

        let query = supabase
            .from('sales')
            .select('*')
            .order('date_time', { ascending: false });

        if (date) {
            query = query.eq('date', date);
        } else if (startDate && endDate) {
            query = query.gte('date', startDate).lte('date', endDate);
        }

        if (limit) {
            query = query.limit(parseInt(limit));
        }

        const { data: sales, error } = await query;

        if (error) throw error;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, data: sales })
        };

    } catch (error) {
        console.error('Sales Get Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Failed to fetch sales history' })
        };
    }
};
