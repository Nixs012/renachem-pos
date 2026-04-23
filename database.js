const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

let db;

/**
 * Initialize the database: open connection, set pragmas, create tables, and seed.
 */
function initialize() {
    try {
        const dbPath = path.join(app.getPath('userData'), 'renachem.db');
        db = new Database(dbPath);

        // Pragmas
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        db.pragma('synchronous = NORMAL');

        // Integrity Check
        const integrityCheck = db.prepare('PRAGMA integrity_check').get();
        if (integrityCheck.integrity_check !== 'ok') {
            throw new Error('Database integrity check failed. Please restore from backup.');
        }

        // CREATE TABLES
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY, 
                username TEXT UNIQUE NOT NULL, 
                password_hash TEXT NOT NULL, 
                role TEXT NOT NULL CHECK(role IN ('Admin','Pharmacist','Cashier')), 
                is_active INTEGER DEFAULT 1, 
                is_temp_password INTEGER DEFAULT 1, 
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS login_attempts (
                id INTEGER PRIMARY KEY, 
                username TEXT, 
                attempts INTEGER DEFAULT 0, 
                locked_until DATETIME
            );

            CREATE TABLE IF NOT EXISTS medicines (
                id TEXT PRIMARY KEY, 
                name TEXT NOT NULL,
                supplier TEXT, 
                batch TEXT, 
                expiry TEXT, 
                stock INTEGER DEFAULT 0, 
                reorder_level INTEGER DEFAULT 10, 
                price REAL DEFAULT 0, 
                barcode TEXT, 
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS patients (
                id TEXT PRIMARY KEY, 
                name TEXT NOT NULL, 
                age TEXT, 
                gender TEXT, 
                diagnosis TEXT, 
                prescriptions TEXT, 
                history TEXT, 
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY, 
                name TEXT NOT NULL, 
                phone TEXT, 
                prescriptions TEXT, 
                history TEXT
            );

            CREATE TABLE IF NOT EXISTS suppliers (
                id TEXT PRIMARY KEY, 
                name TEXT NOT NULL, 
                contact TEXT, 
                items TEXT
            );

            CREATE TABLE IF NOT EXISTS purchases (
                id INTEGER PRIMARY KEY, 
                med_name TEXT, 
                batch TEXT, 
                qty INTEGER, 
                date TEXT
            );

            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY, 
                date TEXT, 
                date_time TEXT, 
                items_json TEXT, 
                total REAL, 
                payment_mode TEXT, 
                customer_name TEXT, 
                mpesa_code TEXT
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY, 
                user_id INTEGER, 
                username TEXT, 
                action TEXT, 
                module TEXT, 
                details TEXT, 
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, 
                row_hash TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY, 
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS credits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER,
                customer_name TEXT NOT NULL,
                total_amount REAL NOT NULL,
                amount_paid REAL DEFAULT 0,
                balance REAL NOT NULL,
                status TEXT CHECK(status IN ('Pending', 'Partial', 'Paid')) DEFAULT 'Pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_payment_date DATETIME,
                FOREIGN KEY(sale_id) REFERENCES sales(id)
            );

            CREATE TABLE IF NOT EXISTS credit_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                credit_id INTEGER,
                amount REAL NOT NULL,
                payment_mode TEXT NOT NULL,
                payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                received_by TEXT,
                FOREIGN KEY(credit_id) REFERENCES credits(id)
            );

            CREATE TRIGGER IF NOT EXISTS prevent_audit_delete 
            BEFORE DELETE ON audit_log 
            BEGIN 
                SELECT RAISE(ABORT, 'Audit log deletion not permitted'); 
            END;
        `);

        // --- Migrations & Self-Healing ---
        const tableInfo = db.prepare("PRAGMA table_info('users')").all();
        const hasRoleColumn = tableInfo.some(col => col.name === 'role');
        if (!hasRoleColumn) {
            console.log('MIGRATION: Adding role column to users table');
            db.prepare("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'Cashier'").run();
            // Special Case: Update default admin to Admin role
            db.prepare("UPDATE users SET role = 'Admin' WHERE username = 'admin'").run();
        }

        const medTableInfo = db.prepare("PRAGMA table_info('medicines')").all();
        const hasSupplierColumn = medTableInfo.some(col => col.name === 'supplier');
        if (!hasSupplierColumn) {
            console.log('MIGRATION: Adding supplier column to medicines table');
            db.prepare("ALTER TABLE medicines ADD COLUMN supplier TEXT DEFAULT ''").run();
        }
        const hasCostPrice = medTableInfo.some(col => col.name === 'cost_price');
        if (!hasCostPrice) {
            console.log('MIGRATION: Adding cost_price column to medicines table');
            db.prepare("ALTER TABLE medicines ADD COLUMN cost_price REAL DEFAULT 0").run();
        }

        const purTableInfo = db.prepare("PRAGMA table_info('purchases')").all();
        const hasUnitPrice = purTableInfo.some(col => col.name === 'unit_price');
        if (!hasUnitPrice) {
            console.log('MIGRATION: Hardening purchases table with financial metrics');
            db.prepare("ALTER TABLE purchases ADD COLUMN supplier TEXT DEFAULT ''").run();
            db.prepare("ALTER TABLE purchases ADD COLUMN unit_price REAL DEFAULT 0").run();
            db.prepare("ALTER TABLE purchases ADD COLUMN total_cost REAL DEFAULT 0").run();
        }

        const custTableInfo = db.prepare("PRAGMA table_info('customers')").all();
        const hasEmail = custTableInfo.some(col => col.name === 'email');
        if (!hasEmail) {
            console.log('MIGRATION: Adding email to customers table');
            db.prepare("ALTER TABLE customers ADD COLUMN email TEXT DEFAULT ''").run();
        }

        const supTableInfo = db.prepare("PRAGMA table_info('suppliers')").all();
        const hasSupPhone = supTableInfo.some(col => col.name === 'phone');
        if (!hasSupPhone) {
            console.log('MIGRATION: Hardening suppliers table with CRM metrics');
            db.prepare("ALTER TABLE suppliers ADD COLUMN phone TEXT DEFAULT ''").run();
            db.prepare("ALTER TABLE suppliers ADD COLUMN email TEXT DEFAULT ''").run();
            db.prepare("ALTER TABLE suppliers ADD COLUMN address TEXT DEFAULT ''").run();
            db.prepare("ALTER TABLE suppliers ADD COLUMN contact_person TEXT DEFAULT ''").run();
        }

        // Seed Data
        seedData();

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function seedData() {
    // Admin user
    const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
    if (!admin) {
        const adminHash = bcrypt.hashSync('Admin@1234', 12);
        db.prepare(`
            INSERT INTO users (username, password_hash, role, is_temp_password) 
            VALUES (?, ?, ?, ?)
        `).run('admin', adminHash, 'Admin', 0);
    } else if (!admin.role || admin.role === '') {
        // Repair admin role if it exists but is blank/missing
        db.prepare("UPDATE users SET role = 'Admin' WHERE username = 'admin'").run();
    }

    // Medicines
    const medCount = db.prepare('SELECT COUNT(*) as count FROM medicines').get().count;
    if (medCount === 0) {
        const meds = [
            ['PAR-001', 'Paracetamol 500mg', 'B2301', '2026-12-31', 45, 20, 5.5, '890123456789'],
            ['AMX-001', 'Amoxicillin 250mg', 'AMX242', '2026-08-15', 12, 15, 8.2, '890987654321'],
            ['CTZ-001', 'Cetirizine 10mg', 'CTZ101', '2026-12-15', 8, 10, 3.9, '890112233445'],
            ['IBU-001', 'Ibuprofen 400mg', 'IBU567', '2027-03-20', 100, 25, 7.2, '890998877665'],
            ['OME-001', 'Omeprazole 20mg', 'OME890', '2026-11-10', 30, 12, 9.5, '890554433221']
        ];
        const insertMed = db.prepare(`
            INSERT INTO medicines (id, name, batch, expiry, stock, reorder_level, price, barcode) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        meds.forEach(m => insertMed.run(...m));
    }

    // Patients
    const patientCount = db.prepare('SELECT COUNT(*) as count FROM patients').get().count;
    if (patientCount === 0) {
        const patients = [
            ['P-001', 'James Otieno', '45', 'Male', 'Hypertension', 'Amlodipine 5mg', 'Follow up every month'],
            ['P-002', 'Mary Wanjiku', '32', 'Female', 'Malaria', 'Artemether/Lumefantrine', 'Recovered']
        ];
        const insertPatient = db.prepare(`
            INSERT INTO patients (id, name, age, gender, diagnosis, prescriptions, history) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        patients.forEach(p => insertPatient.run(...p));
    }

    // Customers
    const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
    if (customerCount === 0) {
        const customers = [
            ['C-001', 'John Mwangi', '+254712345678', '', ''],
            ['C-002', 'Alice Wanjiku', '+254722334455', '', '']
        ];
        const insertCustomer = db.prepare(`
            INSERT INTO customers (id, name, phone, prescriptions, history) 
            VALUES (?, ?, ?, ?, ?)
        `);
        customers.forEach(c => insertCustomer.run(...c));
    }

    // Suppliers
    const supplierCount = db.prepare('SELECT COUNT(*) as count FROM suppliers').get().count;
    if (supplierCount === 0) {
        const suppliers = [
            ['S-001', 'MediKen Ltd', 'info@mediken.co.ke', 'Paracetamol/Amoxicillin'],
            ['S-002', 'HealthPlus Distributors', 'sales@healthplus.co.ke', 'Cetirizine/Ibuprofen']
        ];
        const insertSupplier = db.prepare(`
            INSERT INTO suppliers (id, name, contact, items) 
            VALUES (?, ?, ?, ?)
        `);
        suppliers.forEach(s => insertSupplier.run(...s));
    }
}

// --- Auth Functions ---

function verifyLogin(username, password) {
    try {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user || user.is_active === 0) return null;

        const isValid = bcrypt.compareSync(password, user.password_hash);
        if (!isValid) return null;

        return { 
            id: user.id, 
            username: user.username, 
            role: user.role, 
            is_temp_password: user.is_temp_password 
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function createUser(username, password, role) {
    try {
        if (password.length < 8) throw new Error('Password too short (min 8 chars)');
        const hash = bcrypt.hashSync(password, 12);
        const result = db.prepare(`
            INSERT INTO users (username, password_hash, role, is_temp_password) VALUES (?, ?, ?, 0)
        `).run(username, hash, role);
        return { success: true, id: result.lastInsertRowid };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function getAllUsers() {
    try {
        const users = db.prepare('SELECT id, username, role, is_active, is_temp_password, created_at FROM users').all();
        return { success: true, data: users };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function updateUserRole(id, role) {
    try {
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function resetUserPassword(id, newPassword) {
    try {
        if (newPassword.length < 8) throw new Error('Password too short');
        const hash = bcrypt.hashSync(newPassword, 12);
        db.prepare('UPDATE users SET password_hash = ?, is_temp_password = 1 WHERE id = ?').run(hash, id);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function deactivateUser(id) {
    try {
        db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function reactivateUser(id) {
    try {
        db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function deleteUser(id) {
    try {
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function getLoginAttempts(username) {
    try {
        const row = db.prepare('SELECT * FROM login_attempts WHERE username = ?').get(username);
        return row || null;
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function incrementLoginAttempts(username) {
    try {
        const exists = db.prepare('SELECT 1 FROM login_attempts WHERE username = ?').get(username);
        if (exists) {
            db.prepare('UPDATE login_attempts SET attempts = attempts + 1 WHERE username = ?').run(username);
        } else {
            db.prepare('INSERT INTO login_attempts (username, attempts) VALUES (?, 1)').run(username);
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function resetLoginAttempts(username) {
    try {
        db.prepare('UPDATE login_attempts SET attempts = 0, locked_until = NULL WHERE username = ?').run(username);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function lockAccount(username, minutes) {
    try {
        const until = new Date(Date.now() + minutes * 60000).toISOString();
        db.prepare('UPDATE login_attempts SET locked_until = ? WHERE username = ?').run(until, username);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- Medicine Functions ---

function getMedicines() {
    try {
        const rows = db.prepare('SELECT * FROM medicines').all();
        return { success: true, data: rows };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function addMedicine(data) {
    try {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 4);
        db.prepare(`
            INSERT INTO medicines (id, name, supplier, batch, expiry, stock, reorder_level, price, cost_price, barcode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, data.name, data.supplier || '', data.batch, data.expiry, data.stock || 0, data.reorder_level || 10, data.price || 0, data.cost_price || 0, data.barcode);
        return { success: true, id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function updateMedicine(id, data) {
    try {
        db.prepare(`
            UPDATE medicines 
            SET name = ?, supplier = ?, batch = ?, expiry = ?, stock = ?, reorder_level = ?, price = ?, cost_price = ?, barcode = ?
            WHERE id = ?
        `).run(data.name, data.supplier || '', data.batch, data.expiry, data.stock, data.reorder_level, data.price, data.cost_price || 0, data.barcode, id);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function bulkAddMedicines(medicinesArray) {
    try {
        const insert = db.prepare(`
            INSERT INTO medicines (id, name, supplier, batch, expiry, stock, reorder_level, price, cost_price, barcode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertMany = db.transaction((meds) => {
            let count = 0;
            for (const data of meds) {
                const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                insert.run(id, data.name, data.supplier || '', data.batch || '', data.expiry || '', data.stock || 0, data.reorder_level || 10, data.price || 0, data.cost_price || 0, data.barcode || '');
                count++;
            }
            return count;
        });
        const count = insertMany(medicinesArray);
        return { success: true, count };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function deleteMedicine(id) {
    try {
        db.prepare('DELETE FROM medicines WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- Patient Functions ---

function getPatients() {
    try {
        const rows = db.prepare('SELECT * FROM patients').all();
        return { success: true, data: rows };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function addPatient(data) {
    try {
        const id = 'P-' + Date.now();
        db.prepare(`
            INSERT INTO patients (id, name, age, gender, diagnosis, prescriptions, history)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, data.name, data.age, data.gender, data.diagnosis, data.prescriptions, data.history);
        return { success: true, id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function updatePatient(id, data) {
    try {
        db.prepare(`
            UPDATE patients SET name = ?, age = ?, gender = ?, diagnosis = ?, prescriptions = ?, history = ?
            WHERE id = ?
        `).run(data.name, data.age, data.gender, data.diagnosis, data.prescriptions, data.history, id);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function deletePatient(id) {
    try {
        db.prepare('DELETE FROM patients WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- Customer Functions ---

function getCustomers() {
    try {
        const rows = db.prepare('SELECT * FROM customers').all();
        return { success: true, data: rows };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function addCustomer(data) {
    try {
        const id = 'C-' + Date.now();
        db.prepare(`
            INSERT INTO customers (id, name, phone, email, prescriptions, history)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, data.name, data.phone, data.email, data.prescriptions, data.history);
        return { success: true, id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function updateCustomer(id, data) {
    try {
        db.prepare(`
            UPDATE customers SET name = ?, phone = ?, email = ?, prescriptions = ?, history = ?
            WHERE id = ?
        `).run(data.name, data.phone, data.email, data.prescriptions, data.history, id);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function deleteCustomer(id) {
    try {
        db.prepare('DELETE FROM customers WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- Supplier Functions ---

function getSuppliers() {
    try {
        const rows = db.prepare('SELECT * FROM suppliers').all();
        return { success: true, data: rows };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function addSupplier(data) {
    try {
        const id = 'S-' + Date.now();
        db.prepare(`
            INSERT INTO suppliers (id, name, contact_person, phone, email, address, contact, items)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, data.name, data.contact_person, data.phone, data.email, data.address, data.contact || '', data.items || '');
        return { success: true, id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function updateSupplier(id, data) {
    try {
        db.prepare('UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, contact = ?, items = ? WHERE id = ?').run(data.name, data.contact_person, data.phone, data.email, data.address, data.contact || '', data.items || '', id);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function deleteSupplier(id) {
    try {
        db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- Purchase Functions ---

function getPurchases() {
    try {
        const rows = db.prepare('SELECT * FROM purchases').all();
        return { success: true, data: rows };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function addPurchase(data) {
    try {
        const result = db.prepare(`
            INSERT INTO purchases (med_name, batch, qty, date, supplier, unit_price, total_cost)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            data.med_name, 
            data.batch, 
            data.qty, 
            data.date, 
            data.supplier || '', 
            data.unit_price || 0, 
            data.total_cost || 0
        );
        return { success: true, id: result.lastInsertRowid };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
function recordStockIntake(data) {
    const trx = db.transaction((d) => {
        // 1. Check if medicine exists by name (case insensitive) or ID if provided
        let med = null;
        if (d.med_id) {
            med = db.prepare('SELECT * FROM medicines WHERE id = ?').get(d.med_id);
        } else {
            med = db.prepare('SELECT * FROM medicines WHERE LOWER(name) = LOWER(?)').get(d.med_name);
        }

        let targetMedId = d.med_id;

        if (med) {
            targetMedId = med.id;
            // UPDATE EXISTING
            db.prepare(`
                UPDATE medicines 
                SET stock = stock + ?, 
                    price = ?, 
                    cost_price = ?,
                    expiry = ?, 
                    batch = ?, 
                    barcode = ?,
                    supplier = ?
                WHERE id = ?
            `).run(d.qty, d.selling_price || med.price, d.buying_price || med.cost_price, d.expiry || med.expiry, d.batch || med.batch, d.barcode || med.barcode, d.supplier || med.supplier, targetMedId);
        } else {
            // CREATE NEW
            targetMedId = d.med_id || (Date.now().toString() + Math.random().toString(36).substr(2, 4));
            db.prepare(`
                INSERT INTO medicines (id, name, supplier, batch, expiry, stock, reorder_level, price, cost_price, barcode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(targetMedId, d.med_name, d.supplier || '', d.batch || '', d.expiry || '', d.qty, 10, d.selling_price || 0, d.buying_price || 0, d.barcode || '');
        }

        // 2. Record the Purchase
        const purResult = db.prepare(`
            INSERT INTO purchases (med_name, batch, qty, date, supplier, unit_price, total_cost)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            d.med_name, 
            d.batch || '', 
            d.qty, 
            new Date().toISOString().slice(0, 10), 
            d.supplier || '', 
            d.buying_price || 0, 
            (d.qty * (d.buying_price || 0))
        );

        return { success: true, med_id: targetMedId, purchase_id: purResult.lastInsertRowid };
    });

    try {
        return trx(data);
    } catch (error) {
        return { success: false, error: error.message };
    }
}


// --- Sale Functions ---

function getSales() {
    try {
        const rows = db.prepare('SELECT * FROM sales').all();
        return { success: true, data: rows };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function addSale(data) {
    try {
        const result = db.prepare(`
            INSERT INTO sales (date, date_time, items_json, total, payment_mode, customer_name, mpesa_code)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(data.date, data.date_time, data.items_json, data.total, data.payment_mode, data.customer_name, data.mpesa_code);
        return { success: true, id: result.lastInsertRowid };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function recordSaleTransaction(saleData, cartItems) {
    const trx = db.transaction((data) => {
        const { saleObj, items } = data;
        
        // 1. Stock Verification & Deduction
        for (const item of items) {
            const med = db.prepare('SELECT stock, name FROM medicines WHERE id = ?').get(item.id);
            if (!med) throw new Error(`Medicine "${item.name}" no longer exists in catalog.`);
            if (med.stock < item.qty) throw new Error(`Insufficient stock for "${med.name}". Available: ${med.stock}, Requested: ${item.qty}`);
            
            db.prepare('UPDATE medicines SET stock = stock - ? WHERE id = ?').run(item.qty, item.id);
        }

        // 2. Record Sale
        const saleResult = db.prepare(`
            INSERT INTO sales (date, date_time, items_json, total, payment_mode, customer_name, mpesa_code)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(saleObj.date, saleObj.date_time, saleObj.items_json, saleObj.total, saleObj.payment_mode, saleObj.customer_name, saleObj.mpesa_code);
        
        const saleId = saleResult.lastInsertRowid;

        // 3. Record Credit if applicable
        if (saleObj.payment_mode === 'Credit') {
            db.prepare(`
                INSERT INTO credits (sale_id, customer_name, total_amount, balance)
                VALUES (?, ?, ?, ?)
            `).run(saleId, saleObj.customer_name, saleObj.total, saleObj.total);
        }

        // 4. Clinical Record Sync (NEW) - Wrapped in inner try to prevent blocking the sale
        if (saleObj.client_id && saleObj.client_type) {
            try {
                const table = saleObj.client_type === 'Patient' ? 'patients' : 'customers';
                const client = db.prepare(`SELECT prescriptions, history FROM ${table} WHERE id = ?`).get(saleObj.client_id);
                
                if (client) {
                    const datePrefix = `\n[${saleObj.date}] `;
                    const medSummary = items.map(i => `${i.name || 'Unknown Item'} (${i.qty || 0})`).join(', ');
                    
                    const newPresc = (client.prescriptions ? client.prescriptions + '\n' : '') + datePrefix + medSummary;
                    const newHistory = (client.history ? client.history + '\n' : '') + datePrefix + `Purchased: ${medSummary}`;

                    db.prepare(`UPDATE ${table} SET prescriptions = ?, history = ? WHERE id = ?`)
                      .run(newPresc, newHistory, saleObj.client_id);
                }
            } catch (clinicalError) {
                console.error("Clinical Sync Failed (Non-critical):", clinicalError);
                // We do NOT throw here because we want the sale to complete even if profile update fails
            }
        }

        return { success: true, id: saleId };
    });

    try {
        return trx({ saleObj: saleData, items: cartItems });
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- Audit Functions ---

function getLastAuditHash() {
    try {
        const row = db.prepare('SELECT row_hash FROM audit_log ORDER BY id DESC LIMIT 1').get();
        return row ? row.row_hash : 'GENESIS';
    } catch (e) {
        return 'GENESIS';
    }
}

function insertAuditLog(userId, username, action, module, details) {
    try {
        const timestamp = new Date().toISOString();
        const prevHash = getLastAuditHash();
        
        // Strict formula: previousHash + action + String(userId) + timestamp
        const dataToHash = prevHash + action + String(userId) + timestamp;
        const rowHash = crypto.createHash('sha256').update(dataToHash).digest('hex');

        db.prepare(`
            INSERT INTO audit_log (user_id, username, action, module, details, timestamp, row_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, username, action, module, details, timestamp, rowHash);
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function getAuditLog(filters = {}) {
    try {
        let query = 'SELECT * FROM audit_log WHERE 1=1';
        const params = [];

        if (filters.username) {
            query += ' AND username = ?';
            params.push(filters.username);
        }
        if (filters.module) {
            query += ' AND module = ?';
            params.push(filters.module);
        }
        if (filters.dateFrom) {
            query += ' AND timestamp >= ?';
            params.push(filters.dateFrom);
        }
        if (filters.dateTo) {
            query += ' AND timestamp <= ?';
            params.push(filters.dateTo);
        }

        query += ' ORDER BY id DESC';
        const rows = db.prepare(query).all(...params);
        return { success: true, data: rows };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function verifyAuditChain() {
    try {
        // Fetch last 100 rows to verify chain integrity
        const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100').all();
        
        // The chain is verified from bottom up (older to newer) within the set
        // Since we order DESC, rows[i+1] is older than rows[i]
        for (let i = 0; i < rows.length - 1; i++) {
            const current = rows[i];
            const previous = rows[i+1];
            
            const expectedHash = crypto.createHash('sha256')
                .update(previous.row_hash + current.action + String(current.user_id) + current.timestamp)
                .digest('hex');

            if (current.row_hash !== expectedHash) {
                return { success: true, valid: false, brokenAt: current.id };
            }
        }
        return { success: true, valid: true, brokenAt: null };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- Settings Functions ---

function getSetting(key) {
    try {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        return row ? row.value : null;
    } catch (error) {
        return null;
    }
}

function setSetting(key, value) {
    try {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- CREDIT MANAGEMENT ---

function getCredits() {
    try {
        const data = db.prepare(`
            SELECT c.*, s.items_json 
            FROM credits c
            LEFT JOIN sales s ON c.sale_id = s.id
            ORDER BY c.created_at DESC
        `).all();
        return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
}

function addCredit(data) {
    try {
        const stmt = db.prepare(`
            INSERT INTO credits (sale_id, customer_name, total_amount, balance, status)
            VALUES (?, ?, ?, ?, 'Pending')
        `);
        const info = stmt.run(data.sale_id, data.customer_name, data.total_amount, data.balance);
        return { success: true, id: info.lastInsertRowid };
    } catch (e) { return { success: false, error: e.message }; }
}

function addCreditPayment(data) {
    const { creditId, amount, paymentMode, receivedBy } = data;
    try {
        const amt = Number(amount);
        if (isNaN(amt) || amt <= 0) return { success: false, error: "Invalid payment amount." };

        const credit = db.prepare("SELECT * FROM credits WHERE id = ?").get(creditId);
        if (!credit) return { success: false, error: "Credit record not found." };

        const newPaid = Number(credit.amount_paid || 0) + amt;
        const newBalance = Number(credit.total_amount || 0) - newPaid;
        const newStatus = newBalance <= 0 ? 'Paid' : 'Partial';

        const trx = db.transaction(() => {
            db.prepare("INSERT INTO credit_payments (credit_id, amount, payment_mode, received_by) VALUES (?, ?, ?, ?)").run(creditId, amount, paymentMode, receivedBy);
            db.prepare("UPDATE credits SET amount_paid = ?, balance = ?, status = ?, last_payment_date = CURRENT_TIMESTAMP WHERE id = ?").run(newPaid, newBalance, newStatus, creditId);
        });
        trx();
        return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
}

function cleanupOldCredits() {
    try {
        // Delete Paid credits older than 3 days
        const stmt = db.prepare("DELETE FROM credits WHERE status = 'Paid' AND last_payment_date < date('now', '-3 days')");
        const info = stmt.run();
        
        // Also cleanup orphan payments if any
        db.prepare("DELETE FROM credit_payments WHERE credit_id NOT IN (SELECT id FROM credits)").run();
        
        return { success: true, count: info.changes };
    } catch (e) { return { success: false, error: e.message }; }
}

function getCreditHistory(creditId) {
    try {
        const payments = db.prepare("SELECT * FROM credit_payments WHERE credit_id = ? ORDER BY payment_date DESC").all(creditId);
        return { success: true, data: payments };
    } catch (e) { return { success: false, error: e.message }; }
}

process.on('exit', () => {
    if (db) db.close();
});

function verifyAdminPassword(userId, password) {
    try {
        const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
        if (!user) return false;
        return bcrypt.compareSync(password, user.password_hash);
    } catch (e) {
        return false;
    }
}

function resetModuleData(module) {
    const trx = db.transaction(() => {
        if (module === 'purchases') {
            db.prepare('DELETE FROM purchases').run();
            db.prepare("DELETE FROM sqlite_sequence WHERE name = 'purchases'").run();
        } else if (module === 'reports') {
            // Disable audit trigger
            db.exec('DROP TRIGGER IF EXISTS prevent_audit_delete');
            
            // Delete in correct order (child tables first)
            db.prepare('DELETE FROM credit_payments').run();
            db.prepare('DELETE FROM credits').run();
            db.prepare('DELETE FROM sales').run();
            db.prepare('DELETE FROM audit_log').run();
            
            // Reset sequences
            ['credit_payments', 'credits', 'sales', 'audit_log'].forEach(table => {
                db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(table);
            });

            // Re-enable audit trigger
            db.exec(`
                CREATE TRIGGER prevent_audit_delete 
                BEFORE DELETE ON audit_log 
                BEGIN 
                    SELECT RAISE(ABORT, 'Audit log deletion not permitted'); 
                END;
            `);
        }
        return true;
    });

    try {
        return trx();
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    initialize,
    verifyLogin,
    createUser,
    getAllUsers,
    updateUserRole,
    resetUserPassword,
    deactivateUser,
    reactivateUser,
    deleteUser,
    getLoginAttempts,
    incrementLoginAttempts,
    resetLoginAttempts,
    lockAccount,
    getMedicines,
    addMedicine,
    updateMedicine,
    bulkAddMedicines,
    deleteMedicine,
    getPatients,
    addPatient,
    updatePatient,
    deletePatient,
    getCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    getSuppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    getPurchases,
    addPurchase,
    recordStockIntake,
    getSales,
    addSale,
    getCredits,
    addCredit,
    addCreditPayment,
    getCreditHistory,
    cleanupOldCredits,
    insertAuditLog,
    getAuditLog,
    getLastAuditHash,
    verifyAuditChain,
    getSetting,
    setSetting,
    recordSaleTransaction,
    verifyAdminPassword,
    resetModuleData
};
