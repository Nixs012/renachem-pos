const { contextBridge, ipcRenderer } = require('electron');

let sessionToken = null;

const auth = {
    login: async (creds) => {
        try {
            const result = await ipcRenderer.invoke('auth:login', creds);
            if (result.success) sessionToken = result.sessionToken;
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    logout: async () => {
        try {
            const result = await ipcRenderer.invoke('auth:logout', sessionToken);
            sessionToken = null;
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    createUser: async (data) => {
        try {
            return await ipcRenderer.invoke('auth:createUser', sessionToken, data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    getUsers: async () => {
        try {
            return await ipcRenderer.invoke('auth:getUsers', sessionToken);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    updateRole: async (id, role) => {
        try {
            return await ipcRenderer.invoke('auth:updateRole', sessionToken, { id, role });
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    resetPassword: async (id, newPassword) => {
        try {
            return await ipcRenderer.invoke('auth:resetPassword', sessionToken, { id, password: newPassword });
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    deactivateUser: async (id) => {
        try {
            return await ipcRenderer.invoke('auth:deactivateUser', sessionToken, id);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    reactivateUser: async (id) => {
        try {
            return await ipcRenderer.invoke('auth:reactivateUser', sessionToken, id);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    deleteUser: async (id) => {
        try {
            return await ipcRenderer.invoke('auth:deleteUser', sessionToken, id);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    createUser: async (data) => {
        try {
            return await ipcRenderer.invoke('auth:createUser', sessionToken, data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    reactivateUser: async (id) => {
        try {
            return await ipcRenderer.invoke('auth:reactivateUser', sessionToken, id);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

const db = {
    getMedicines: async () => {
        try {
            return await ipcRenderer.invoke('db:getMedicines', sessionToken);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    addMedicine: async (data) => {
        try {
            return await ipcRenderer.invoke('db:addMedicine', sessionToken, data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    updateMedicine: async (id, data) => {
        try {
            return await ipcRenderer.invoke('db:updateMedicine', sessionToken, id, data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    bulkAddMedicines: async (medicinesArray) => {
        try {
            return await ipcRenderer.invoke('db:bulkAddMedicines', sessionToken, medicinesArray);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    deleteMedicine: async (id) => {
        try {
            return await ipcRenderer.invoke('db:deleteMedicine', sessionToken, id);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    getPatients: async () => {
        try {
            return await ipcRenderer.invoke('db:getPatients', sessionToken);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    addPatient: async (data) => {
        try {
            return await ipcRenderer.invoke('db:addPatient', sessionToken, data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    updatePatient: async (id, data) => {
        try {
            return await ipcRenderer.invoke('db:updatePatient', sessionToken, id, data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    deletePatient: async (id) => {
        try {
            return await ipcRenderer.invoke('db:deletePatient', sessionToken, id);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    getCustomers: async () => {
        try {
            return await ipcRenderer.invoke('db:getCustomers', sessionToken);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    addCustomer: async (data) => {
        try {
            return await ipcRenderer.invoke('db:addCustomer', sessionToken, data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    updateCustomer: async (id, data) => {
        try {
            return await ipcRenderer.invoke('db:updateCustomer', sessionToken, id, data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    deleteCustomer: async (id) => {
        try {
            return await ipcRenderer.invoke('db:deleteCustomer', sessionToken, id);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    getSuppliers: async () => {
        try {
            return await ipcRenderer.invoke('db:getSuppliers', sessionToken);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    addSupplier: async (data) => {
        try {
            return await ipcRenderer.invoke('db:addSupplier', sessionToken, data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    updateSupplier: async (id, data) => {
        try {
            return await ipcRenderer.invoke('db:updateSupplier', sessionToken, id, data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    deleteSupplier: async (id) => {
        try {
            return await ipcRenderer.invoke('db:deleteSupplier', sessionToken, id);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    getPurchases: async () => {
        try {
            return await ipcRenderer.invoke('db:getPurchases', sessionToken);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    addPurchase: async (data) => {
        try {
            return await ipcRenderer.invoke('db:addPurchase', sessionToken, data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    getSettings: async () => {
        try {
            return await ipcRenderer.invoke('db:getSettings', sessionToken);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    updateSetting: async (key, value) => {
        try {
            return await ipcRenderer.invoke('db:updateSetting', sessionToken, { key, value });
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    getSales: async () => {
        try {
            return await ipcRenderer.invoke('db:getSales', sessionToken);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    addSale: async (data) => {
        try {
            return await ipcRenderer.invoke('db:addSale', sessionToken, data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    getAuditLog: async (filters) => {
        try {
            return await ipcRenderer.invoke('db:getAuditLog', sessionToken, filters);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    addCredit: async (data) => {
        try {
            return await ipcRenderer.invoke('db:addCredit', sessionToken, data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    getCredits: async () => {
        try {
            return await ipcRenderer.invoke('db:getCredits', sessionToken);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    addCreditPayment: async (data) => {
        try {
            return await ipcRenderer.invoke('db:addCreditPayment', sessionToken, data);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    cleanupOldCredits: async () => {
        try {
            return await ipcRenderer.invoke('db:cleanupOldCredits', sessionToken);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    getCreditHistory: async (creditId) => {
        try {
            return await ipcRenderer.invoke('db:getCreditHistory', sessionToken, creditId);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

contextBridge.exposeInMainWorld('auth', auth);
contextBridge.exposeInMainWorld('db', db);

ipcRenderer.on('session:expired', () => {
    sessionToken = null;
    window.dispatchEvent(new CustomEvent('sessionExpired'));
});

ipcRenderer.on('backup:warning', () => {
    window.dispatchEvent(new CustomEvent('backupWarning'));
});
