if (window.api) {
    console.log("RENACHEM: Desktop Mode Active. Cloud Bridge Idle.");
} else {
    console.log("RENACHEM: Web Mode Active. Initializing Cloud Bridge...");

    const API_BASE = '/.netlify/functions';

    const callApi = async (functionName, body = {}, method = 'POST') => {
        try {
            let url = `${API_BASE}/${functionName}`;
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };
            
            if (method === 'POST') {
                options.body = JSON.stringify(body);
            } else {
                const params = new URLSearchParams(body).toString();
                if (params) url += `?${params}`;
            }

            const response = await fetch(url, options);
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
        login: async (creds) => await callApi('auth-login', creds),
        logout: async () => ({ success: true }),
        createUser: async (data) => await callApi('settings-manage', { action: 'createUser', ...data }),
        getUsers: async () => await callApi('settings-manage', { action: 'getUsers' }, 'GET'),
        updateRole: async (id, role) => await callApi('settings-manage', { action: 'updateUserRole', id, role }),
        resetPassword: async (id, password) => await callApi('settings-manage', { action: 'resetUserPassword', id, password }),
        deactivateUser: async (id) => await callApi('settings-manage', { action: 'deactivateUser', id }),
        reactivateUser: async (id) => await callApi('settings-manage', { action: 'reactivateUser', id }),
        deleteUser: async (id) => await callApi('settings-manage', { action: 'deleteUser', id }),
        verifyAdminPassword: async (password) => await callApi('auth-verify', { password, requireAdmin: true }),
        recoverAdminPassword: async (data) => ({ success: false, error: 'Recovery via web requires server intervention. Contact Admin.' })
    };

    // --- EMULATED DB MODULE ---
    window.db = {
        getMedicines: async () => await callApi('products-get', {}, 'GET'),
        addMedicine: async (data) => await callApi('products-add', data),
        updateMedicine: async (id, data) => await callApi('products-update', { id, ...data }),
        deleteMedicine: async (id) => await callApi('products-delete', { id }),
        
        getPatients: async () => await callApi('clients-manage', { table: 'patients' }, 'GET'),
        addPatient: async (data) => await callApi('clients-manage', { action: 'add', ...data }),
        updatePatient: async (id, data) => await callApi('clients-manage', { action: 'update', id, ...data }),
        deletePatient: async (id) => await callApi('clients-manage', { action: 'delete', id }),
        
        getCustomers: async () => await callApi('clients-manage', { table: 'customers' }, 'GET'),
        addCustomer: async (data) => await callApi('clients-manage', { action: 'add', ...data }),
        updateCustomer: async (id, data) => await callApi('clients-manage', { action: 'update', id, ...data }),
        deleteCustomer: async (id) => await callApi('clients-manage', { action: 'delete', id }),
        
        getSales: async () => await callApi('sales-get', {}, 'GET'),
        addSale: async (data) => await callApi('sales-add', { saleObj: data, cartItems: data.items }),
        recordSaleTransaction: async (saleData, cartItems) => await callApi('sales-add', { saleObj: saleData, cartItems }),
        
        getCredits: async () => await callApi('credits-manage', {}, 'GET'),
        addCreditPayment: async (data) => await callApi('credits-manage', { action: 'addPayment', ...data }),
        getCreditHistory: async (creditId) => await callApi('credits-manage', { creditId }, 'GET'),
        
        getAuditLog: async (filters) => await callApi('audit-log', filters, 'GET'),
        insertAuditLog: async (logEntry) => await callApi('audit-log', logEntry),
        
        getSetting: async (key) => {
            const res = await callApi('settings-manage', { key }, 'GET');
            return res.value;
        },
        updateSetting: async (key, value) => await callApi('settings-manage', { action: 'updateSetting', key, value }),
        
        resetModuleData: async (module) => ({ success: false, error: 'Database reset is restricted on the web version.' })
    };

    window.api = { isWeb: true };
}
