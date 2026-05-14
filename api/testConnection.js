const { supabase } = require('./utils/supabase');

exports.handler = async (event, context) => {
    try {
        // Attempt a simple query to verify the connection is active
        const { data, error } = await supabase
            .from('users')
            .select('id, username, role')
            .limit(1);

        if (error) {
            throw error;
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                message: 'Successfully connected to Supabase Cloud Database!', 
                data 
            }),
        };
    } catch (error) {
        console.error('Supabase connection test failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                message: 'Failed to connect to Supabase.',
                error: error.message 
            }),
        };
    }
};
