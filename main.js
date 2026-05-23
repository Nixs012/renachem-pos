require('dotenv').config();
console.log('--- SYSTEM BREADCRUMB: DOTENV LOADED ---');
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
console.log('--- SYSTEM BREADCRUMB: ELECTRON DEPS LOADED ---');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
console.log('--- SYSTEM BREADCRUMB: CORE DEPS LOADED ---');
const db = require('./database.js');
console.log('--- SYSTEM BREADCRUMB: DATABASE MODULE LOADED ---');
// M-Pesa server import removed as per manual record requirement


let mainWindow = null;
let currentSessionToken = null;
let currentSessionRole = null;
let currentSessionUserId = null;
let sessionTimer = null;

// IPC Rate Limiter
const ipcCallTracker = new Map();

function isIpcRateLimited(channel) {
    const now = Date.now();
    
    if (!ipcCallTracker.has(channel)) {
        ipcCallTracker.set(channel, []);
    }

    const timestamps = ipcCallTracker.get(channel).filter(ts => now - ts < 5000);
    timestamps.push(now);
    ipcCallTracker.set(channel, timestamps);

    return timestamps.length > 20;
}

// Session Management
function createSession(userId, role) {
    currentSessionToken = crypto.randomBytes(32).toString('hex');
    currentSessionRole = role;
    currentSessionUserId = userId;
    resetSessionTimer();
}

function resetSessionTimer() {
    if (sessionTimer) clearTimeout(sessionTimer);
    sessionTimer = setTimeout(expireSession, 30 * 60 * 1000);
}

function expireSession() {
    currentSessionToken = null;
    currentSessionRole = null;
    currentSessionUserId = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('session:expired');
    }
}

function validateSession(token) {
    return currentSessionToken !== null && token === currentSessionToken;
}

// Window Management
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 700,
        title: 'Renachem Pharmacy POS',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    if (app.isPackaged) {
        mainWindow.webContents.on('devtools-opened', () => {
            mainWindow.webContents.closeDevTools();
        });
    }

    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://')) event.preventDefault();
    });

    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function setupCSP() {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data:; connect-src 'self' http://localhost:3000 http://localhost:3001"
                ]
            }
        });
    });
}

// Auto-Backup
async function runAutoBackup() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const lastBackup = db.getSetting('last_backup');

        if (lastBackup !== today) {
            const userDataPath = app.getPath('userData');
            const dbPath = path.join(userDataPath, 'renachem.db');
            const backupsDir = path.join(userDataPath, 'backups');

            if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

            const backupFile = path.join(backupsDir, `renachem-${today}.renabackup`);
            fs.copyFileSync(dbPath, backupFile);

            const files = fs.readdirSync(backupsDir)
                .filter(f => f.endsWith('.renabackup'))
                .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
                .sort((a, b) => b.time - a.time);

            if (files.length > 7) {
                for (let i = 7; i < files.length; i++) {
                    fs.unlinkSync(path.join(backupsDir, files[i].name));
                }
            }

            db.setSetting('last_backup', today);
            console.log('Daily backup completed.');
        }
    } catch (error) {
        console.error('Backup Failed:', error.message);
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('backup:warning');
    }
}

// Global Handling
function logError(error) {
    try {
        console.error('App Error:', error);
        if (!app.isReady()) return; // Prevent app.getPath crash if error occurs during init

        const today = new Date().toISOString().split('T')[0];
        const logPath = path.join(app.getPath('userData'), 'logs');
        if (!fs.existsSync(logPath)) fs.mkdirSync(logPath, { recursive: true });
        const logFile = path.join(logPath, `error-${today}.log`);
        const message = `[${new Date().toISOString()}] ${error.stack || error}\n`;
        fs.appendFileSync(logFile, message);
    } catch (e) {
        console.error('Logging failed:', e.message);
    }
}

process.on('uncaughtException', error => {
    console.error('--- CRITICAL UNCAUGHT EXCEPTION ---');
    console.error(error);
    logError(error);
    if (dialog) {
        dialog.showErrorBox('Fatal Error', `An unexpected error occurred: ${error.message}`);
    }
    // app.relaunch(); // DISABLED FOR DIAGNOSTICS
    // app.exit(0);    // DISABLED FOR DIAGNOSTICS
});

process.on('unhandledRejection', reason => {
    logError(reason);
});

