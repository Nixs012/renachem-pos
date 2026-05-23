const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: Missing Supabase credentials in .env file.");
    process.exit(1);
}

async function verifySchema() {
    try {
        const response = await axios.get(`${supabaseUrl}/rest/v1/`, {
            headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`
            }
        });
        
        if (!response.data || !response.data.definitions || !response.data.definitions.sales) {
            console.log("Could not retrieve sales table definition.");
            return;
        }

        const salesDef = response.data.definitions.sales;
        const properties = salesDef.properties || {};
        
        console.log("\n==============================================");
        console.log("      SALES TABLE COLUMNS AND DATA TYPES");
        console.log("==============================================");
        console.log(String("Column Name").padEnd(25) + " | " + String("Data Type"));
        console.log("----------------------------------------------");
        for (const [colName, details] of Object.entries(properties)) {
            const format = details.format || details.type || 'unknown';
            console.log(colName.padEnd(25) + " | " + format);
        }
        console.log("==============================================\n");

        if (response.data.definitions.settings) {
            console.log("==============================================");
            console.log("    SETTINGS TABLE COLUMNS AND DATA TYPES");
            console.log("==============================================");
            console.log(String("Column Name").padEnd(25) + " | " + String("Data Type"));
            console.log("----------------------------------------------");
            const settingsDef = response.data.definitions.settings;
            const settingsProps = settingsDef.properties || {};
            for (const [colName, details] of Object.entries(settingsProps)) {
                const format = details.format || details.type || 'unknown';
                console.log(colName.padEnd(25) + " | " + format);
            }
            console.log("==============================================\n");
        } else {
            console.log("Settings table does not exist in Supabase PostgREST definitions.\n");
        }

    } catch (error) {
        console.error("Error verifying schema:", error.message);
    }
}

verifySchema();
