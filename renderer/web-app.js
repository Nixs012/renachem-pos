if (window.api) {
    console.log("RENACHEM: Desktop Mode Active. Cloud Bridge Idle.");
    // Shim for callApi in desktop mode to map to IPC handlers
    window.callApi = async (functionName, body = {}) => {
        if (functionName === 'save-sale') {
            const res = await window.db.recordSaleTransaction(body, JSON.parse(body.items_json));
            return { success: res.success, message: res.error };
        }
        if (functionName === 'update-medicine-stock') {
            // In Desktop mode, recordSaleTransaction handles this atomically.
            // We just return success to satisfy the loop.
            return { success: true };
        }
        if (functionName === 'get-medicine-sales-stats') {
            try {
                const salesRes = await window.db.getSales();
                if (!salesRes.success) throw new Error(salesRes.error || 'Failed to fetch sales');
                const sales = salesRes.data || [];
                const { dateFrom, dateTo } = body;
                const medicineStats = {};
                for (const sale of sales) {
                    if (dateFrom && sale.date < dateFrom) continue;
                    if (dateTo && sale.date > dateTo) continue;
                    let items = [];
                    try { items = JSON.parse(sale.items_json); } catch { continue; }
                    for (const item of items) {
                        const name = item.name || item;
                        if (!medicineStats[name]) {
                            medicineStats[name] = { name, totalQty: 0, totalRevenue: 0, saleCount: 0 };
                        }
                        medicineStats[name].totalQty += (item.qty || 1);
                        medicineStats[name].totalRevenue += (item.subtotal || item.price || 0);
                        medicineStats[name].saleCount += 1;
                    }
                }
                const sorted = Object.values(medicineStats)
                    .sort((a, b) => b.totalQty - a.totalQty)
                    .slice(0, 15);
                return { success: true, stats: sorted };
            } catch (error) {
                return { success: false, message: error.message };
            }
        }
        if (functionName === 'get-invoices') {
            try {
                const salesRes = await window.db.getSales();
                if (!salesRes.success) throw new Error(salesRes.error || 'Failed to fetch sales');
                const sales = salesRes.data || [];
                const { dateFrom, dateTo, search } = body;
                let filtered = sales;
                if (dateFrom) filtered = filtered.filter(s => s.date >= dateFrom);
                if (dateTo) filtered = filtered.filter(s => s.date <= dateTo);
                if (search) {
                    const q = search.toLowerCase().trim();
                    filtered = filtered.filter(s => 
                        (s.invoice_number || '').toLowerCase().includes(q) ||
                        (s.customer_name || '').toLowerCase().includes(q) ||
                        (s.cashier_name || '').toLowerCase().includes(q) ||
                        (s.payment_mode || '').toLowerCase().includes(q)
                    );
                }
                // Sort by date_time or created_at descending
                filtered.sort((a, b) => {
                    const dateA = new Date(a.date_time || a.date || 0);
                    const dateB = new Date(b.date_time || b.date || 0);
                    return dateB - dateA;
                });
                return { success: true, data: filtered };
            } catch (error) {
                return { success: false, message: error.message };
            }
        }
        return { success: false, message: `Route ${functionName} not mapped in Desktop Mode.` };
    };
} else {
    console.log("RENACHEM: Web Mode Active. Initializing Cloud Bridge...");

    const API_BASE = '/api';

    const callApi = async (functionName, body = {}, method = 'POST') => {
        try {
            let url = `${API_BASE}/${functionName}`;
            const token = localStorage.getItem('renachem_token');
            
            const options = {
                method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            };
            
            if (method === 'POST') {
                options.body = JSON.stringify(body);
            } else {
                const params = new URLSearchParams(body).toString();
                if (params) url += `?${params}`;
            }

            const response = await fetch(url, options);
            if (response.status === 401 && !functionName.includes('auth-login')) {
                // Token expired or invalid - clear it but don't force reload here
                localStorage.removeItem('renachem_token');
                return { success: false, error: 'Session expired. Please login again.' };
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || `Server returned ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API Call Failed [${functionName}]:`, error);
            return { success: false, error: error.message };
        }
    };
    window.callApi = callApi;

    // --- EMULATED AUTH MODULE ---
    window.auth = {
        login: async (creds) => {
            const res = await callApi('auth-login', creds);
            if (res.success && res.token) {
                localStorage.setItem('renachem_token', res.token);
            }
            return res;
        },
        logout: async () => {
            localStorage.removeItem('renachem_token');
            return { success: true };
        },
        createUser: async (data) => await callApi('auth-create-user', data),
        getUsers: async () => await callApi('settings-manage', { action: 'getUsers', module: 'settings' }, 'GET'),
        updateRole: async (id, role) => await callApi('settings-manage', { action: 'updateUserRole', module: 'settings', id, role }),
        resetPassword: async (id, password) => await callApi('settings-manage', { action: 'resetUserPassword', module: 'settings', id, password }),
        deactivateUser: async (id) => await callApi('settings-manage', { action: 'deactivateUser', module: 'settings', id }),
        reactivateUser: async (id) => await callApi('settings-manage', { action: 'reactivateUser', module: 'settings', id }),
        deleteUser: async (id) => await callApi('settings-manage', { action: 'deleteUser', module: 'settings', id }),
        verifyAdminPassword: async (password) => await callApi('auth-verify', { password, requireAdmin: true }),
        recoverAdminPassword: async (data) => await callApi('auth-recover', data)
    };

    // --- EMULATED DB MODULE ---
    window.db = {
        getMedicines: async () => await callApi('products-get', {}, 'GET'),
        addMedicine: async (data) => await callApi('products-add', data),
        updateMedicine: async (id, data) => await callApi('products-update', { id, ...data }),
        deleteMedicine: async (id) => await callApi('products-delete', { id }),
        bulkAddMedicines: async (medicinesArray) => {
            for (const med of medicinesArray) {
                await callApi('products-add', med);
            }
            return { success: true };
        },
        
        getPatients: async () => await callApi('clients-manage', { module: 'clients', table: 'patients' }, 'GET'),
        addPatient: async (data) => await callApi('clients-manage', { module: 'clients', action: 'add', table: 'patients', ...data }),
        updatePatient: async (id, data) => await callApi('clients-manage', { module: 'clients', action: 'update', table: 'patients', id, ...data }),
        deletePatient: async (id) => await callApi('clients-manage', { module: 'clients', action: 'delete', table: 'patients', id }),
        
        getCustomers: async () => await callApi('clients-manage', { module: 'clients', table: 'customers' }, 'GET'),
        addCustomer: async (data) => await callApi('clients-manage', { module: 'clients', action: 'add', table: 'customers', ...data }),
        updateCustomer: async (id, data) => await callApi('clients-manage', { module: 'clients', action: 'update', table: 'customers', id, ...data }),
        deleteCustomer: async (id) => await callApi('clients-manage', { module: 'clients', action: 'delete', table: 'customers', id }),

        getSuppliers: async () => await callApi('suppliers-manage', { module: 'suppliers' }, 'GET'),
        addSupplier: async (data) => await callApi('suppliers-manage', { module: 'suppliers', action: 'add', ...data }),
        updateSupplier: async (id, data) => await callApi('suppliers-manage', { module: 'suppliers', action: 'update', id, ...data }),
        deleteSupplier: async (id) => await callApi('suppliers-manage', { module: 'suppliers', action: 'delete', id }),

        getPurchases: async () => await callApi('purchases-manage', { module: 'purchases' }, 'GET'),
        addPurchase: async (data) => await callApi('purchases-manage', { module: 'purchases', action: 'add', ...data }),
        recordStockIntake: async (data) => await callApi('purchases-manage', { module: 'purchases', action: 'recordStockIntake', ...data }),
        
        getSales: async () => await callApi('sales-get', {}, 'GET'),
        addSale: async (data) => await callApi('sales-add', { saleObj: data, cartItems: data.items }),
        recordSaleTransaction: async (saleData, cartItems) => await callApi('sales-add', { saleObj: saleData, cartItems }),
        
        recordReturnTransaction: async (data) => await callApi('returns-manage', { action: 'record', ...data }),
        getReturns: async () => await callApi('returns-manage', { action: 'get' }, 'GET'),
        clearReturns: async () => await callApi('returns-manage', { action: 'clear' }, 'GET'),

        getCredits: async () => await callApi('credits-manage', {}, 'GET'),
        addCredit: async (data) => await callApi('sales-add', { saleObj: { ...data, payment_mode: 'Credit' }, cartItems: data.items }),
        addCreditPayment: async (data) => await callApi('credits-manage', { action: 'addPayment', ...data }),
        getCreditHistory: async (creditId) => await callApi('credits-manage', { creditId }, 'GET'),
        cleanupOldCredits: async () => ({ success: true }), // Placeholder
        
        getAuditLog: async (filters) => await callApi('audit-log', { ...filters, module: 'audit' }, 'GET'),
        insertAuditLog: async (logEntry) => await callApi('audit-log', { ...logEntry, module: 'audit' }),
        
        getSettings: async () => await callApi('settings-manage', { action: 'getSettings', module: 'settings' }, 'GET'),
        getSetting: async (key) => {
            const res = await callApi('settings-manage', { key, module: 'settings' }, 'GET');
            return res.value;
        },
        updateSetting: async (key, value) => await callApi('settings-manage', { action: 'updateSetting', key, value, module: 'settings' }),
        
        resetModuleData: async (module) => ({ success: false, error: 'Database reset is restricted on the web version.' }),

        generateInvoiceNumber: async () => await generateInvoiceNumber()
    };

    window.api = { isWeb: true };
}

// Standalone function available in both Desktop and Web modes
async function generateInvoiceNumber() {
    if (window.api && !window.api.isWeb) {
        // Desktop Mode (SQLite)
        try {
            const res = await window.db.generateInvoiceNumber();
            if (res && res.success) {
                return res.invoiceNumber;
            }
            throw new Error(res ? res.error : 'Unknown local error');
        } catch (error) {
            console.error('Local invoice generation failed, using fallback:', error);
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const timeStr = now.getTime().toString().slice(-4);
            return `INV-${dateStr}-${timeStr}`;
        }
    } else {
        // Web Mode (calls /api/generate-invoice-number)
        try {
            const result = await callApi('generate-invoice-number', {});
            return result.invoiceNumber;
        } catch (error) {
            // Fallback if API fails
            console.error('API invoice generation failed, using fallback:', error);
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const timeStr = now.getTime().toString().slice(-4);
            return `INV-${dateStr}-${timeStr}`;
        }
    }
}
window.generateInvoiceNumber = generateInvoiceNumber;
