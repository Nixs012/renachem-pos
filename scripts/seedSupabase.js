const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials in .env file.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
    console.log("Seeding Supabase database...");
    
    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync('admin', salt);

    const { data, error } = await supabase
        .from('users')
        .insert([
            { username: 'admin', password_hash, role: 'Admin', is_active: 1, is_temp_password: 1 }
        ]);

    if (error) {
        if (error.code === '23505') {
            console.log("Admin user already exists.");
        } else {
            console.error("Error inserting admin user:", error);
        }
    } else {
        console.log("Successfully created default admin user (admin/admin).");
    }
}

seed();
