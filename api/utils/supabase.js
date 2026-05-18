const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials in environment variables.");
}

// We use the Service Role key for the backend to bypass RLS 
// and handle all security and business logic within the serverless function itself.
const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase };
