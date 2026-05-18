if (window.api) {
    console.log("RENACHEM: Desktop Mode Active. Cloud Bridge Idle.");
} else {
    console.log("RENACHEM: Web Mode Active. Initializing Cloud Bridge...");

    const API_BASE = '/.netlify/functions';

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
                throw new Error(errorData.error || `Server returned ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API Call Failed [${functionName}]:`, error);
            return { success: false, error: error.message };
        }
    };

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
        createUser: async (data) => await callApi('settings-manage', { action: 'createUser', module: 'settings', ...data }),
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
        
        resetModuleData: async (module) => ({ success: false, error: 'Database reset is restricted on the web version.' })
    };

    window.api = { isWeb: true };
}