app.whenReady().then(() => {
    console.log('--- SYSTEM BREADCRUMB: APP READY ---');
    const dbInit = db.initialize();
    console.log('--- SYSTEM BREADCRUMB: DB INIT RESULT:', dbInit);
    
    if (dbInit.success === false) {
        dialog.showErrorBox('Database Error', `Database failed to initialize: ${dbInit.error}. The app cannot start.`);
        app.exit(1);
        return;
    }

    // M-Pesa automated server startup removed (now handled manually)


    setupCSP();
    createWindow();
    
    mainWindow.webContents.on('did-finish-load', () => {
        runAutoBackup();
    });
});

// IPC Wrappers
function wrapHandler(handler, options = { adminOnly: false, noAuth: false }) {
    return async (event, ...args) => {
        try {
            if (isIpcRateLimited(event.channel)) {
                return { success: false, error: 'Too many requests' };
            }

            resetSessionTimer();

            if (!options.noAuth) {
                const token = args[0];
                if (!validateSession(token)) return { success: false, error: 'Unauthorized session' };
                if (options.adminOnly && currentSessionRole !== 'Admin') {
                    return { success: false, error: 'Permission denied: Admin only' };
                }
            }

            return await handler(event, ...args);
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
}

// Authentication Handlers
ipcMain.handle('auth:login', wrapHandler(async (event, data) => {
    const { username, password } = data;
    const attemptsRow = db.getLoginAttempts(username);
    
    if (attemptsRow && attemptsRow.locked_until) {
        if (new Date() < new Date(attemptsRow.locked_until)) {
            return { success: false, locked: true, lockedUntil: attemptsRow.locked_until };
        }
    }

    const user = db.verifyLogin(username, password);
    if (user) {
        db.resetLoginAttempts(username);
        createSession(user.id, user.role);
        db.insertAuditLog(user.id, user.username, 'LOGIN_SUCCESS', 'AUTH', 'User logged in');
        return { success: true, user, sessionToken: currentSessionToken };
    } else {
        db.incrementLoginAttempts(username);
        const newAttempts = db.getLoginAttempts(username);
        const shouldLock = newAttempts && newAttempts.attempts >= 5;
        if (shouldLock) db.lockAccount(username, 15);
        db.insertAuditLog(null, username, 'LOGIN_FAILED', 'AUTH', `Failed attempt for ${username}`);
        return { success: false, locked: shouldLock };
    }
}, { noAuth: true }));

ipcMain.handle('auth:logout', wrapHandler(async () => {
    db.insertAuditLog(currentSessionUserId, null, 'LOGOUT', 'AUTH', 'User logged out');
    expireSession();
    return { success: true };
}));

ipcMain.handle('auth:createUser', wrapHandler(async (event, t, data) => {
    // Strict Schema Validation
    const { username, password, role } = data;
    if (!username || typeof username !== 'string' || !/^[a-zA-Z0-9]{3,30}$/.test(username)) {
        throw new Error('Invalid username: 3-30 chars, alphanumeric only (no special chars)');
    }
    if (!['Admin', 'Pharmacist', 'Cashier'].includes(role)) {
        throw new Error('Invalid role specified');
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }

    const res = db.createUser(username, password, role);
    if (res.success) db.insertAuditLog(currentSessionUserId, null, 'USER_CREATED', 'AUTH', `Created user ${username}`);
    return res;
}, { adminOnly: true }));

ipcMain.handle('auth:getUsers', wrapHandler(async () => db.getAllUsers(), { adminOnly: true }));

ipcMain.handle('auth:updateRole', wrapHandler(async (event, t, { id, role }) => {
    db.insertAuditLog(currentSessionUserId, null, 'ROLE_CHANGED', 'AUTH', `Changed user ${id} role to ${role}`);
    return db.updateUserRole(id, role);
}, { adminOnly: true }));

ipcMain.handle('auth:resetPassword', wrapHandler(async (event, t, { id, password }) => {
    db.insertAuditLog(currentSessionUserId, null, 'PASSWORD_RESET', 'AUTH', `Reset password for user ${id}`);
    return db.resetUserPassword(id, password);
}, { adminOnly: true }));

ipcMain.handle('auth:recoverAdminPassword', wrapHandler(async (event, { username, recoveryKey, newPassword }) => {
    const result = db.recoverAdminPassword(username, recoveryKey, newPassword);
    if (result.success) {
        db.insertAuditLog(null, username, 'PASSWORD_RECOVERED', 'AUTH', `Admin password recovered via System Key for ${username}`);
    } else {
        db.insertAuditLog(null, username, 'RECOVERY_FAILED', 'AUTH', `Failed admin recovery attempt for ${username}`);
    }
    return result;
}, { noAuth: true }));


ipcMain.handle('auth:deactivateUser', wrapHandler(async (event, t, id) => {
    if (id === currentSessionUserId) throw new Error('Cannot deactivate yourself');
    db.insertAuditLog(currentSessionUserId, null, 'USER_DEACTIVATED', 'AUTH', `Deactivated user ${id}`);
    return db.deactivateUser(id);
}, { adminOnly: true }));

ipcMain.handle('auth:reactivateUser', wrapHandler(async (event, t, id) => db.reactivateUser(id), { adminOnly: true }));
ipcMain.handle('auth:deleteUser', wrapHandler(async (event, t, id) => {
    if (id === currentSessionUserId) throw new Error('Cannot delete yourself');
    db.insertAuditLog(currentSessionUserId, null, 'USER_DELETED', 'AUTH', `Permanently deleted user ${id}`);
    return db.deleteUser(id);
}, { adminOnly: true }));

// Database Handlers
ipcMain.handle('db:getMedicines', wrapHandler(async () => db.getMedicines()));
ipcMain.handle('db:addMedicine', wrapHandler(async (event, t, data) => {
    // Strict Schema Validation
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') throw new Error('Medicine name is required');
    if (typeof data.price !== 'number' || data.price < 0) throw new Error('Invalid price: must be 0 or greater');
    if (typeof data.stock !== 'number' || data.stock < 0 || !Number.isInteger(data.stock)) {
        throw new Error('Invalid stock: must be a non-negative integer');
    }

    const res = db.addMedicine(data);
    if (res.success) db.insertAuditLog(currentSessionUserId, null, 'MEDICINE_ADDED', 'INVENTORY', `Added medicine: ${data.name}`);
    return res;
}));

ipcMain.handle('db:bulkAddMedicines', wrapHandler(async (event, t, medicinesArray) => {
    if (!Array.isArray(medicinesArray) || medicinesArray.length === 0) throw new Error('Invalid bulk data');
    const res = db.bulkAddMedicines(medicinesArray);
    if (res.success) db.insertAuditLog(currentSessionUserId, null, 'BULK_MEDICINE_ADDED', 'INVENTORY', `Bulk imported ${res.count} inventory items`);
    return res;
}));

ipcMain.handle('db:updateMedicine', wrapHandler(async (event, t, id, data) => {
    db.insertAuditLog(currentSessionUserId, null, 'MEDICINE_EDITED', 'INVENTORY', `Updated medicine ID: ${id}`);
    return db.updateMedicine(id, data);
}));
ipcMain.handle('db:deleteMedicine', wrapHandler(async (event, t, id) => {
    db.insertAuditLog(currentSessionUserId, null, 'MEDICINE_DELETED', 'INVENTORY', `Deleted medicine ID: ${id}`);
    return db.deleteMedicine(id);
}, { adminOnly: true }));

ipcMain.handle('db:getPatients', wrapHandler(async () => db.getPatients()));
ipcMain.handle('db:addPatient', wrapHandler(async (event, t, data) => {
    const res = db.addPatient(data);
    if (res.success) db.insertAuditLog(currentSessionUserId, null, 'PATIENT_ADDED', 'PATIENTS', `Added patient: ${data.name}`);
    return res;
}));
ipcMain.handle('db:updatePatient', wrapHandler(async (event, t, id, data) => db.updatePatient(id, data)));
ipcMain.handle('db:deletePatient', wrapHandler(async (event, t, id) => db.deletePatient(id), { adminOnly: true }));

ipcMain.handle('db:getCustomers', wrapHandler(async () => db.getCustomers()));
ipcMain.handle('db:addCustomer', wrapHandler(async (event, t, data) => db.addCustomer(data)));
ipcMain.handle('db:updateCustomer', wrapHandler(async (event, t, id, data) => db.updateCustomer(id, data)));
ipcMain.handle('db:deleteCustomer', wrapHandler(async (event, t, id) => db.deleteCustomer(id), { adminOnly: true }));

ipcMain.handle('db:getSuppliers', wrapHandler(async () => db.getSuppliers()));
ipcMain.handle('db:addSupplier', wrapHandler(async (event, t, data) => db.addSupplier(data)));
ipcMain.handle('db:updateSupplier', wrapHandler(async (event, t, id, data) => db.updateSupplier(id, data)));
ipcMain.handle('db:deleteSupplier', wrapHandler(async (event, t, id) => db.deleteSupplier(id), { adminOnly: true }));

ipcMain.handle('db:getPurchases', wrapHandler(async () => db.getPurchases()));
ipcMain.handle('db:addPurchase', wrapHandler(async (event, t, data) => {
    db.insertAuditLog(currentSessionUserId, null, 'STOCK_PURCHASED', 'INVENTORY', `Purchased ${data.qty} of ${data.med_name}`);
    return db.addPurchase(data);
}));

ipcMain.handle('db:recordStockIntake', wrapHandler(async (event, t, data) => {
    // Access control handled by wrapHandler with admin/pharmacist check below if needed, 
    // but we can also do it explicitly here or via the options.
    const res = db.recordStockIntake(data);
    if (res.success) {
        db.insertAuditLog(currentSessionUserId, null, 'STOCK_INTAKE', 'INVENTORY', `Intake recorded for ${data.med_name}. Qty: ${data.qty}`);
    }
    return res;
}, { adminOrPharmacistOnly: true }));

ipcMain.handle('db:getSales', wrapHandler(async () => db.getSales()));
ipcMain.handle('db:recordSaleTransaction', wrapHandler(async (event, t, saleData, cartItems) => {
    return db.recordSaleTransaction(saleData, cartItems);
}));

ipcMain.handle('db:recordReturnTransaction', wrapHandler(async (event, t, data) => {
    const res = db.recordReturnTransaction(data);
    if (res.success) {
        db.insertAuditLog(currentSessionUserId, null, 'MEDICINE_RETURNED', 'INVENTORY', `Return processed for Sale #${data.saleId}. Qty: ${data.qty}`);
    }
    return res;
}));

ipcMain.handle('db:getReturns', wrapHandler(async () => db.getReturns()));
ipcMain.handle('db:addSale', wrapHandler(async (event, t, data) => {
    // Strict Schema Validation
    if (typeof data.total !== 'number' || data.total <= 0) throw new Error('Invalid sale total: must be greater than 0');
    if (!data.payment_mode || typeof data.payment_mode !== 'string' || data.payment_mode.trim() === '') {
        throw new Error('Payment mode is required');
    }

    db.insertAuditLog(currentSessionUserId, null, 'SALE_COMPLETED', 'SALES', `Sale Total: ${data.total}, Mode: ${data.payment_mode}`);
    return db.addSale(data);
}));

ipcMain.handle('db:getSettings', wrapHandler(async () => db.getSettings()));
ipcMain.handle('db:updateSetting', wrapHandler(async (event, t, { key, value }) => {
    const res = db.setSetting(key, value);
    if (res.success) db.insertAuditLog(currentSessionUserId, null, 'SETTING_UPDATED', 'SYSTEM', `Updated setting: ${key}`);
    return res;
}));

ipcMain.handle('db:generateInvoiceNumber', wrapHandler(async () => db.generateInvoiceNumber()));

ipcMain.handle('db:getCredits', wrapHandler(async () => db.getCredits(), { adminOrPharmacistOnly: true }));
ipcMain.handle('db:addCredit', wrapHandler(async (event, t, data) => db.addCredit(data)));
ipcMain.handle('db:addCreditPayment', wrapHandler(async (event, t, data) => {
    const res = db.addCreditPayment(data);
    if (res.success) {
        db.insertAuditLog(currentSessionUserId, null, 'CREDIT_PAYMENT', 'CREDITS', `Payment of ${data.amount} for Credit ID ${data.creditId}`);
    }
    return res;
}, { adminOrPharmacistOnly: true }));
ipcMain.handle('db:cleanupOldCredits', wrapHandler(async () => db.cleanupOldCredits(), { adminOnly: true }));
ipcMain.handle('db:getCreditHistory', wrapHandler(async (event, t, creditId) => db.getCreditHistory(creditId)));

ipcMain.handle('db:getAuditLog', wrapHandler(async (event, t, filters) => db.getAuditLog(filters), { adminOnly: true }));

ipcMain.handle('auth:verifyAdminPassword', wrapHandler(async (event, t, password) => {
    return { success: db.verifyAdminPassword(currentSessionUserId, password) };
}, { adminOnly: true }));

ipcMain.handle('db:resetModuleData', wrapHandler(async (event, t, module) => {
    db.insertAuditLog(currentSessionUserId, null, 'FACTORY_RESET', 'SYSTEM', `Modular Reset triggered for: ${module}`);
    return db.resetModuleData(module);
}, { adminOnly: true }));

// Lifecycle listeners
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
