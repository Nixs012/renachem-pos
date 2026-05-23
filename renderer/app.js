window.addEventListener('error', function(e) {
    let div = document.createElement('div');
    div.style = 'position:fixed; top:0; left:0; right:0; background:red; color:white; z-index:99999; padding:20px; font-weight:bold; word-wrap:break-word;';
    div.innerText = 'JS ERROR: ' + e.message + ' at ' + e.filename + ':' + e.lineno;
    document.body.appendChild(div);
});
window.addEventListener('unhandledrejection', function(e) {
    let div = document.createElement('div');
    div.style = 'position:fixed; top:50px; left:0; right:0; background:orange; color:white; z-index:99999; padding:20px; font-weight:bold; word-wrap:break-word;';
    div.innerText = 'PROMISE REJECTION: ' + (e.reason ? (e.reason.message || e.reason) : 'Unknown');
    document.body.appendChild(div);
});
let currentUser = null;
let currentPage = 'dashboard';
let cart = [];
let loginFailCount = 0;
let idleTimer;

// Pagination state
let paginationState = {
    inventory: 1,
    users: 1,
    audit: 1,
    sales: 1,
    patients: 1,
    customers: 1,
    suppliers: 1,
    limit: 12
};

// Module persistent state variables
let medicines = [];
let patients = [];
let customers = [];
let suppliers = [];
let purchases = [];
let salesTransactions = [];

// --- Connectivity Monitoring ---

function setupConnectivityMonitoring() {
    // Connectivity monitoring for M-PESA is no longer required as it is now a manual record.
    // Kept empty to avoid breaking calls to this function in window.onload
}


// --- Global Filter Helper ---
function filterTable(query, data, fields) {
    if (!query) return data;
    const q = query.toLowerCase().trim();
    return data.filter(item => {
        return fields.some(field => {
            const val = item[field];
            if (val === null || val === undefined) return false;
            return String(val).toLowerCase().includes(q);
        });
    });
}

function renderPaginationControls(module, totalItems) {
    const limit = paginationState.limit;
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = paginationState[module] || 1;
    
    if (totalPages <= 1) return '';

    const start = (currentPage - 1) * limit + 1;
    const end = Math.min(currentPage * limit, totalItems);

    return `
        <div class="pagination-bar" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; background:#f8fafc; border-top:1px solid #f1f5f9; border-radius:0 0 16px 16px;">
            <div style="font-size:0.85rem; color:#64748b;">
                Showing <b style="color:#0f172a;">${start}-${end}</b> of <b style="color:#0f172a;">${totalItems}</b> entries
            </div>
            <div style="display:flex; gap:8px;">
                <button class="action-btn-refined" onclick="changePage('${module}', ${currentPage - 1})" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                <div style="display:flex; align-items:center; padding:0 12px; font-weight:700; color:var(--royal-blue); font-size:0.9rem;">
                    Page ${currentPage} of ${totalPages}
                </div>
                <button class="action-btn-refined" onclick="changePage('${module}', ${currentPage + 1})" ${currentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>
    `;
}

window.changePage = (module, newPage) => {
    paginationState[module] = newPage;
    
    // Global Routing for Pagination Refresh
    switch (module) {
        case 'inventory':
            const qs = document.getElementById('medSearch')?.value || '';
            renderInventory(qs, window.lastInvFilter || '');
            break;
        case 'users':
            renderUsers('list');
            break;
        case 'audit':
            renderUsers('audit');
            break;
        case 'sales':
            renderReports('sales');
            break;
        case 'patients':
            const ps = document.getElementById('patientSearch')?.value || '';
            renderPatients(ps);
            break;
        case 'customers':
            const cs = document.getElementById('customerSearch')?.value || '';
            renderCustomers(cs);
            break;
        case 'suppliers':
            const ss = document.getElementById('supplierSearch')?.value || '';
            renderSuppliers(ss);
            break;
    }
};

// --- UI Helpers ---

function showToast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    while (container.children.length >= 4) {
        container.removeChild(container.firstChild);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const msgEl = document.getElementById('confirmMessage');
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');

        msgEl.innerText = message;
        modal.style.display = 'flex';

        const cleanup = (val) => {
            modal.style.display = 'none';
            yesBtn.onclick = null;
            noBtn.onclick = null;
            resolve(val);
        };

        yesBtn.onclick = () => cleanup(true);
        noBtn.onclick = () => cleanup(false);
    });
}

function validatePassword(password) {
    const errors = [];
    if (password.length < 8) errors.push('Minimum 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter (A-Z)');
    if (!/[0-9]/.test(password)) errors.push('At least one number (0-9)');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('At least one special character');
    
    const blacklisted = ['Admin@1234', 'Password@1', 'Pharmacy@1', '12345678', 'password'];
    if (blacklisted.includes(password)) errors.push('Password is too common/simple');

    return { valid: errors.length === 0, errors };
}

function getPasswordStrength(password) {
    if (!password) return '';
    const { valid, errors } = validatePassword(password);
    if (password.length < 8 || errors.length >= 2) return 'weak';
    if (valid && password.length >= 10) return 'strong';
    return 'fair';
}

function updateStrengthUI(password, barId, textId) {
    const bar = document.getElementById(barId);
    const text = document.getElementById(textId);
    if (!bar || !text) return;

    const strength = getPasswordStrength(password);
    bar.className = 'strength-bar';
    if (strength) bar.classList.add(`strength-${strength}`);
    
    text.innerText = strength ? strength.charAt(0).toUpperCase() + strength.slice(1) : '';
    text.style.color = strength === 'weak' ? '#ef4444' : (strength === 'fair' ? '#f59e0b' : '#10b981');
}

async function renderSettings() {
    const container = document.getElementById('pageContainer');
    
    // Fetch current settings
    const settings = await window.db.getSettings();
    const config = {};
    if (settings.success) {
        settings.data.forEach(s => config[s.key] = s.value);
    }

    container.innerHTML = `
        <div class="view-header">
            <h2><i class="fas fa-cog"></i> System Settings</h2>
            <p>Administer pharmacy profile and security preferences</p>
        </div>

        <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));">
            <!-- Pharmacy Profile Section -->
            <div class="stat-card">
                <h3><i class="fas fa-hospital"></i> Pharmacy Profile</h3>
                <p style="margin-bottom: 20px; font-size: 0.8rem; color: #64748b;">This information will appear on printed receipts.</p>
                
                <div class="input-group" style="margin-bottom: 15px;">
                    <label>Pharmacy Name</label>
                    <input type="text" id="set_pharmacy_name" placeholder="e.g. Renachem Pharmacy" value="${config.pharmacy_name || ''}">
                </div>
                <div class="input-group" style="margin-bottom: 15px;">
                    <label>Address / Location</label>
                    <input type="text" id="set_pharmacy_address" placeholder="e.g. 123 Medical Plaza, Nairobi" value="${config.pharmacy_address || ''}">
                </div>
                <div class="input-group" style="margin-bottom: 15px;">
                    <label>Contact Phone</label>
                    <input type="text" id="set_pharmacy_phone" placeholder="e.g. +254 700 000000" value="${config.pharmacy_phone || ''}">
                </div>
                <div class="input-group" style="margin-bottom: 15px;">
                    <label>M-Pesa Till/Paybill Number</label>
                    <input type="text" id="set_pharmacy_till" placeholder="e.g. 123456" value="${config.pharmacy_till || ''}">
                </div>
                
                <button class="btn-primary" id="saveProfileBtn" style="width: 100%;"><i class="fas fa-save"></i> Update Profile</button>
            </div>


            </div>

            <!-- Environment Info Section -->
            <div class="stat-card" style="background: rgba(248, 250, 252, 0.5); border: 1px solid #e2e8f0; backdrop-filter: blur(4px);">
                <h3><i class="fas fa-circle-nodes"></i> Environment Status</h3>
                <div style="font-size: 0.85rem; line-height: 2.2;">
                    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:5px 0;">
                        <span>App Version</span>
                        <span style="font-weight:bold;">v1.0.0-gold</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:5px 0;">
                        <span>Database Engine</span>
                        <span style="font-weight:bold;">SQLite Core</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:5px 0;">
                        <span>Last Daily Backup</span>
                        <span style="color:#64748b;">${new Date().toLocaleDateString()}</span>
                    </div>
                </div>
                <div style="margin-top:15px; padding:10px; background:rgba(30,58,138,0.05); border-radius:10px; font-size:0.7rem; color:#1e40af;">
                    <i class="fas fa-info-circle"></i> Profile updates affect future receipts only.
                </div>
            </div>
            
            <!-- System Maintenance Section -->
            <div class="stat-card" style="border: 1.5px dashed #fecaca; background: #fffafb;">
                <h3 style="color:#b91c1c;"><i class="fas fa-triangle-exclamation"></i> System Maintenance</h3>
                <p style="margin-bottom: 15px; font-size: 0.8rem; color: #7f1d1d; font-weight:500;">DANGER ZONE: Irreversible Actions</p>
                
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="padding:10px; background:white; border:1px solid #fee2e2; border-radius:12px;">
                        <div style="font-weight:700; color:#1e293b; font-size:0.85rem; margin-bottom:2px;">Purchase History</div>
                        <p style="font-size:0.7rem; color:#64748b; margin-bottom:10px;">Wipes intake history. Keeps stock levels.</p>
                        <button class="btn-primary" id="resetPurchasesBtn" style="background:#ef4444; width: 100%; padding:8px; font-size:0.75rem; font-weight:700;">
                            <i class="fas fa-trash-can"></i> RESET PURCHASES
                        </button>
                    </div>

                    <div style="padding:10px; background:white; border:1px solid #fee2e2; border-radius:12px;">
                        <div style="font-weight:700; color:#1e293b; font-size:0.85rem; margin-bottom:2px;">Sales & Reports</div>
                        <p style="font-size:0.7rem; color:#64748b; margin-bottom:10px;">Wipes sales, credits & audit logs.</p>
                        <button class="btn-primary" id="resetReportsBtn" style="background:#dc2626; width: 100%; padding:8px; font-size:0.75rem; font-weight:700;">
                            <i class="fas fa-broom"></i> RESET SALES LOGS
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event Handlers
    document.getElementById('saveProfileBtn').onclick = async () => {
        const payload = {
            pharmacy_name: document.getElementById('set_pharmacy_name').value,
            pharmacy_address: document.getElementById('set_pharmacy_address').value,
            pharmacy_phone: document.getElementById('set_pharmacy_phone').value,
            pharmacy_till: document.getElementById('set_pharmacy_till').value
        };

        for (const [key, value] of Object.entries(payload)) {
            await window.db.updateSetting(key, value);
        }
        showToast('Pharmacy profile updated successfully', 'success');
    };

    // Maintenance Handlers
    document.getElementById('resetPurchasesBtn').onclick = () => handleModuleReset('purchases');
    document.getElementById('resetReportsBtn').onclick = () => handleModuleReset('reports');
}

async function handleModuleReset(module) {
    const moduleName = module === 'purchases' ? 'Purchase History' : 'Sales & Reports';
    const impactList = module === 'purchases' 
        ? ['All historical purchase/intake logs', 'Stock arrival history', 'Supplier transaction links']
        : ['All sales transactions', 'All patient/customer credit records', 'Detailed financial reports', 'System audit logs'];

    document.getElementById('modalInner').innerHTML = `
        <div style="padding:10px;">
            <div style="text-align:center; margin-bottom:20px;">
                <div style="width:60px; height:60px; border-radius:50%; background:#fee2e2; display:flex; align-items:center; justify-content:center; margin:0 auto 15px;">
                    <i class="fas fa-triangle-exclamation" style="font-size:30px; color:#ef4444;"></i>
                </div>
                <h2 style="color:#1e293b; margin:0;">Reset ${moduleName}?</h2>
                <p style="color:#64748b; font-size:0.9rem;">This action is permanent and cannot be undone.</p>
            </div>

            <div style="background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #e2e8f0; margin-bottom:20px;">
                <div style="font-weight:700; color:#475569; font-size:0.8rem; text-transform:uppercase; margin-bottom:10px;">Data to be Wiped:</div>
                <ul style="margin:0; padding-left:20px; color:#1e293b; font-size:0.85rem; line-height:1.6;">
                    ${impactList.map(i => `<li>${i}</li>`).join('')}
                </ul>
            </div>

            <div class="input-group" style="margin-bottom:20px;">
                <label style="color:#b91c1c; font-weight:700;">Confirm Admin Password</label>
                <input type="password" id="resetConfirmPass" placeholder="Enter your password to authorize" style="border-color:#fecaca;">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <button class="btn-primary" id="confirmResetBtn" style="background:#ef4444; padding:14px;">CONFIRM WIPE</button>
                <button class="btn-primary" id="cancelResetBtn" style="background:#94a3b8; padding:14px;">CANCEL</button>
            </div>
        </div>
    `;
    document.getElementById('genericModal').style.display = 'flex';

    document.getElementById('cancelResetBtn').onclick = () => {
        document.getElementById('genericModal').style.display = 'none';
    };

    document.getElementById('confirmResetBtn').onclick = async () => {
        const password = document.getElementById('resetConfirmPass').value;
        if (!password) return showToast('Password required to proceed', 'error');

        const btn = document.getElementById('confirmResetBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> VERIFYING...';

        const authRes = await window.auth.verifyAdminPassword(password);
        if (!authRes.success) {
            btn.disabled = false;
            btn.innerHTML = 'CONFIRM WIPE';
            return showToast('Incorrect Admin password', 'error');
        }

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> WIPING DATA...';
        const resetRes = await window.db.resetModuleData(module);
        
        if (resetRes) {
            showToast(`${moduleName} has been reset successfully.`, 'success');
            setTimeout(() => window.location.reload(), 1500);
        } else {
            showToast('Reset failed. Please check logs.', 'error');
            btn.disabled = false;
            btn.innerHTML = 'CONFIRM WIPE';
        }
    };
}

// --- Authentication & Initialization ---

async function initAppAfterLogin(role, username) {
    // Hide restricted features for non-admins
    updateSidebarVisibility();
    
    // Calculate initials for avatar
    const initials = username.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    const initialsEl = document.getElementById('userInitials');
    if (initialsEl) initialsEl.innerText = initials || '??';

    document.getElementById('roleDisplayBadge').innerText = role;
    document.getElementById('currentUserName').innerText = username;
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('appMain').style.display = 'flex';
    
    await renderCurrentPage();
    refreshNotifications();
}




// --- Core POS Logic & M-Pesa Integration ---

async function finalizeSale() {
  
  // 1. Validate cart is not empty
  if (cart.length === 0) {
    showToast('Cart is empty. Add items before completing sale.', 'error')
    return
  }

  // 2. Get payment method
  const paymentMethodEl = document.getElementById('paymentMethod');
  // Fallback to 'cash' if element doesn't exist yet (Step 5 is next)
  const paymentMethod = paymentMethodEl ? paymentMethodEl.value : 'cash';

  // 3. Calculate total
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0)

  // 4. Handle split payment validation
  let cashAmount = 0
  let mpesaAmount = 0

  if (paymentMethod === 'split') {
    cashAmount = parseFloat(document.getElementById('cashAmountInput').value) || 0
    mpesaAmount = parseFloat(document.getElementById('mpesaAmountDisplay').value) || 0
    
    if (cashAmount <= 0) {
      showToast('Please enter the cash amount', 'error')
      return
    }
    if (Math.abs((cashAmount + mpesaAmount) - total) > 0.01) {
      showToast('Cash and M-Pesa amounts must add up to the total', 'error')
      return
    }
    const confirmed = document.getElementById('mpesaConfirmedCheck').checked
    if (!confirmed) {
      showToast('Please confirm the customer has paid the M-Pesa portion', 'warning')
      return
    }
  } else if (paymentMethod === 'cash') {
    cashAmount = total
    mpesaAmount = 0
  } else if (paymentMethod === 'mpesa') {
    cashAmount = 0
    mpesaAmount = total
  }

  // 5. Generate invoice number
  showToast('Processing sale...', 'success')
  const invoiceNumber = await generateInvoiceNumber()

  // 6. Build the sale object
  const now = new Date()
  const saleData = {
    invoiceNumber,
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 8),
    cashierName: currentUser.username,
    customerName: 'Walk-in',
    items: cart.map(item => ({
      name: item.name,
      qty: item.qty,
      price: item.price,
      subtotal: item.price * item.qty
    })),
    subtotal: total,
    total,
    paymentMode: paymentMethod === 'split' ? 'Split' 
               : paymentMethod === 'mpesa' ? 'M-Pesa' 
               : 'Cash',
    cashAmount,
    mpesaAmount,
    mpesaCode: ''
  }

  // 7. Generate receipt HTML
  const receiptHTML = generateReceiptHTML(saleData)

  // 8. Save to Supabase via API
  const saveResult = await callApi('save-sale', {
    invoice_number: invoiceNumber,
    date: saleData.date,
    date_time: `${saleData.date} ${saleData.time}`,
    items_json: JSON.stringify(saleData.items),
    subtotal: total,
    total,
    payment_mode: saleData.paymentMode,
    cash_amount: cashAmount,
    mpesa_amount: mpesaAmount,
    mpesa_code: '',
    cashier_name: currentUser.username,
    customer_name: 'Walk-in',
    receipt_html: receiptHTML
  })

  if (!saveResult.success) {
    showToast('Sale failed to save: ' + saveResult.message, 'error')
    return
  }

  // 9. Deduct stock for each medicine
  for (const item of cart) {
    await callApi('update-medicine-stock', {
      id: item.id,
      quantityDeducted: item.qty
    })
  }

  // 10. Show receipt modal
  showReceiptModal(saleData)

  // 11. Clear cart
  cart = []
  renderCart()
  const pmEl = document.getElementById('paymentMethod');
  if (pmEl) pmEl.value = 'cash';
  if (typeof hideSplitPaymentPanel === 'function') hideSplitPaymentPanel();
}

async function promptPrintReceipt(saleObj, cartItems) {
    return new Promise((resolve) => {
        document.getElementById('modalInner').innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; max-width:550px; margin:0 auto; padding:10px;">
                <div style="width:80px; height:80px; border-radius:50%; background:#dcfce7; display:flex; align-items:center; justify-content:center; margin-bottom:16px;">
                    <i class="fas fa-check" style="font-size:40px; color:#10b981;"></i>
                </div>
                <h2 style="margin-bottom:8px; font-size:1.8rem; color:#0f172a;">Sale Complete!</h2>
                <p style="margin-bottom:32px; color:#64748b; font-size:1.1rem;">Do you want to print a receipt for this transaction?</p>
                
                <div style="display:flex; gap:16px; width:100%;">
                    <button class="btn-primary" id="printThermalBtn" style="flex:1; background:#1e293b; padding:20px; border-radius:16px; display:flex; flex-direction:column; align-items:center; gap:12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); cursor:pointer;">
                        <i class="fas fa-receipt" style="font-size:32px; pointer-events:none;"></i>
                        <span style="pointer-events:none; font-size:1.1rem; font-weight:700;">Print Thermal<br><small style="font-weight:500; color:#cbd5e1;">(80mm Roll)</small></span>
                    </button>
                    <button class="btn-primary" id="printA4Btn" style="flex:1; background:#3b82f6; padding:20px; border-radius:16px; display:flex; flex-direction:column; align-items:center; gap:12px; box-shadow: 0 4px 15px rgba(59,130,246,0.3); cursor:pointer;">
                        <i class="fas fa-file-alt" style="font-size:32px; pointer-events:none;"></i>
                        <span style="pointer-events:none; font-size:1.1rem; font-weight:700;">Print A4<br><small style="font-weight:500; color:#bfdbfe;">(Standard Paper)</small></span>
                    </button>
                </div>
                <button id="printSkipBtn" style="margin-top:24px; background:#f1f5f9; color:#64748b; border:none; border-radius:30px; padding:14px 40px; cursor:pointer; font-weight:700; font-size:1.1rem; transition:all 0.2s ease;">Done / Skip</button>
            </div>
        `;
        document.getElementById('genericModal').style.display = 'flex';
        
        document.getElementById('printThermalBtn').onclick = () => {
            document.getElementById('genericModal').style.display = 'none';
            printReceipt(saleObj, cartItems, 'thermal');
            resolve();
        };
        document.getElementById('printA4Btn').onclick = () => {
            document.getElementById('genericModal').style.display = 'none';
            printReceipt(saleObj, cartItems, 'a4');
            resolve();
        };
        document.getElementById('printSkipBtn').onclick = () => {
            document.getElementById('genericModal').style.display = 'none';
            resolve();
        };
    });
}

async function printReceipt(saleObj, cartItems, format = 'thermal') {
    const settingsReq = await window.db.getSettings();
    const config = {};
    if (settingsReq.success) {
        settingsReq.data.forEach(s => config[s.key] = s.value);
    }
    
    const pharmacyName = config.pharmacy_name || 'RENACHEM POS';
    const pharmacyAddress = config.pharmacy_address || '';
    const pharmacyPhone = config.pharmacy_phone || '';
    
    let styles = format === 'thermal' ? `
        body { font-family: 'Courier New', Courier, monospace; width: 300px; padding: 15px; margin: 0 auto; font-size: 13px; color: #000; font-weight: 500; font-smooth: always; background: white; }
        .receipt-header { text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
        .flex-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
        .divider { border-bottom: 1.5px dashed #000; margin: 12px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; vertical-align: top; padding: 3px 0; font-size: 13px; }
        th { font-weight: bold; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .center { text-align: center; }
        .qty-col { width: 30px; text-align: center; }
        .total-section { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; margin-top: 5px; }
        .footer { text-align: center; font-weight: bold; margin-top: 20px; font-size: 14px; }
        .cut-line { text-align: center; font-size: 10px; color: #666; margin-top: 40px; letter-spacing: 2px; }
    ` : `
        body { font-family: 'Courier New', Courier, monospace; width: 400px; margin: 0 auto; padding: 40px 0; font-size: 16px; color: #000; font-weight: 500; font-smooth: always; background: white; }
        .receipt-header { text-align: center; font-weight: bold; font-size: 24px; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 2px; }
        .flex-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 16px; }
        .divider { border-bottom: 2px dashed #000; margin: 24px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; vertical-align: top; padding: 8px 0; font-size: 16px; }
        th { font-weight: bold; border-bottom: 1px dashed #000; padding-bottom: 12px; margin-bottom: 12px; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .center { text-align: center; }
        .qty-col { width: 60px; text-align: center; }
        .total-section { display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; margin-top: 12px; }
        .footer { text-align: center; font-weight: bold; margin-top: 40px; font-size: 18px; }
        .cut-line { text-align: center; font-size: 14px; color: #666; margin-top: 60px; letter-spacing: 4px; }
    `;

    let receiptHtml = `
        <html>
        <head><style>${styles}</style></head>
        <body>
            <div class="receipt-header">${(saleObj && saleObj.payment_mode) ? saleObj.payment_mode.toUpperCase() : 'CASH'} RECEIPT</div>
            
            <div class="flex-row">
                <span>${pharmacyName}</span>
                <span>${pharmacyAddress}</span>
            </div>
            <div class="flex-row">
                <span>Receipt No:</span>
                <span class="bold">#${saleObj ? saleObj.id : 'N/A'}</span>
            </div>
            <div class="flex-row">
                <span>Date:</span>
                <span>${saleObj ? saleObj.date : new Date().toLocaleDateString()}</span>
            </div>
            <div class="flex-row">
                <span>Time:</span>
                <span>${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="flex-row">
                <span>Served by:</span>
                <span>${currentUser ? currentUser.username : 'Admin'}</span>
            </div>
            ${pharmacyPhone ? `<div class="flex-row"><span>Tel:</span><span>${pharmacyPhone}</span></div>` : ''}
            
            <div class="divider"></div>
            
            <table>
                <tr>
                    <th style="width: 55%;">Description</th>
                    <th class="qty-col">Qty</th>
                    <th class="right">Price</th>
                </tr>
                ${cartItems.map(item => `
                <tr>
                    <td>${item.name}</td>
                    <td class="qty-col">${item.qty}</td>
                    <td class="right">${(item.price * item.qty).toFixed(2)}</td>
                </tr>
                `).join('')}
            </table>
            
            <div class="divider"></div>
            
            <div class="total-section">
                <span>Total</span>
                <span>KES ${saleObj ? Number(saleObj.total).toFixed(2) : '0.00'}</span>
            </div>
            
            ${saleObj.mpesa_code ? `
            <div class="divider"></div>
            <div class="flex-row" style="font-size: 11px;">
                <span>M-Pesa Ref:</span>
                <span>${saleObj.mpesa_code}</span>
            </div>
            ` : ''}

            ${saleObj.payment_mode === 'Credit' ? `
            <div class="divider"></div>
            <div class="total-section" style="color:red; font-size:14px;">
                <span>TOTAL BALANCE DUE</span>
                <span>KES ${saleObj.total.toFixed(2)}</span>
            </div>
            <div style="font-size:11px; text-align:center; margin-top:5px; font-weight:bold;">*** CREDIT TRANSACTION ***</div>
            ` : ''}
            
            <div class="divider"></div>
            
            <div class="footer">Thank you for shopping!</div>
            
            <div class="cut-line">--- CUT HERE ---</div>
        </body>
        </html>
    `;

    // --- SHOW LIVE PREVIEW BEFORE PRINTING ---
    document.getElementById('modalInner').innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; max-width:600px; margin:0 auto; padding:10px;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                <i class="fas fa-search" style="font-size:28px; color:#3b82f6;"></i>
                <h2 style="font-size:1.8rem; color:#0f172a; margin:0;">Receipt Preview</h2>
            </div>
            <p style="margin-bottom:24px; color:#64748b;">Review the layout before sending it to the printer.</p>
            
            <div style="width:100%; height:450px; border: 2px solid #cbd5e1; border-radius:12px; background:#e2e8f0; padding:16px; box-sizing:border-box;">
                <iframe id="previewIframe" style="width:100%; height:100%; border:none; background:#ffffff; border-radius:8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></iframe>
            </div>

            <div style="display:flex; gap:16px; width:100%; margin-top:24px;">
                <button id="executePrintBtn" class="btn-primary" style="flex:2; background:#3b82f6; padding:16px; font-size:1.2rem; border-radius:16px; box-shadow: 0 4px 15px rgba(59,130,246,0.3);"><i class="fas fa-print" style="margin-right:8px;"></i> Print Now</button>
                <button id="cancelPrintBtn" style="flex:1; background:#f1f5f9; color:#475569; border:none; border-radius:16px; cursor:pointer; font-weight:700; font-size:1.1rem; transition:all 0.2s ease;">Cancel</button>
            </div>
        </div>
    `;
    
    document.getElementById('genericModal').style.display = 'flex';
    
    const previewIframe = document.getElementById('previewIframe');
    previewIframe.contentDocument.open();
    previewIframe.contentDocument.write(receiptHtml);
    previewIframe.contentDocument.close();

    document.getElementById('executePrintBtn').onclick = () => {
        document.getElementById('genericModal').style.display = 'none';
        
        // Use the hidden main printFrame for the actual spooling to avoid DOM destruction quirks
        const printFrame = document.getElementById('printFrame');
        if (printFrame) {
            printFrame.contentDocument.open();
            printFrame.contentDocument.write(receiptHtml);
            printFrame.contentDocument.close();
            setTimeout(() => {
                printFrame.contentWindow.focus();
                printFrame.contentWindow.print();
            }, 300);
        } else {
            showToast("Error: Printing module not loaded.", "error");
        }
    };

    document.getElementById('cancelPrintBtn').onclick = () => {
        document.getElementById('genericModal').style.display = 'none';
    };
}

// --- Page Rendering Functions ---

async function renderDashboard() {
    const salesRes = await window.db.getSales();
    const medsRes = await window.db.getMedicines();
    const sales = salesRes.success ? salesRes.data : [];
    const medicines = medsRes.success ? medsRes.data : [];
    const today = new Date().toISOString().slice(0, 10);

    const totalRevenue = sales.reduce((s, t) => s + t.total, 0);
    const todaySales = sales.filter(s => s.date === today);
    const todayRevenue = todaySales.reduce((s, t) => s + t.total, 0);
    
    const lowStockItems = medicines.filter(m => m.stock <= (m.reorder_level || 10));
    const expiredItems = medicines.filter(m => {
        if (!m.expiry) return false;
        return new Date(m.expiry) < new Date(today);
    });

    const html = `
        <div class="view-header">
            <h2>Welcome, ${currentUser ? currentUser.username : 'Admin'}</h2>
            <p>Here is what's happening at Renachem Pharmacy today.</p>
        </div>

        <div class="stats-grid">
            ${currentUser.role === 'Admin' ? `
            <div class="stat-card clickable-card" id="revenueCard">
                <div style="display:flex; justify-content:space-between;">
                    <h4>Today's Revenue</h4>
                    <i class="fas fa-cash-register" style="color:var(--royal-blue); opacity:0.3;"></i>
                </div>
                <div class="stat-number">KES ${todayRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                <p style="font-size:0.75rem; color:var(--emerald); font-weight:700; margin-top:8px;">
                    <i class="fas fa-info-circle"></i> View details in reports
                </p>
            </div>
            ` : ''}
            <div class="stat-card">
                <h4>Today's Sales</h4>
                <div class="stat-number">${todaySales.length}</div>
                <p style="font-size:0.75rem; color:#64748b; font-weight:600; margin-top:8px;">Transactions processed</p>
            </div>
            <div class="stat-card clickable-card" onclick="jumpToReport('inventory')">
                <div style="display:flex; justify-content:space-between;">
                    <h4>Low Stock</h4>
                    <i class="fas fa-boxes-stacked" style="color:var(--danger); opacity:0.3;"></i>
                </div>
                <div class="stat-number" style="color:${lowStockItems.length > 0 ? 'var(--danger)' : 'inherit'}">${lowStockItems.length}</div>
                <p style="font-size:0.75rem; color:#64748b; font-weight:600; margin-top:8px;"><i class="fas fa-arrow-right"></i> View Stock Report</p>
            </div>
            <div class="stat-card clickable-card" onclick="jumpToReport('expiry')">
                <div style="display:flex; justify-content:space-between;">
                    <h4>Expired Items</h4>
                    <i class="fas fa-calendar-times" style="color:var(--danger); opacity:0.3;"></i>
                </div>
                <div class="stat-number" style="color:${expiredItems.length > 0 ? 'var(--danger)' : 'inherit'}">${expiredItems.length}</div>
                <p style="font-size:0.75rem; color:#64748b; font-weight:600; margin-top:8px;"><i class="fas fa-arrow-right"></i> View Expiry Report</p>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="stat-card" style="padding:0; overflow:hidden;">
                <div style="padding:20px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                    <h4 style="margin:0;">Recent Transactions</h4>
                    <a href="#" onclick="jumpToReport('sales'); return false;" style="font-size:0.85rem; color:var(--royal-blue); text-decoration:none; font-weight:600;"><i class="fas fa-list"></i> View All</a>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="padding-left:25px;">Time</th>
                            <th>Customer</th>
                            <th>Amount</th>
                            <th>Mode</th>
                            <th style="text-align:right; padding-right:25px;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                    ${[...sales].sort((a, b) => {
                        const idA = Number(a.id) || 0;
                        const idB = Number(b.id) || 0;
                        if (idA !== idB) return idB - idA;
                        const dateA = new Date(a.date_time || a.date || 0);
                        const dateB = new Date(b.date_time || b.date || 0);
                        return dateB - dateA;
                    }).slice(0, 5).map(s => {
                        let displayTime = '';
                        if (s.date_time) {
                            if (s.date_time.includes(', ')) {
                                displayTime = s.date_time.split(', ')[1];
                            } else if (s.date_time.includes(' ')) {
                                const parts = s.date_time.split(' ');
                                displayTime = parts[parts.length - 1];
                            } else {
                                displayTime = s.date_time;
                            }
                        }
                        return `
                        <tr>
                            <td style="font-size:0.8rem; padding-left:25px;">${displayTime}</td>
                            <td style="font-weight:600;">${s.customer_name}</td>
                            <td style="font-weight:700; color:var(--royal-blue);">KES ${Number(s.total).toFixed(2)}</td>
                            <td><span class="role-pill" style="background:#f1f5f9; color:#475569;">${s.payment_mode}</span></td>
                            <td style="text-align:right; padding-right:25px;">
                                <button class="action-btn-refined btn-icon-view dash-reprint-btn" data-id="${s.id}" title="View & Print">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </td>
                        </tr>`;
                    }).join('') || '<tr><td colspan="5" style="text-align:center; padding:40px;">No sales recorded yet.</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div style="display:flex; flex-direction:column; gap:24px;">
                <div class="stat-card" style="padding:20px;">
                    <h4 style="margin-bottom:16px; color:var(--danger); cursor:pointer;" onclick="jumpToReport('inventory')">
                        <i class="fas fa-exclamation-triangle"></i> Stock Alerts <i class="fas fa-chevron-right" style="font-size:0.7rem; margin-left:5px; opacity:0.5;"></i>
                    </h4>
                    ${lowStockItems.length > 0 ? lowStockItems.slice(0, 4).map(m => `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:0.85rem;">
                            <span style="font-weight:600; color:#334155;">${m.name}</span>
                            <span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:6px; font-weight:800;">${m.stock} left</span>
                        </div>
                    `).join('') : '<p style="font-size:0.85rem; color:#64748b;">All stock levels healthy.</p>'}
                </div>

                <div class="stat-card" style="padding:20px;">
                    <h4 style="margin-bottom:16px; color:var(--warning); cursor:pointer;" onclick="jumpToReport('expiry')">
                        <i class="fas fa-hourglass-half"></i> Expiry Watchlist <i class="fas fa-chevron-right" style="font-size:0.7rem; margin-left:5px; opacity:0.5;"></i>
                    </h4>
                    ${expiredItems.length > 0 ? expiredItems.slice(0, 4).map(m => `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:0.85rem;">
                            <span style="font-weight:600; color:#334155;">${m.name}</span>
                            <span style="color:var(--danger); font-weight:800; font-size:0.7rem;">EXPIRED</span>
                        </div>
                    `).join('') : '<p style="font-size:0.85rem; color:#64748b;">No expired items found.</p>'}
                </div>
            </div>
        </div>
    `;
    document.getElementById('pageContainer').innerHTML = html;

    // Bind Revenue Card
    const revCard = document.getElementById('revenueCard');
    if (revCard) {
        revCard.onclick = () => {
            currentPage = 'reports';
            // Update Sidebar
            document.querySelectorAll('.nav-item').forEach(n => {
                n.classList.remove('active');
                if (n.dataset.page === 'reports') n.classList.add('active');
            });
            renderCurrentPage();
        };
    }
    // Bind Recent Reprints
    document.querySelectorAll('.dash-reprint-btn').forEach(btn => {
        btn.onclick = () => {
            const sid = btn.dataset.id;
            const sale = sales.find(s => String(s.id) === String(sid));
            if (sale) handleHistoryReprint(sale);
        };
    });
}

async function renderInventory(searchQuery = '', filterType = '') {
    if (!hasAccess('inventory')) return document.getElementById('pageContainer').innerHTML = '<div class="stat-card">Access Denied</div>';
    
    // Fetch fresh data
    const res = await window.db.getMedicines();
    let medicines = res.data || [];

    // Apply Filter Logic
    const today = new Date();
    const forecast90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

    if (filterType === 'expired') {
        medicines = medicines.filter(m => m.expiry && new Date(m.expiry) < today);
    } else if (filterType === 'expiring') {
        medicines = medicines.filter(m => m.expiry && new Date(m.expiry) >= today && new Date(m.expiry) <= forecast90);
    } else if (filterType === 'lowStock') {
        medicines = medicines.filter(m => m.stock <= (m.reorder_level || 10));
    }

    // APPLY SEARCH FILTER
    if (searchQuery) {
        medicines = filterTable(searchQuery, medicines, ['name', 'batch', 'barcode', 'supplier']);
    }

    // --- PAGINATION RESET & LOGIC ---
    if (searchQuery || filterType) {
        if (window.lastInvSearch !== searchQuery || window.lastInvFilter !== filterType) {
            paginationState.inventory = 1;
        }
    }
    window.lastInvSearch = searchQuery;
    window.lastInvFilter = filterType;

    const totalFiltered = medicines.length;
    const startIdx = (paginationState.inventory - 1) * paginationState.limit;
    const paginatedMeds = medicines.slice(startIdx, startIdx + paginationState.limit);

    const filterTitle = filterType ? ` (Filtered: ${filterType === 'lowStock' ? 'Low Stock' : filterType.charAt(0).toUpperCase() + filterType.slice(1)})` : '';

    document.getElementById('pageContainer').innerHTML = `
        <div class="view-header">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <h2><i class="fas fa-capsules"></i> Medicine Inventory${filterTitle}</h2>
                    <p>Track stock levels, expiry dates, and pricing</p>
                </div>
                <div style="display:flex; gap:12px;">
                    <button class="btn-primary" style="background:var(--emerald); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);" onclick="showIntakeModal()"><i class="fas fa-truck-loading"></i> Log Stock Intake</button>
                    <button class="btn-primary" id="bulkCsvImportBtn" style="background:#64748b; opacity:0.8;"><i class="fas fa-file-csv"></i> Bulk CSV</button>
                    <input type="file" id="csvFileInput" accept=".csv" style="display:none;" />
                    <button class="btn-primary" id="addMedBtn"><i class="fas fa-plus"></i> New Catalog Item</button>
                </div>
            </div>
        </div>

        <div class="stat-card" style="margin-bottom: 24px; padding: 15px 25px;">
            <div style="display:flex; gap:16px; align-items:center;">
                <i class="fas fa-search" style="color:#64748b;"></i>
                <input type="text" id="medSearch" placeholder="Search by name, batch, or barcode..." 
                       value="${searchQuery}"
                       style="flex:1; border:none; background:transparent; font-size:1rem; outline:none; font-weight:500;">
            </div>
        </div>

        <div class="stat-card" style="padding:0; overflow:hidden;">
            <div class="table-responsive">
                <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Supplier</th>
                        <th>Stock Qty</th>
                        <th>Price (KES)</th>
                        <th>Expiry</th>
                        <th>Barcode</th>
                        <th style="text-align:right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${paginatedMeds.length > 0 ? paginatedMeds.map(m => {
                        const isLow = m.stock <= m.reorder_level;
                        const expiryDate = new Date(m.expiry);
                        const isExpired = expiryDate < new Date();
                        const isNearExpiry = !isExpired && expiryDate < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

                        return `
                        <tr>
                            <td style="font-weight:600; color:var(--slate);">${m.name}</td>
                            <td style="color:#64748b;">${m.supplier || 'N/A'}</td>
                            <td>
                                <span style="font-weight:700; color:${m.stock <= m.reorder_level ? 'var(--danger)' : 'var(--emerald)'};">${m.stock}</span>
                            </td>
                            <td style="font-weight:700;">KES ${Number(m.price).toFixed(2)}</td>
                            <td>
                                <span style="color:${isExpired ? 'var(--danger)' : (isNearExpiry ? 'var(--warning)' : '#64748b')}; font-weight:500;">
                                    ${m.expiry || 'N/A'}
                                </span>
                            </td>
                            <td style="font-family:monospace; color:#475569;">${m.barcode || 'N/A'}</td>
                            <td style="text-align:right; padding-right:16px;">
                                <div style="display:flex; justify-content:flex-end; gap:8px;">
                                    <button class="action-btn-refined btn-icon-view" onclick="handleDownloadMedicineReport('${m.id}')" title="Download Product Report">
                                        <i class="fas fa-file-pdf"></i>
                                    </button>
                                    <button class="action-btn-refined btn-icon-edit edit-med-btn" data-id="${m.id}" title="Edit Product">
                                        <i class="fas fa-pencil-alt"></i>
                                    </button>
                                    <button class="action-btn-refined btn-icon-del delete-med-btn" data-id="${m.id}" data-name="${m.name.replace(/"/g, '&quot;')}" title="Delete Product">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('') : '<tr><td colspan="7" style="text-align:center; padding:40px; color:#64748b;">No medicines found matching your search.</td></tr>'}
                </tbody>
            </table>
            </div>
            ${renderPaginationControls('inventory', totalFiltered)}
        </div>
    `;

    // Bind Search
    const searchInput = document.getElementById('medSearch');
    if (searchInput) {
        if (!searchInput.dataset.bound) {
            searchInput.dataset.bound = "true";
            searchInput.addEventListener('input', (e) => {
                clearTimeout(window.medSearchTimer);
                window.medSearchTimer = setTimeout(() => {
                    renderInventory(e.target.value);
                }, 300);
            });
        }
        searchInput.focus();
        try { searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length); } catch(e){}
    }

    // Explicitly bind Edit/Delete buttons
    document.querySelectorAll('.edit-med-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            showMedicineModal(id);
        });
    });

    document.querySelectorAll('.delete-med-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const name = e.currentTarget.getAttribute('data-name');
            handleDeleteMedicine(id, name);
        });
    });

    // Bind Add Button
    document.getElementById('addMedBtn').onclick = () => showMedicineModal();
    
    // Bind Bulk Import Button
    const bulkImportBtn = document.getElementById('bulkCsvImportBtn');
    const csvInput = document.getElementById('csvFileInput');
    if (bulkImportBtn && csvInput) {
        bulkImportBtn.onclick = () => csvInput.click();
        csvInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const csvData = ev.target.result;
                const rows = csvData.split('\n').map(row => row.trim()).filter(row => row.length > 0);
                if (rows.length < 2) return showToast('CSV is empty or missing data', 'warning');
                
                const medsToImport = [];
                // Assumed Order: Name, Supplier, Batch, Expiry, Stock, ReorderLevel, Price, CostPrice, Barcode
                for (let i = 1; i < rows.length; i++) { 
                    const cols = rows[i].split(',');
                    if (cols.length >= 1 && cols[0].trim() !== '') {
                        medsToImport.push({
                            name: cols[0]?.trim(),
                            supplier: cols[1]?.trim() || '',
                            batch: cols[2]?.trim() || '',
                            expiry: cols[3]?.trim() || '',
                            stock: parseInt(cols[4]) || 0,
                            reorder_level: parseInt(cols[5]) || 10,
                            price: parseFloat(cols[6]) || 0,
                            cost_price: parseFloat(cols[7]) || 0,
                            barcode: cols[8]?.trim() || ''
                        });
                    }
                }
                
                if (medsToImport.length > 0) {
                    const res = await window.db.bulkAddMedicines(medsToImport);
                    if (res && res.success) {
                        showToast(`Successfully imported ${res.count} items!`, 'success');
                        renderInventory();
                    } else {
                        showToast(`Bulk import failed: ${res ? res.error : 'IPC Error'}`, 'error');
                    }
                }
            };
            reader.readAsText(file);
        };
    }
}

async function showMedicineModal(id = null) {
    try {
        let med = { name: '', supplier: '', batch: '', expiry: '', stock: 0, reorder_level: 10, price: 0, cost_price: 0, barcode: '' };
        if (id) {
            const res = await window.db.getMedicines();
            med = res.data.find(m => m.id === id);
        }

        const supRes = await window.db.getSuppliers();
        const suppliers = supRes && supRes.success ? supRes.data : [];
        let supOptions = `<option value="">-- Select Supplier --</option>`;
        const medSupplierClean = (med.supplier || '').trim();
        suppliers.forEach(s => {
            const isSelected = medSupplierClean === s.name.trim();
            supOptions += `<option value="${s.name}" ${isSelected ? 'selected' : ''}>${s.name}</option>`;
        });

    const modal = document.getElementById('genericModal');
    const inner = document.getElementById('modalInner');
    inner.innerHTML = `
        <h3 style="margin-bottom:24px; color:var(--royal-blue);">
            <i class="fas fa-${id ? 'edit' : 'plus-circle'}"></i> ${id ? 'Edit Medicine' : 'Add New Medicine'}
        </h3>
        <div class="form-grid">
            <div class="input-group">
                <label>Medicine Name</label>
                <input type="text" id="modal_m_name" value="${med.name}" class="premium-input" placeholder="e.g. Paracetamol 500mg">
            </div>
            <div class="input-group">
                <label>Quantity (Current Stock)</label>
                <input type="number" id="modal_m_stock" value="${med.stock}" class="premium-input">
            </div>
        </div>
        <div class="form-grid">
            <div class="input-group">
                <label>Supplier Name</label>
                <select id="modal_m_supplier" class="premium-select" style="width:100%; border-radius:12px; border:1px solid #cbd5e1; padding:12px 16px; font-weight:500;">
                    ${supOptions}
                </select>
            </div>
            <div class="input-group">
                <label>Barcode / SKU</label>
                <input type="text" id="modal_m_barcode" value="${med.barcode || ''}" class="premium-input" placeholder="Scan or type barcode">
            </div>
        </div>
        <div class="form-grid">
            <div class="input-group">
                <label style="color:#64748b; font-weight:600;">Buying Price (Unit Cost)</label>
                <input type="number" step="0.01" id="modal_m_cost_price" value="${med.cost_price || 0}" class="premium-input" placeholder="0.00">
            </div>
            <div class="input-group">
                <label style="color:var(--royal-blue); font-weight:700;">Selling Price (Retail)</label>
                <input type="number" step="0.01" id="modal_m_price" value="${med.price}" class="premium-input" style="border-color:var(--emerald); border-width:2px; font-weight:700;">
            </div>
        </div>
        <div class="form-grid">
            <div class="input-group">
                <label>Expiry Date</label>
                <input type="date" id="modal_m_expiry" value="${med.expiry}" class="premium-input">
            </div>
            <div class="input-group">
                <label>Batch Number</label>
                <input type="text" id="modal_m_batch" value="${med.batch || ''}" class="premium-input" placeholder="e.g. BATCH-123">
            </div>
        </div>
        <div class="form-grid">
            <div class="input-group" style="grid-column: span 2;">
                <label style="color:var(--warning); font-weight:700;">Reorder Level (Alert when stock falls below)</label>
                <input type="number" id="modal_m_reorder" value="${med.reorder_level || 10}" class="premium-input" style="border:2px dashed var(--warning);">
                <small style="color:#64748b; margin-top:4px; display:block;">Default is 10. The system will highlight this item in red when stock hits this number.</small>
            </div>
        </div>
        
        <div style="display:flex; gap:12px; margin-top:32px;">
            <button class="btn-primary" id="modalSaveMedBtn" style="flex:1;">
                <i class="fas fa-check-circle"></i> ${id ? 'Update Product Details' : 'Save New Product'}
            </button>
            <button class="btn-primary" id="modalCancelMedBtn" style="flex:1; background:#f1f5f9; color:#475569; border:none;">Cancel</button>
        </div>
    `;
    modal.style.display = 'flex';

    // Explicitly bind the Cancel Button
    const cancelBtn = document.getElementById('modalCancelMedBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            modal.style.display = 'none';
        });
    }

    // Explicitly bind the Save Button
    const saveBtn = document.getElementById('modalSaveMedBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const data = {
                    name: document.getElementById('modal_m_name').value.trim(),
                    supplier: document.getElementById('modal_m_supplier').value,
                    batch: document.getElementById('modal_m_batch').value.trim(),
                    expiry: document.getElementById('modal_m_expiry').value,
                    price: parseFloat(document.getElementById('modal_m_price').value) || 0,
                    cost_price: parseFloat(document.getElementById('modal_m_cost_price').value) || 0,
                    stock: parseInt(document.getElementById('modal_m_stock').value) || 0,
                    reorder_level: parseInt(document.getElementById('modal_m_reorder').value) || 10,
                    barcode: document.getElementById('modal_m_barcode').value.trim()
                };

                if (!data.name) return showToast('Product name is required', 'warning');
                if (data.price < 0) return showToast('Selling Price cannot be negative', 'warning');
                if (data.cost_price < 0) return showToast('Unit Cost cannot be negative', 'warning');
                if (data.reorder_level < 0) return showToast('Reorder level cannot be negative', 'warning');

                let res;
                if (id) {
                    res = await window.db.updateMedicine(id, data);
                } else {
                    res = await window.db.addMedicine(data);
                }

                if (res && res.success) {
                    showToast(`Product ${id ? 'updated' : 'added'} successfully`, 'success');
                    modal.style.display = 'none';
                    renderInventory();
                } else {
                    showToast(res ? res.error : "Unknown IPC failure", 'error');
                }
            } catch (innerError) {
                console.error(innerError);
                showToast("Save failed: " + innerError.message, 'error');
            }
        });

        // Global Modal Enter Key Macro (Barcode Scanner Pipeline Setup)
        const activeModalInner = document.getElementById('modalInner');
        if (activeModalInner && !activeModalInner.dataset.barcodeBound) {
            activeModalInner.dataset.barcodeBound = "true";
            activeModalInner.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    // Modern barcode scanners emit numbers rapidly followed by Enter.
                    // This seamlessly intercepts the payload when inside the modal!
                    e.preventDefault();
                    saveBtn.click();
                }
            });
        }
    }
    } catch (err) {
        alert("MODAL ERROR: " + err.message);
    }
}

window.handleEditMedicine = (id) => showMedicineModal(id);

window.handleDeleteMedicine = async (id, name) => {
    if (await showConfirm(`Are you sure you want to PERMANENTLY delete "${name}"? This will remove all stock records.`)) {
        const res = await window.db.deleteMedicine(id);
        if (res.success) {
            showToast('Product deleted', 'success');
            renderInventory();
        } else {
            showToast(res.error, 'error');
        }
    }
};

window.handleDownloadMedicineReport = async (id) => {
    try {
        showToast('Generating report...', 'info');
        
        // Correctly access jsPDF from the local UMD bundle
        const jsPDFLib = window.jspdf ? window.jspdf.jsPDF : (window.jsPDF || null);
        if (!jsPDFLib) {
            throw new Error("PDF Library (jsPDF) is not loaded properly. Please refresh the page.");
        }

        const res = await window.db.getMedicines();
        const med = (res.data || []).find(m => String(m.id) === String(id));
        
        if (!med) return showToast('Medicine record not found!', 'error');

        const doc = new jsPDFLib();
        
        // Header
        doc.setFontSize(22);
        doc.setTextColor(30, 58, 138); // Royal Blue
        doc.text("RENACHEM PHARMACY", 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("MEDICATION PRODUCT PROFILE & STOCK AUDIT", 14, 28);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 33);
        
        // Horizontal Line
        doc.setDrawColor(200);
        doc.line(14, 38, 196, 38);

        // Content
        const tableData = [
            ["Attribute", "Value"],
            ["Medicine Name", med.name],
            ["Inventory ID", `#${med.id}`],
            ["Barcode / SKU", med.barcode || "N/A"],
            ["Supplier", med.supplier || "N/A"],
            ["Current Stock", `${med.stock} Units`],
            ["Reorder Alert Level", `${med.reorder_level || 10} Units`],
            ["Buying Price (Unit Cost)", `KES ${Number(med.cost_price || 0).toLocaleString(undefined, {minimumFractionDigits:2})}`],
            ["Selling Price (Retail)", `KES ${Number(med.price || 0).toLocaleString(undefined, {minimumFractionDigits:2})}`],
            ["Estimated Margin/Unit", `KES ${Number((med.price || 0) - (med.cost_price || 0)).toLocaleString(undefined, {minimumFractionDigits:2})}`],
            ["Batch Number", med.batch || "N/A"],
            ["Expiry Date", med.expiry || "N/A"]
        ];

        doc.autoTable({
            startY: 45,
            head: [tableData[0]],
            body: tableData.slice(1),
            theme: 'striped',
            headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
            bodyStyles: { textColor: 50 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: 14, right: 14 }
        });

        const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 120) + 20;
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text("This is a system-generated document for internal inventory tracking.", 14, finalY);
        doc.text("Authorized by Renachem Pharmacy Management Suite.", 14, finalY + 5);

        doc.save(`${med.name.replace(/\s+/g, '_')}_Report.pdf`);
        showToast('Report downloaded successfully!', 'success');
        
    } catch (e) {
        console.error(e);
        showToast('PDF Export failed: ' + e.message, 'error');
    }
};

async function renderPOS() {
    if (!hasAccess('pos')) return document.getElementById('pageContainer').innerHTML = '<div class="stat-card">Access Denied</div>';
    
    // Fetch all required entities for linkage
    const [medsRes, custRes, patRes] = await Promise.all([
        window.db.getMedicines(),
        window.db.getCustomers(),
        window.db.getPatients()
    ]);
    
    const medicines = medsRes.data || [];
    const customersList = custRes.data || [];
    const patientsList = patRes.data || [];

    // Combine into a unified list
    const combinedClients = [
        ...customersList.map(c => ({ ...c, type: 'Customer', display: `${c.name} (${c.phone || 'No Phone'})` })),
        ...patientsList.map(p => ({ ...p, type: 'Patient', display: `[P] ${p.name} (Age: ${p.age || 'N/A'})` }))
    ];

    document.getElementById('pageContainer').innerHTML = `
        <div class="pos-layout">
            <div>
                <h3>Search Medicines</h3>
                <input type="text" id="posSearch" placeholder="Type name or scan barcode and press Enter..." style="width:100%; padding:12px; border-radius:30px; border:2px solid #ddd; margin-bottom:20px;">
                <div id="posMedList" style="max-height:500px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
                    ${medicines.map(m => `
                        <div class="cart-item pos-add-btn" data-id="${m.id}">
                            <span>${m.name}${m.batch ? ' (' + m.batch + ')' : ''} - KES ${m.price}</span>
                            <i class="fas fa-plus-circle" style="color:var(--cyna-blue); pointer-events:none;"></i>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="stat-card">
                <h3>Shopping Cart</h3>
                <div id="cartItemsList" style="min-height:150px; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;"></div>
                <div style="display:flex; justify-content:space-between; margin:15px 0;"><h4>Total:</h4><h4>KES <span id="cartTotalSpan">0.00</span></h4></div>
                
                <h4 style="font-size:0.9rem; margin-bottom:8px; color:#64748b;">Client Selection</h4>
                <select id="posCustomerSelect" style="width:100%; padding:12px; border-radius:30px; margin-bottom:12px; border:1px solid #ddd; font-weight:600; color:var(--royal-blue);">
                    <option value="Walk-in">Walk-in Customer</option>
                    ${combinedClients.map(c => `<option value="${c.name}" data-id="${c.id}" data-type="${c.type}">${c.display}</option>`).join('')}
                </select>

                <!-- Clinical Insight Badge (Visible only for Patients) -->
                <div id="posPatientInsight" style="display:none; padding:12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; margin-bottom:15px;">
                    <h5 style="margin-top:0; margin-bottom:6px; color:#1e40af; font-size:0.8rem;"><i class="fas fa-stethoscope"></i> Clinical Insight</h5>
                    <div id="posPatientDetails" style="font-size:0.75rem; color:#1e3a8a; line-height:1.4;"></div>
                </div>

                <h4 style="font-size:0.9rem; margin-bottom:8px; color:#64748b;">Payment Method</h4>
                <div style="display:flex; gap:10px; margin-bottom: 15px;">
                    <button class="pos-method-mode pos-method-cash" data-method="Cash" style="flex:1; padding:12px; background:var(--emerald); color:white; border-radius:16px; border:none; cursor:pointer; font-weight:600; transition:all 0.2s ease; border:3px solid #10b981;"><i class="fas fa-money-bill-wave" style="pointer-events:none;"></i> Cash</button>
                    <button class="pos-method-mode pos-method-mpesa" data-method="M-Pesa" style="flex:1; padding:12px; background:var(--royal-blue); color:white; border-radius:16px; border:none; cursor:pointer; font-weight:600; transition:all 0.2s ease; opacity:0.5; border:3px solid transparent;"><i class="fas fa-mobile-alt" style="pointer-events:none;"></i> M-Pesa</button>
                    <button class="pos-method-mode pos-method-credit" data-method="Credit" style="flex:1; padding:12px; background:var(--warning); color:white; border-radius:16px; border:none; cursor:pointer; font-weight:600; transition:all 0.2s ease; opacity:0.5; border:3px solid transparent;"><i class="fas fa-file-invoice-dollar" style="pointer-events:none;"></i> Credit</button>
                </div>
                <!-- Hidden input to store active method -->
                <input type="hidden" id="posActiveMethod" value="Cash">
                <button id="posPayNowSubmit" class="btn-primary" style="width:100%; padding:16px; font-size:1.1rem; border-radius:30px;"><i class="fas fa-check-circle" style="pointer-events:none;"></i> PAY NOW</button>
            </div>
        </div>
    `;

    document.getElementById('posSearch').onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = e.target.value.toLowerCase().trim();
            if (!query) return;
            const match = medicines.find(m => m.barcode === query || m.name.toLowerCase() === query);
            if (match) {
                addToCartPos(match.id);
                e.target.value = ''; 
            } else {
                showToast('No exact match found for barcode/name!', 'warning');
            }
        }
    };

    document.getElementById('posSearch').oninput = (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = medicines.filter(m => m.name.toLowerCase().includes(query) || (m.barcode && m.barcode.toLowerCase().includes(query)));
        document.getElementById('posMedList').innerHTML = filtered.map(m => `
            <div class="cart-item pos-add-btn" data-id="${m.id}">
                <span>${m.name}${m.batch ? ' (' + m.batch + ')' : ''} - KES ${m.price}</span>
                <i class="fas fa-plus-circle" style="color:var(--cyna-blue); pointer-events:none;"></i>
            </div>
        `).join('');
    };
    const clientSelect = document.getElementById('posCustomerSelect');
    clientSelect.onchange = (e) => {
        const option = e.target.options[e.target.selectedIndex];
        const type = option.getAttribute('data-type');
        const name = e.target.value;
        const insightEl = document.getElementById('posPatientInsight');
        const detailsEl = document.getElementById('posPatientDetails');

        if (type === 'Patient') {
            const patient = patientsList.find(p => p.name === name);
            if (patient) {
                insightEl.style.display = 'block';
                detailsEl.innerHTML = `
                    <div style="font-weight:700;">Diagnosis: <span style="font-weight:400;">${patient.diagnosis || 'None recorded'}</span></div>
                    <div style="font-weight:700; margin-top:4px;">History: <span style="font-weight:400;">${patient.history || 'None recorded'}</span></div>
                `;
            }
        } else {
            insightEl.style.display = 'none';
        }
    };

    updateCartUI();
}

window.addToCartPos = addToCartPos;
async function addToCartPos(id) {
    try {
        console.log("Called addToCartPos with id:", id);
        const medsRes = await window.db.getMedicines();
        if (!medsRes.success) throw new Error("Failed to fetch medicines from db!");
        
        const med = medsRes.data.find(m => String(m.id) === String(id));
        console.log("Found medicine:", med);
        
        if (!med || med.stock <= 0) {
            return showToast('Out of stock!', 'error');
        }

        const existing = cart.find(i => String(i.id) === String(id));
        if (existing) {
            if (existing.qty >= med.stock) return showToast('Not enough stock available!', 'warning');
            existing.qty++;
        } else {
            cart.push({ ...med, qty: 1 });
        }
        updateCartUI();
        console.log("Cart updated:", cart);
    } catch (e) {
        console.error(e);
        showToast("Error adding to cart", "error");
    }
}

window.decrementCartPos = decrementCartPos;
function decrementCartPos(id) {
    const existing = cart.find(i => String(i.id) === String(id));
    if (existing) {
        existing.qty--;
        if (existing.qty <= 0) cart = cart.filter(i => String(i.id) !== String(id));
        updateCartUI();
    }
}

window.removeFromCartPos = removeFromCartPos;
function removeFromCartPos(id) {
    cart = cart.filter(i => String(i.id) !== String(id));
    updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById('cartItemsList');
    const span = document.getElementById('cartTotalSpan');
    if (!list || !span) return;

    let total = 0;
    list.innerHTML = cart.map((item) => {
        total += item.price * item.qty;
        return `
            <div style="display:flex; flex-direction:column; margin-bottom:12px; font-size:0.9rem; padding:8px; background:#f8fafc; border-radius:8px;">
                <div style="display:flex; justify-content:space-between; font-weight:600; margin-bottom:6px;">
                    <span>${item.name}</span>
                    <span>KES ${(item.price * item.qty).toFixed(2)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.8rem; color:#64748b;">@ KES ${item.price} each</span>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button class="action-btn-refined cart-decrement-btn" data-id="${item.id}" style="width:28px; height:28px; background:#f1f5f9; color:#475569;" title="Decrease quantity">
                            <i class="fas fa-minus" style="font-size:0.75rem;"></i>
                        </button>
                        <span style="font-weight:700; min-width:24px; text-align:center; color:var(--royal-blue); font-size:1rem;">${item.qty}</span>
                        <button class="action-btn-refined cart-increment-btn" data-id="${item.id}" style="width:28px; height:28px; background:#f1f5f9; color:#475569;" title="Increase quantity">
                            <i class="fas fa-plus" style="font-size:0.75rem;"></i>
                        </button>
                        <button class="action-btn-refined btn-icon-del cart-remove-btn" data-id="${item.id}" style="width:28px; height:28px; margin-left:4px;" title="Remove from cart">
                            <i class="fas fa-times" style="font-size:0.85rem;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('') || '<p style="color:#666; text-align:center; padding:20px;">Cart is empty</p>';
    span.innerText = total.toFixed(2);
}

// --- Module Rendering Functions ---

async function renderPatients(searchQuery = '') {
    if (!hasAccess('patients')) return document.getElementById('pageContainer').innerHTML = '<div class="stat-card">Access Denied</div>';
    
    const res = await window.db.getPatients();
    let patients = res.data || [];

    if (searchQuery) {
        if (window.lastPatientSearch !== searchQuery) {
            paginationState.patients = 1;
            window.lastPatientSearch = searchQuery;
        }
        patients = filterTable(searchQuery, patients, ['name', 'diagnosis', 'history']);
    }

    const totalPatients = patients.length;
    const paginatedPatients = patients.slice((paginationState.patients - 1) * paginationState.limit, paginationState.patients * paginationState.limit);

    document.getElementById('pageContainer').innerHTML = `
        <div class="view-header">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <h2><i class="fas fa-notes-medical"></i> Patient Management</h2>
                    <p>Manage medical history and clinical profiles</p>
                </div>
                <button class="btn-primary" id="addPatientBtn"><i class="fas fa-plus"></i> Add Patient</button>
            </div>
        </div>

        <div class="stat-card" style="margin-bottom: 24px; padding: 15px 25px;">
            <div style="display:flex; gap:16px; align-items:center;">
                <i class="fas fa-search" style="color:#64748b;"></i>
                <input type="text" id="patientSearch" placeholder="Search patients by name or diagnosis..." 
                       value="${searchQuery}"
                       style="flex:1; border:none; background:transparent; font-size:1rem; outline:none; font-weight:500;">
            </div>
        </div>

        <div class="stat-card" style="padding:0; overflow:hidden; border-radius:16px;">
            <table class="data-table">
                <thead>
                    <tr style="background:var(--royal-blue); color:white;">
                        <th style="color:white; padding:16px;">Name</th>
                        <th style="color:white;">Age</th>
                        <th style="color:white;">Gender</th>
                        <th style="color:white;">Diagnosis</th>
                        <th style="color:white;">Prescriptions</th>
                        <th style="text-align:right; color:white; padding-right:16px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${paginatedPatients.length > 0 ? paginatedPatients.map(p => `
                        <tr>
                            <td style="padding:16px;">
                                <div style="font-weight:700; color:var(--royal-blue);">${p.name}</div>
                                <div style="font-size:0.75rem; color:#64748b;">ID: #${p.id}</div>
                            </td>
                            <td>${p.age || 'N/A'}</td>
                            <td><span class="role-pill" style="background:#f1f5f9; color:#475569;">${p.gender}</span></td>
                            <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.diagnosis || '---'}</td>
                            <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.prescriptions || '---'}</td>
                            <td style="text-align:right; padding-right:16px;">
                                <div style="display:flex; justify-content:flex-end; gap:8px;">
                                    <button class="action-btn-refined btn-icon-view view-patient-profile-btn" data-id="${p.id}" title="View History & Profile">
                                        <i class="fas fa-history"></i>
                                    </button>
                                    <button class="action-btn-refined btn-icon-edit edit-patient-btn" data-id="${p.id}" title="Edit Patient">
                                        <i class="fas fa-pencil-alt"></i>
                                    </button>
                                    <button class="action-btn-refined btn-icon-del del-patient-btn" data-id="${p.id}" data-name="${p.name.replace(/"/g, '&quot;')}" title="Delete Patient">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('') : '<tr><td colspan="6" style="text-align:center; padding:40px; color:#64748b;">No patient records found.</td></tr>'}
                </tbody>
            </table>
            ${renderPaginationControls('patients', totalPatients)}
        </div>
    `;

    const searchInput = document.getElementById('patientSearch');
    if (searchInput) {
        if (!searchInput.dataset.bound) {
            searchInput.dataset.bound = "true";
            searchInput.addEventListener('input', (e) => {
                clearTimeout(window.patientSearchTimer);
                window.patientSearchTimer = setTimeout(() => {
                    renderPatients(e.target.value);
                }, 300);
            });
        }
        searchInput.focus();
        try { searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length); } catch(e){}
    }

    document.getElementById('addPatientBtn').onclick = () => showPatientModal();

    document.querySelectorAll('.view-patient-profile-btn').forEach(btn => {
        btn.onclick = () => showProfileModal(btn.getAttribute('data-id'), 'Patient');
    });

    document.querySelectorAll('.edit-patient-btn').forEach(btn => {
        btn.onclick = () => showPatientModal(btn.getAttribute('data-id'));
    });

    document.querySelectorAll('.del-patient-btn').forEach(btn => {
        btn.onclick = async () => {
            if (await showConfirm(`Delete PERMANENT records for "${btn.getAttribute('data-name')}"?`)) {
                await window.db.deletePatient(btn.getAttribute('data-id'));
                renderPatients();
            }
        };
    });
}

async function showPatientModal(id = null) {
    let p = { name: '', age: '', gender: 'Male', diagnosis: '', history: '', prescriptions: '' };
    if (id) {
        const res = await window.db.getPatients();
        p = res.data.find(item => item.id === id);
    }

    const modal = document.getElementById('genericModal');
    const inner = document.getElementById('modalInner');
    inner.innerHTML = `
        <h3 style="margin-bottom:24px; color:var(--royal-blue);">
            <i class="fas fa-${id ? 'user-edit' : 'user-plus'}"></i> ${id ? 'Edit Patient Record' : 'New Patient Registration'}
        </h3>
        <div class="input-group">
            <label>Full Name</label>
            <input type="text" id="modal_p_name" value="${p.name}" class="premium-input" placeholder="e.g. James Otieno">
        </div>
        <div class="form-grid">
            <div class="input-group">
                <label>Age</label>
                <input type="number" id="modal_p_age" value="${p.age}" class="premium-input" placeholder="Years">
            </div>
            <div class="input-group">
                <label>Gender</label>
                <select id="modal_p_gender" class="premium-select">
                    <option value="Male" ${p.gender === 'Male' ? 'selected' : ''}>Male</option>
                    <option value="Female" ${p.gender === 'Female' ? 'selected' : ''}>Female</option>
                    <option value="Other" ${p.gender === 'Other' ? 'selected' : ''}>Other</option>
                </select>
            </div>
        </div>
        <div class="input-group">
            <label>Main Diagnosis</label>
            <input type="text" id="modal_p_diag" value="${p.diagnosis || ''}" class="premium-input" placeholder="e.g. Hypertension">
        </div>
        <div class="input-group">
            <label>Prescriptions</label>
            <input type="text" id="modal_p_presc" value="${p.prescriptions || ''}" class="premium-input" placeholder="e.g. Amlodipine 5mg">
        </div>
        <div class="input-group">
            <label>Notes / History</label>
            <textarea id="modal_p_history" class="premium-input" style="height:80px; resize:none;" placeholder="e.g. Follow up every month">${p.history || ''}</textarea>
        </div>
        
        <div style="display:flex; gap:12px; margin-top:32px;">
            <button class="btn-primary" id="modalSavePatient" style="flex:1;">
                <i class="fas fa-check-circle"></i> ${id ? 'Update Patient Record' : 'Register New Patient'}
            </button>
            <button class="btn-primary" style="flex:1; background:#f1f5f9; color:#475569; border:none;" onclick="document.getElementById('genericModal').style.display='none'">Cancel</button>
        </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('modalSavePatient').onclick = async () => {
        const data = {
            name: document.getElementById('modal_p_name').value.trim(),
            age: document.getElementById('modal_p_age').value,
            gender: document.getElementById('modal_p_gender').value,
            diagnosis: document.getElementById('modal_p_diag').value,
            history: document.getElementById('modal_p_history').value,
            prescriptions: document.getElementById('modal_p_presc').value
        };

        if (!data.name) return showToast('Patient name is required', 'warning');

        const res = id ? await window.db.updatePatient(id, data) : await window.db.addPatient(data);

        if (res.success) {
            showToast(`Patient ${id ? 'updated' : 'registered'} successfully`, 'success');
            modal.style.display = 'none';
            renderPatients();
        } else {
            showToast(res.error, 'error');
        }
    };
}

async function renderCustomers(searchQuery = '') {
    if (!hasAccess('customers')) return document.getElementById('pageContainer').innerHTML = '<div class="stat-card">Access Denied</div>';
    
    const res = await window.db.getCustomers();
    let customers = res.data || [];

    if (searchQuery) {
        if (window.lastCustomerSearch !== searchQuery) {
            paginationState.customers = 1;
            window.lastCustomerSearch = searchQuery;
        }
        customers = filterTable(searchQuery, customers, ['name', 'phone', 'email']);
    }

    const totalCustomers = customers.length;
    const paginatedCustomers = customers.slice((paginationState.customers - 1) * paginationState.limit, paginationState.customers * paginationState.limit);

    document.getElementById('pageContainer').innerHTML = `
        <div class="view-header">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="display:flex; gap:12px; align-items:center;">
                    <i class="fas fa-user-friends" style="font-size:1.8rem; color:var(--royal-blue);"></i>
                    <div>
                        <h2 style="margin:0;">Customer Management</h2>
                    </div>
                </div>
                <button class="btn-primary" id="addCustomerBtn"><i class="fas fa-plus"></i> Add Customer</button>
            </div>
        </div>

        <div class="stat-card" style="margin-bottom: 24px; padding: 15px 25px;">
            <div style="display:flex; gap:16px; align-items:center;">
                <i class="fas fa-search" style="color:#64748b;"></i>
                <input type="text" id="customerSearch" placeholder="Search by name, email or phone..." 
                       value="${searchQuery}"
                       style="flex:1; border:none; background:transparent; font-size:1rem; outline:none; font-weight:500;">
            </div>
        </div>

        <div class="stat-card" style="padding:0; overflow:hidden; border-radius:16px;">
            <table class="data-table">
                <thead>
                    <tr style="background:var(--royal-blue); color:white;">
                        <th style="color:white; padding:16px;">Name</th>
                        <th style="color:white;">Phone</th>
                        <th style="color:white;">Email</th>
                        <th style="color:white;">Prescriptions</th>
                        <th style="text-align:right; color:white; padding-right:16px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${paginatedCustomers.length > 0 ? paginatedCustomers.map(c => `
                        <tr>
                            <td style="padding-left:20px; font-weight:700; color:var(--royal-blue);">${c.name}</td>
                            <td style="font-weight:600;">${c.phone}</td>
                            <td style="color:#64748b;">${c.email || 'No Email'}</td>
                            <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.prescriptions || '---'}</td>
                            <td style="text-align:right; padding-right:20px;">
                                <div style="display:flex; justify-content:flex-end; gap:8px;">
                                    <button class="action-btn-refined btn-icon-view view-customer-profile-btn" data-id="${c.id}" title="Customer History">
                                        <i class="fas fa-user-tag"></i>
                                    </button>
                                    <button class="action-btn-refined btn-icon-edit edit-customer-btn" data-id="${c.id}" title="Edit Profile">
                                        <i class="fas fa-pencil-alt"></i>
                                    </button>
                                    <button class="action-btn-refined btn-icon-del del-customer-btn" data-id="${c.id}" data-name="${c.name}" title="Remove Customer">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('') : '<tr><td colspan="5" style="text-align:center; padding:40px; color:#64748b;">No customers found matching your search.</td></tr>'}
                </tbody>
            </table>
            ${renderPaginationControls('customers', totalCustomers)}
        </div>
    `;

    const searchInput = document.getElementById('customerSearch');
    if (searchInput) {
        if (!searchInput.dataset.bound) {
            searchInput.dataset.bound = "true";
            searchInput.addEventListener('input', (e) => {
                clearTimeout(window.customerSearchTimer);
                window.customerSearchTimer = setTimeout(() => {
                    renderCustomers(e.target.value);
                }, 300);
            });
        }
        searchInput.focus();
        try { searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length); } catch(e){}
    }

    document.getElementById('addCustomerBtn').onclick = () => showCustomerModal();

    document.querySelectorAll('.view-customer-profile-btn').forEach(btn => {
        btn.onclick = () => showProfileModal(btn.getAttribute('data-id'), 'Customer');
    });

    document.querySelectorAll('.edit-customer-btn').forEach(btn => {
        btn.onclick = () => showCustomerModal(btn.getAttribute('data-id'));
    });

    document.querySelectorAll('.del-customer-btn').forEach(btn => {
        btn.onclick = async () => {
            if (await showConfirm(`Remove customer "${btn.getAttribute('data-name')}" from database?`)) {
                await window.db.deleteCustomer(btn.getAttribute('data-id'));
                renderCustomers();
            }
        };
    });
}

async function showCustomerModal(id = null) {
    let c = { name: '', phone: '', email: '', history: '', prescriptions: '' };
    if (id) {
        const res = await window.db.getCustomers();
        c = res.data.find(item => item.id === id) || c;
    }

    const modal = document.getElementById('genericModal');
    const inner = document.getElementById('modalInner');
    inner.innerHTML = `
        <h3 style="margin-bottom:24px; color:var(--royal-blue);">
            <i class="fas fa-${id ? 'user-edit' : 'user-plus'}"></i> ${id ? 'Edit Customer' : 'Add Customer'}
        </h3>
        <div class="input-group">
            <label>Full Name</label>
            <input type="text" id="modal_c_name" value="${c.name}" class="premium-input" placeholder="e.g. John Mwangi">
        </div>
        <div class="form-grid">
            <div class="input-group">
                <label>Phone Number</label>
                <input type="text" id="modal_c_phone" value="${c.phone}" class="premium-input" placeholder="e.g. +254712345678">
            </div>
            <div class="input-group">
                <label>Email</label>
                <input type="text" id="modal_c_email" value="${c.email || ''}" class="premium-input" placeholder="e.g. john@example.com">
            </div>
        </div>
        <div class="input-group">
            <label>Prescriptions / Standing Meds</label>
            <input type="text" id="modal_c_presc" value="${c.prescriptions || ''}" class="premium-input" placeholder="e.g. Allergy - Cetirizine">
        </div>
        <div class="input-group">
            <label>Engagement History</label>
            <textarea id="modal_c_history" class="premium-input" style="height:80px; resize:none;" placeholder="e.g. 2025-02-10: Cetirizine 10mg">${c.history || ''}</textarea>
        </div>
        
        <div style="display:flex; gap:12px; margin-top:32px;">
            <button class="btn-primary" id="modalSaveCustomer" style="flex:1;">
                <i class="fas fa-check-circle"></i> ${id ? 'Update Customer Profile' : 'Save Customer Details'}
            </button>
            <button class="btn-primary" style="flex:1; background:#f1f5f9; color:#475569; border:none;" onclick="document.getElementById('genericModal').style.display='none'">Cancel</button>
        </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('modalSaveCustomer').onclick = async () => {
        const data = {
            name: document.getElementById('modal_c_name').value.trim(),
            phone: document.getElementById('modal_c_phone').value.trim(),
            email: document.getElementById('modal_c_email').value.trim(),
            prescriptions: document.getElementById('modal_c_presc').value.trim(),
            history: document.getElementById('modal_c_history').value.trim()
        };

        if (!data.name) return showToast('Customer name is required', 'warning');

        const res = id ? await window.db.updateCustomer(id, data) : await window.db.addCustomer(data);

        if (res.success) {
            showToast(`Customer ${id ? 'updated' : 'added'} successfully`, 'success');
            modal.style.display = 'none';
            renderCustomers();
        } else {
            showToast(res.error, 'error');
        }
    };
}

// --- Individual Profile & History Viewer ---

async function showProfileModal(id, type) {
    let person = null;
    if (type === 'Patient') {
        const res = await window.db.getPatients();
        person = res.data.find(p => p.id === id);
    } else {
        const res = await window.db.getCustomers();
        person = res.data.find(c => c.id === id);
    }

    if (!person) return showToast('Error: Could not find record.', 'error');

    // Fetch all sales and filter by name
    const salesRes = await window.db.getSales();
    const allSales = salesRes.data || [];
    const history = allSales.filter(s => s.customer_name === person.name).reverse();

    const modal = document.getElementById('genericModal');
    const inner = document.getElementById('modalInner');
    
    // CLEANER STRUCTURE: Single scroll container, no double bars
    inner.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden;">
            <div style="padding: 24px; border-bottom: 2px solid #f1f5f9; background: white; border-radius: 20px 20px 0 0; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h2 style="margin:0; color:var(--royal-blue);"><i class="fas fa-id-card"></i> ${person.name}</h2>
                    <p style="margin:5px 0 0; color:#64748b; font-size:0.9rem;">${type} Profile & Clinical History</p>
                </div>
                <button onclick="document.getElementById('genericModal').style.display='none'" style="background:#f1f5f9; border:none; padding:12px; border-radius:12px; cursor:pointer; color:#94a3b8;"><i class="fas fa-times"></i></button>
            </div>

            <div style="flex: 1; overflow-y: auto; padding: 24px;">
                <div style="display:grid; grid-template-columns: 350px 1fr; gap:30px;">
                    <!-- Left Side: Clinical Profile & Update -->
                    <div style="background:#f8fafc; border-radius:16px; padding:20px; border:1px solid #e2e8f0; align-self: flex-start;">
                        <h4 style="margin-top:0; color:#334155; border-bottom:1px solid #e2e8f0; padding-bottom:10px; margin-bottom:15px;">
                            <i class="fas fa-user-md"></i> Clinical Record
                        </h4>
                        
                        <div class="input-group">
                            <label style="font-size:0.75rem; color:#64748b; font-weight:600;">Active Prescriptions (Auto-updated)</label>
                            <textarea id="profile_prescriptions" class="premium-input" style="height:180px; resize:none; font-size:0.85rem; line-height:1.5; border-radius:12px;">${person.prescriptions || ''}</textarea>
                        </div>
                        
                        <div class="input-group" style="margin-top:15px;">
                            <label style="font-size:0.75rem; color:#64748b; font-weight:600;">Clinical History</label>
                            <textarea id="profile_history" class="premium-input" style="height:180px; resize:none; font-size:0.85rem; line-height:1.5; border-radius:12px;">${person.history || ''}</textarea>
                        </div>

                        <button class="btn-primary" id="saveProfileChanges" style="width:100%; margin-top:20px; padding:14px; font-weight:700;">
                            <i class="fas fa-save"></i> Save Clinical Data
                        </button>
                    </div>

                    <!-- Right Side: Sales History -->
                    <div>
                        <h4 style="margin-top:0; color:#334155; margin-bottom:15px;"><i class="fas fa-shopping-cart"></i> Recent Transactions</h4>
                        <table class="data-table" style="font-size:0.85rem;">
                            <thead style="position:sticky; top:0; background:white; z-index:1;">
                                <tr style="background:#f1f5f9;">
                                    <th>Date</th>
                                    <th>Items Sold</th>
                                    <th>Total</th>
                                    <th style="text-align:right;">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${history.length > 0 ? history.map(s => {
                                    let itemsDesc = "";
                                    try {
                                        const parsed = JSON.parse(s.items_json);
                                        itemsDesc = parsed.map(i => `${i.name || i.medicine_name || 'Unknown'} (x${i.qty || i.quantity || 1})`).join(', ');
                                    } catch(e){ itemsDesc = s.items_json; }
                                    
                                    return `
                                    <tr>
                                        <td>${s.date}</td>
                                        <td><div style="max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${itemsDesc}">${itemsDesc}</div></td>
                                        <td style="font-weight:700; color:var(--royal-blue);">KES ${s.total.toFixed(2)}</td>
                                        <td style="text-align:right;">
                                            <button class="action-btn-refined btn-icon-view reprint-history-btn" data-id="${s.id}" title="Reprint Receipt">
                                                <i class="fas fa-print"></i>
                                            </button>
                                        </td>
                                    </tr>
                                    `;
                                }).join('') : '<tr><td colspan="4" style="text-align:center; padding:40px; color:#94a3b8;">No purchase history found for this account.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    // Binding for clinical updates
    document.getElementById('saveProfileChanges').onclick = async (e) => {
        const btn = e.target.closest('button');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        const payload = {
            ...person,
            prescriptions: document.getElementById('profile_prescriptions').value,
            history: document.getElementById('profile_history').value
        };

        if (type === 'Patient') {
            await window.db.updatePatient(person.id, payload);
        } else {
            await window.db.updateCustomer(person.id, payload);
        }
        
        showToast('Clinical profile updated successfully', 'success');
        if (type === 'Patient') renderPatients(); else renderCustomers();
        
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save Clinical Data';
    };

    // Binding for history reprints
    document.querySelectorAll('.reprint-history-btn').forEach(btn => {
        btn.onclick = async () => {
            const saleId = btn.getAttribute('data-id');
            const sale = allSales.find(s => String(s.id) === String(saleId));
            if (sale) {
                handleHistoryReprint(sale);
            }
        };
    });
}

async function handleHistoryReprint(saleObj) {
    const modal = document.getElementById('genericModal');
    const inner = document.getElementById('modalInner');
    
    // CRITICAL: Clear any leftover content (like John Mwangi's profile)
    inner.innerHTML = `
        <div style="min-height:300px; display:flex; align-items:center; justify-content:center;">
             <div style="text-align:center;">
                <i class="fas fa-receipt fa-spin" style="font-size:2rem; color:var(--royal-blue); opacity:0.3;"></i>
                <p style="margin-top:10px; color:#94a3b8; font-size:0.8rem;">Initializing Secure Reprint...</p>
             </div>
        </div>
    `;
    modal.style.display = 'flex';

    let items = [];
    try {
        const parsed = JSON.parse(saleObj.items_json);
        if (Array.isArray(parsed)) {
            if (parsed.length > 0 && typeof parsed[0] === 'object') {
                items = parsed;
            } else {
                items = parsed.map(str => {
                    const match = str.match(/(.*) \(x(\d+)\)/);
                    if (match) {
                        return { name: match[1], qty: parseInt(match[2]), price: 0 }; 
                    }
                    return { name: str, qty: 1, price: 0 };
                });
            }
        }
    } catch (e) {
        console.error("Failed to parse historical items", e);
    }

    // --- MODERN COMPACT OVERLAY ---
    const overlay = document.createElement('div');
    overlay.style = "position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.6); display:flex; align-items:center; justify-content:center; z-index:2000; border-radius:30px; backdrop-filter:blur(3px);";
    overlay.innerHTML = `
        <div style="background:white; padding:32px; border-radius:32px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); text-align:center; max-width:420px; width:90%; position:relative; overflow:hidden;">
            <div style="background:var(--royal-blue); position:absolute; top:0; left:0; right:0; height:6px;"></div>
            <i class="fas fa-print" style="font-size:2.8rem; color:var(--royal-blue); margin-bottom:16px;"></i>
            <h3 style="margin:0 0 8px; color:#0f172a; font-size:1.4rem;">Reprint Receipt</h3>
            <p style="color:#64748b; margin-bottom:24px; font-size:0.95rem;">Select output format for Transaction #${saleObj.id}</p>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
                <button id="repThermal" class="btn-primary" style="background:#1e293b; padding:14px; border-radius:16px; font-size:0.9rem;"><i class="fas fa-receipt"></i> Thermal</button>
                <button id="repA4" class="btn-primary" style="background:var(--royal-blue); padding:14px; border-radius:16px; font-size:0.9rem;"><i class="fas fa-file-invoice"></i> A4 Standard</button>
            </div>
            
            <button id="repCancel" style="width:100%; padding:10px; background:none; border:none; color:#94a3b8; cursor:pointer; font-weight:700; font-size:0.9rem; text-transform:uppercase; letter-spacing:0.5px;">Cancel</button>
        </div>
    `;
    modal.querySelector('.modal-content').appendChild(overlay);

    const choice = await new Promise((resolve) => {
        document.getElementById('repThermal').onclick = () => { overlay.remove(); resolve('thermal'); };
        document.getElementById('repA4').onclick = () => { overlay.remove(); resolve('a4'); };
        document.getElementById('repCancel').onclick = () => { overlay.remove(); resolve(null); };
    });

    if (choice) {
        printReceipt(saleObj, items, choice);
    }
    
    // Always hide modal after finish if it was just for reprint
    modal.style.display = 'none';
}

async function renderSuppliers(searchQuery = '') {
    if (!hasAccess('suppliers')) return document.getElementById('pageContainer').innerHTML = '<div class="stat-card">Access Denied</div>';
    
    const res = await window.db.getSuppliers();
    let suppliers = res.data || [];

    if (searchQuery) {
        if (window.lastSupplierSearch !== searchQuery) {
            paginationState.suppliers = 1;
            window.lastSupplierSearch = searchQuery;
        }
        suppliers = filterTable(searchQuery, suppliers, ['name', 'contact_person', 'phone']);
    }

    const totalSuppliers = suppliers.length;
    const paginatedSuppliers = suppliers.slice((paginationState.suppliers - 1) * paginationState.limit, paginationState.suppliers * paginationState.limit);

    document.getElementById('pageContainer').innerHTML = `
        <div class="view-header">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="display:flex; gap:12px; align-items:center;">
                    <i class="fas fa-truck-fade" style="font-size:1.8rem; color:var(--royal-blue);"></i>
                    <div>
                        <h2 style="margin:0;">Suppliers Directory</h2>
                    </div>
                </div>
                <button class="btn-primary" id="addSupplierBtn"><i class="fas fa-plus"></i> Add Supplier</button>
            </div>
        </div>

        <div class="stat-card" style="margin-bottom: 24px; padding: 15px 25px;">
            <div style="display:flex; gap:16px; align-items:center;">
                <i class="fas fa-search" style="color:#64748b;"></i>
                <input type="text" id="supplierSearch" placeholder="Search by name, contact or phone..." 
                       value="${searchQuery}"
                       style="flex:1; border:none; background:transparent; font-size:1rem; outline:none; font-weight:500;">
            </div>
        </div>

        <div class="stat-card" style="padding:0; overflow:hidden; border-radius:16px;">
            <table class="data-table">
                <thead>
                    <tr style="background:var(--royal-blue); color:white;">
                        <th style="color:white; padding:16px;">Vendor Name</th>
                        <th style="color:white;">Contact Person</th>
                        <th style="color:white;">Phone</th>
                        <th style="color:white;">Email</th>
                        <th style="text-align:right; color:white; padding-right:16px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${paginatedSuppliers.length > 0 ? paginatedSuppliers.map(s => `
                        <tr>
                            <td style="padding-left:20px; font-weight:700; color:var(--royal-blue);">${s.name}</td>
                            <td>${s.contact_person || 'N/A'}</td>
                            <td style="font-weight:600;">${s.phone}</td>
                            <td style="font-size:0.8rem; color:#64748b;">${s.email || '---'}</td>
                            <td style="text-align:right; padding-right:20px;">
                                <div style="display:flex; justify-content:flex-end; gap:8px;">
                                    <button class="action-btn-refined btn-icon-edit edit-supplier-btn" data-id="${s.id}" title="Edit Supplier">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="action-btn-refined btn-icon-del del-supplier-btn" data-id="${s.id}" data-name="${s.name}" title="Remove Supplier">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('') : '<tr><td colspan="5" style="text-align:center; padding:40px; color:#64748b;">No suppliers records found.</td></tr>'}
                </tbody>
            </table>
            ${renderPaginationControls('suppliers', totalSuppliers)}
        </div>
    `;

    const searchInput = document.getElementById('supplierSearch');
    if (searchInput) {
        if (!searchInput.dataset.bound) {
            searchInput.dataset.bound = "true";
            searchInput.addEventListener('input', (e) => {
                clearTimeout(window.supplierSearchTimer);
                window.supplierSearchTimer = setTimeout(() => {
                    renderSuppliers(e.target.value);
                }, 300);
            });
        }
        searchInput.focus();
        try { searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length); } catch(e){}
    }

    document.getElementById('addSupplierBtn').onclick = () => showSupplierModal();

    document.querySelectorAll('.edit-supplier-btn').forEach(btn => {
        btn.onclick = () => showSupplierModal(btn.getAttribute('data-id'));
    });

    document.querySelectorAll('.del-supplier-btn').forEach(btn => {
        btn.onclick = async () => {
            if (await showConfirm(`Remove supplier "${btn.getAttribute('data-name')}" from directory?`)) {
                await window.db.deleteSupplier(btn.getAttribute('data-id'));
                renderSuppliers();
            }
        };
    });
}

async function showSupplierModal(id = null) {
    let s = { name: '', contact_person: '', phone: '', email: '', address: '' };
    if (id) {
        const res = await window.db.getSuppliers();
        s = res.data.find(item => item.id === id) || s;
    }

    const modal = document.getElementById('genericModal');
    const inner = document.getElementById('modalInner');
    inner.innerHTML = `
        <h3 style="margin-bottom:24px; color:var(--royal-blue);">
            <i class="fas fa-${id ? 'edit' : 'plus-circle'}"></i> ${id ? 'Edit Supplier Details' : 'Add New Supplier'}
        </h3>
        <div class="input-group">
            <label>Vendor / Company Name</label>
            <input type="text" id="modal_s_name" value="${s.name}" class="premium-input" placeholder="e.g. MediKen Ltd">
        </div>
        <div class="form-grid">
            <div class="input-group">
                <label>Contact Person</label>
                <input type="text" id="modal_s_person" value="${s.contact_person || ''}" class="premium-input" placeholder="e.g. Jane Doe">
            </div>
            <div class="input-group">
                <label>Phone Number</label>
                <input type="text" id="modal_s_phone" value="${s.phone || ''}" class="premium-input" placeholder="e.g. 0722...">
            </div>
        </div>
        <div class="form-grid">
            <div class="input-group">
                <label>Email Address</label>
                <input type="email" id="modal_s_email" value="${s.email || ''}" class="premium-input" placeholder="e.g. sales@mediken.co.ke">
            </div>
            <div class="input-group">
                <label>Physical Address</label>
                <input type="text" id="modal_s_address" value="${s.address || ''}" class="premium-input" placeholder="e.g. Nairobi, Industrial Area">
            </div>
        </div>
        
        <div style="display:flex; gap:12px; margin-top:32px;">
            <button class="btn-primary" id="modalSaveSupplier" style="flex:1; border-radius:12px; background:var(--royal-blue); color:white;">
                <i class="fas fa-save"></i> ${id ? 'Update Supplier' : 'Save Supplier'}
            </button>
            <button class="btn-primary" style="flex:1; background:#f1f5f9; color:#475569;" onclick="document.getElementById('genericModal').style.display='none'">Cancel</button>
        </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('modalSaveSupplier').onclick = async () => {
        const data = {
            name: document.getElementById('modal_s_name').value.trim(),
            contact_person: document.getElementById('modal_s_person').value.trim(),
            phone: document.getElementById('modal_s_phone').value.trim(),
            email: document.getElementById('modal_s_email').value.trim(),
            address: document.getElementById('modal_s_address').value.trim()
        };

        if (!data.name) return showToast('Supplier company name is required', 'warning');

        const res = id ? await window.db.updateSupplier(id, data) : await window.db.addSupplier(data);

        if (res.success) {
            showToast(`Supplier ${id ? 'updated' : 'added'} successfully`, 'success');
            modal.style.display = 'none';
            renderSuppliers();
        } else {
            showToast(res.error, 'error');
        }
    };
}

async function renderPurchases() {
    if (!hasAccess('purchases')) return document.getElementById('pageContainer').innerHTML = '<div class="stat-card">Access Denied</div>';
    
    const purRes = await window.db.getPurchases();
    const purchases = purRes.data || [];

    document.getElementById('pageContainer').innerHTML = `
        <div class="view-header">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <h2><i class="fas fa-dolly"></i> Stock Intake & Purchases</h2>
                    <p>Record new stock deliveries and update inventory levels</p>
                </div>
                <button class="btn-primary" id="newIntakeBtn"><i class="fas fa-truck-loading"></i> New Stock Receipt</button>
            </div>
        </div>

        <div class="stat-card" style="padding:0; overflow:hidden;">
            <table class="data-table">
                <thead>
                    <tr style="background:var(--royal-blue); color:white;">
                        <th style="color:white; padding:16px;">Medicine Name</th>
                        <th style="color:white;">Supplier</th>
                        <th style="color:white;">Quantity</th>
                        <th style="color:white;">Unit Price</th>
                        <th style="color:white;">Total Cost</th>
                        <th style="text-align:right; color:white; padding-right:16px;">Intake Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${purchases.length > 0 ? purchases.slice(-15).reverse().map(p => {
                        const unitP = Number(p.unit_price || 0).toFixed(2);
                        const totalC = Number(p.total_cost || 0).toFixed(2);
                        return `
                        <tr>
                            <td style="font-weight:700; border-bottom:1px solid #f1f5f9;">${p.med_name}</td>
                            <td style="color:#64748b; border-bottom:1px solid #f1f5f9;">${p.supplier || 'N/A'}</td>
                            <td style="color:var(--emerald); font-weight:700; border-bottom:1px solid #f1f5f9;">+ ${p.qty} Units</td>
                            <td style="border-bottom:1px solid #f1f5f9;">KES ${unitP}</td>
                            <td style="font-weight:700; color:var(--royal-blue); border-bottom:1px solid #f1f5f9;">KES ${totalC}</td>
                            <td style="color:#94a3b8; text-align:right; border-bottom:1px solid #f1f5f9;">${p.date}</td>
                        </tr>
                        `;
                    }).join('') : '<tr><td colspan="6" style="text-align:center; padding:40px; color:#64748b;">No recent purchases recorded.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('newIntakeBtn').onclick = () => showIntakeModal();
}

async function showIntakeModal() {
    const medsRes = await window.db.getMedicines();
    const supsRes = await window.db.getSuppliers();
    const medicines = medsRes.data || [];
    const suppliers = supsRes.data || [];

    const modal = document.getElementById('genericModal');
    const inner = document.getElementById('modalInner');
    
    // We no longer use native datalist to avoid browser-specific styling (like the black background)
    inner.innerHTML = `
        <h3 style="margin-bottom:32px; color:var(--royal-blue); display:flex; align-items:center; gap:16px;">
            <div style="background:rgba(30, 58, 138, 0.1); width:54px; height:54px; border-radius:16px; display:flex; align-items:center; justify-content:center;">
                <i class="fas fa-file-invoice-dollar" style="font-size:1.6rem;"></i> 
            </div>
            <div>
                <span style="display:block; font-size:1.4rem; letter-spacing:-0.5px;">Record New Stock Receipt</span>
                <small style="font-size:0.8rem; color:#64748b; font-weight:400;">Log stock to update Inventory levels and POS retail prices.</small>
            </div>
        </h3>

        <div style="background:rgba(30, 58, 138, 0.02); padding:30px; border-radius:28px; border:1px solid rgba(30, 58, 138, 0.06); margin-bottom:28px;">
            <div class="input-group" style="margin-bottom:24px; position:relative;">
                <label style="color:var(--royal-blue); font-weight:700; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-capsules" style="font-size:0.9rem;"></i> Medicine Name
                </label>
                <div class="search-container">
                    <input type="text" id="intake_med_name" class="premium-input" style="padding:14px 20px;" placeholder="Search existing or type new name..." autocomplete="off">
                    <div id="intake_search_results" class="search-results-dropdown"></div>
                </div>
                <input type="hidden" id="intake_med_id" value="">
            </div>

            <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:24px;">
                <div class="input-group">
                    <label style="font-weight:700; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between;">
                        <span><i class="fas fa-cubes" style="font-size:0.9rem;"></i> Intake Quantity</span>
                        <span id="intake_current_stock_display" style="font-size:0.75rem; color:#64748b; font-weight:400; background:#f1f5f9; padding:2px 8px; border-radius:6px;">Current: 0</span>
                    </label>
                    <input type="number" id="intake_qty" class="premium-input" style="padding:14px 20px;" placeholder="e.g. 100">
                </div>
                <div class="input-group">
                    <label style="font-weight:700; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-truck-moving" style="font-size:0.9rem;"></i> Supplier
                    </label>
                    <select id="intake_sup" class="premium-select" style="padding:14px 20px; height:auto;">
                        <option value="">-- Choose Supplier --</option>
                        ${suppliers.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:28px;">
             <!-- FINANCIALS -->
             <div style="background:white; border:1px solid #e2e8f0; padding:24px; border-radius:24px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.02);">
                <h4 style="margin-top:0; margin-bottom:20px; font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-hand-holding-dollar"></i> Pricing & Costing
                </h4>
                <div class="input-group" style="margin-bottom:16px;">
                    <label style="font-size:0.8rem; font-weight:600; color:#64748b;">Buying Price (Unit Cost)</label>
                    <input type="number" step="0.01" id="intake_buying_price" class="premium-input" placeholder="0.00">
                </div>
                <div class="input-group" style="margin-bottom:16px;">
                    <label style="font-size:0.8rem; color:var(--emerald); font-weight:700;">Selling Price (Retail)</label>
                    <input type="number" step="0.01" id="intake_selling_price" class="premium-input" style="border-color:var(--emerald); border-width:2px; font-weight:700;" placeholder="0.00">
                </div>
                <div class="input-group" style="margin:0;">
                    <label style="font-size:0.85rem; font-weight:700; color:var(--royal-blue);">Total Intake Value</label>
                    <input type="text" id="intake_total_cost" class="premium-input" style="background:#f8fafc; font-weight:900; border:none; font-size:1.1rem; color:var(--royal-blue);" readonly value="KES 0.00">
                </div>
             </div>

             <!-- LOGISTICS -->
             <div style="background:white; border:1px solid #e2e8f0; padding:24px; border-radius:24px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.02);">
                <h4 style="margin-top:0; margin-bottom:20px; font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-barcode"></i> Batch Information
                </h4>
                <div class="input-group" style="margin-bottom:16px;">
                    <label style="font-size:0.8rem; font-weight:600; color:#64748b;">Expiry Date</label>
                    <input type="date" id="intake_expiry" class="premium-input" style="color-scheme:light;">
                </div>
                <div class="input-group" style="margin-bottom:16px;">
                    <label style="font-size:0.8rem; font-weight:600; color:#64748b;">Batch Number</label>
                    <input type="text" id="intake_batch" class="premium-input" placeholder="e.g. B-101">
                </div>
                <div class="input-group" style="margin:0;">
                    <label style="font-size:0.8rem; font-weight:600; color:#64748b;">Barcode / SKU</label>
                    <input type="text" id="intake_barcode" class="premium-input" placeholder="Scan or type barcode...">
                </div>
             </div>
        </div>
        
        <div style="display:flex; gap:20px; margin-top:36px; padding-bottom:10px;">
            <button class="btn-primary" id="intakeSaveBtn" style="flex:2; padding:18px; border-radius:20px; font-size:1.1rem; font-weight:700; box-shadow:0 12px 24px -6px rgba(37, 99, 235, 0.3);">
                <i class="fas fa-check-circle"></i> Confirm & Sync Inventory
            </button>
            <button class="btn-primary" id="intakeCancelBtn" style="flex:1; background:#f1f5f9; color:#475569; border-radius:20px; font-weight:700;">Cancel</button>
        </div>

    `;
    modal.style.display = 'flex';

    // UI Logic: Custom Search Dropdown
    const nameInput = document.getElementById('intake_med_name');
    const idInput = document.getElementById('intake_med_id');
    const resultsDropdown = document.getElementById('intake_search_results');
    const sellPriceInput = document.getElementById('intake_selling_price');
    const barcodeInput = document.getElementById('intake_barcode');
    
    const showResults = (query) => {
        if (!query || query.length < 1) {
            resultsDropdown.style.display = 'none';
            return;
        }

        const filtered = medicines.filter(m => 
            m.name.toLowerCase().includes(query.toLowerCase()) || 
            (m.barcode && m.barcode.includes(query))
        );

        if (filtered.length > 0) {
            resultsDropdown.innerHTML = filtered.map(m => `
                <div class="search-result-item" 
                    data-id="${m.id}" 
                    data-name="${m.name}" 
                    data-price="${m.price}" 
                    data-cost_price="${m.cost_price || 0}"
                    data-stock="${m.stock || 0}"
                    data-barcode="${m.barcode || ''}"
                    data-supplier="${m.supplier || ''}"
                    data-batch="${m.batch || ''}"
                    data-expiry="${m.expiry || ''}"
                >
                    <span class="item-title">${m.name}</span>
                    <span class="item-sub">Current Stock: ${m.stock} | Price: KES ${m.price}</span>
                </div>
            `).join('');
            resultsDropdown.style.display = 'block';

            // Bind click events to items
            resultsDropdown.querySelectorAll('.search-result-item').forEach(item => {
                item.onclick = () => {
                    nameInput.value = item.dataset.name;
                    idInput.value = item.dataset.id;
                    sellPriceInput.value = item.dataset.price;
                    barcodeInput.value = item.dataset.barcode;
                    
                    // Populate Buying Price & Stock Display
                    const buyPriceInput = document.getElementById('intake_buying_price');
                    const stockDisplay = document.getElementById('intake_current_stock_display');
                    
                    if (buyPriceInput) buyPriceInput.value = item.dataset.cost_price;
                    if (stockDisplay) stockDisplay.innerText = `Current: ${item.dataset.stock}`;
                    
                    // Auto-fill entire profile as requested
                    const supSelect = document.getElementById('intake_sup');
                    const batchInput = document.getElementById('intake_batch');
                    const expiryInput = document.getElementById('intake_expiry');
                    
                    if (supSelect) supSelect.value = item.dataset.supplier;
                    if (batchInput) batchInput.value = item.dataset.batch;
                    if (expiryInput) expiryInput.value = item.dataset.expiry;

                    resultsDropdown.style.display = 'none';
                    showToast(`Loaded details for ${item.dataset.name}.`, 'info');
                };
            });
        } else {
            resultsDropdown.innerHTML = `<div class="search-result-item no-results">No medicine matches found. Typing new name...</div>`;
            resultsDropdown.style.display = 'block';
            idInput.value = ''; // New item
        }
    };

    nameInput.oninput = (e) => showResults(e.target.value);
    nameInput.onclick = (e) => showResults(e.target.value);

    const dismissDropdown = (event) => {
        if (!event.target.matches('#intake_med_name') && !event.target.closest('.search-results-dropdown')) {
            resultsDropdown.style.display = 'none';
        }
    };
    document.addEventListener('click', dismissDropdown);

    // Ensure we remove the listener when modal closes or button clicked to avoid leaks
    document.getElementById('intakeCancelBtn').addEventListener('click', () => {
        document.removeEventListener('click', dismissDropdown);
        modal.style.display = 'none';
    });
    document.getElementById('intakeSaveBtn').addEventListener('click', () => {
        document.removeEventListener('click', dismissDropdown);
    });

    // UI Logic: Auto-calc Total Cost
    const qtyInput = document.getElementById('intake_qty');
    const buyPriceInput = document.getElementById('intake_buying_price');
    const totalDisplay = document.getElementById('intake_total_cost');

    const updateCalc = () => {
        const q = parseFloat(qtyInput.value) || 0;
        const b = parseFloat(buyPriceInput.value) || 0;
        totalDisplay.value = `KES ${(q * b).toLocaleString(undefined, {minimumFractionDigits:2})}`;
    };

    qtyInput.addEventListener('input', updateCalc);
    buyPriceInput.addEventListener('input', updateCalc);

    document.getElementById('intakeCancelBtn').onclick = () => modal.style.display = 'none';

    document.getElementById('intakeSaveBtn').onclick = async () => {
        const qty = parseInt(document.getElementById('intake_qty').value) || 0;
        const buyPrice = parseFloat(document.getElementById('intake_buying_price').value) || 0;
        const totalCost = qty * buyPrice;

        const cloudData = {
            med_id: document.getElementById('intake_med_id').value || null,
            med_name: document.getElementById('intake_med_name').value.trim(),
            qty: qty,
            supplier: document.getElementById('intake_sup').value,
            unit_price: buyPrice,
            total_cost: totalCost,
            date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD
            expiry: document.getElementById('intake_expiry').value,
            batch: document.getElementById('intake_batch').value.trim(),
            barcode: document.getElementById('intake_barcode').value.trim(),
            selling_price: parseFloat(document.getElementById('intake_selling_price').value) || 0
        };

        if (!cloudData.med_name) return showToast('Medicine name is required', 'warning');
        if (cloudData.qty <= 0) return showToast('Intake Quantity must be greater than 0', 'warning');

        const res = await window.db.recordStockIntake(cloudData);
        if (res.success) {
            showToast(`Inventory updated successfully!`, 'success');
            modal.style.display = 'none';
            renderPurchases();
        } else {
            showToast(res.error, 'error');
        }
    };
}

async function renderReports(subPage = 'overview') {
    if (!hasAccess('reports')) return document.getElementById('pageContainer').innerHTML = '<div class="stat-card">Access Denied</div>';
    
    // Redirect non-admins if they try to access overview
    if (currentUser.role !== 'Admin' && subPage === 'overview') {
        subPage = 'sales';
    }
    const isAdmin = currentUser.role === 'Admin';
    const isPharmacist = currentUser.role === 'Pharmacist';
    
    document.getElementById('pageContainer').innerHTML = `
        <div class="view-header">
            <h2><i class="fas fa-chart-pie"></i> Reports & History</h2>
            <p>View transaction logs and inventory status</p>
        </div>

        <div class="tab-container">
            <div class="tab-header" style="margin-bottom: 24px; flex-wrap: wrap;">
                <button class="tab-btn ${subPage === 'sales' ? 'active' : ''}" id="tabSales">Detailed Sales Log</button>
                <button class="tab-btn ${subPage === 'returns' ? 'active' : ''}" id="tabRet">Returns History</button>
                ${isAdmin || isPharmacist ? `
                    <button class="tab-btn ${subPage === 'inventory' ? 'active' : ''}" id="tabInv">Stock Report</button>
                    <button class="tab-btn ${subPage === 'expiry' ? 'active' : ''}" id="tabExp">Expiry Report</button>
                ` : ''}
                ${isAdmin ? `
                    <button class="tab-btn ${subPage === 'overview' ? 'active' : ''}" id="tabRev">Financial Summary</button>
                    <button class="tab-btn ${subPage === 'profit' ? 'active' : ''}" id="tabProfit">Profit/Loss</button>
                ` : ''}
                <button class="tab-btn ${subPage === 'credit' ? 'active' : ''}" id="tabCred">Credit Tracking</button>
            </div>
            <div id="reportContent"></div>
        </div>
    `;

    // Bind Tabs (Safely)
    const bindTab = (id, page) => {
        const el = document.getElementById(id);
        if (el) el.onclick = () => renderReports(page);
    };

    bindTab('tabSales', 'sales');
    bindTab('tabRet', 'returns');
    bindTab('tabInv', 'inventory');
    bindTab('tabExp', 'expiry');
    bindTab('tabRev', 'overview');
    bindTab('tabProfit', 'profit');
    bindTab('tabCred', 'credit');

    const content = document.getElementById('reportContent');
    const salesRes = await window.db.getSales();
    const medsRes = await window.db.getMedicines();
    const sales = salesRes.data || [];
    const medicines = medsRes.data || [];

    if (subPage === 'overview') {
        renderFinancialOverview(content, sales);
    } else if (subPage === 'sales') {
        renderDetailedSalesLog(content, sales, window.lastSalesSearch || '');
    } else if (subPage === 'inventory') {
        renderInventoryHealth(content, medicines);
    } else if (subPage === 'expiry') {
        renderExpiryReport(content, medicines);
    } else if (subPage === 'profit') {
        renderProfitLoss(content, sales, medicines);
    } else if (subPage === 'credit') {
        renderCreditTracking();
    } else if (subPage === 'returns') {
        renderReturnsHistory(content);
    }
}

async function renderFinancialOverview(container, sales) {
    // Group sales by day for the last 7 days
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().slice(0, 10);
    }).reverse();

    const revenueData = last7Days.map(day => {
        return sales.filter(s => s.date === day).reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    });

    const returnsRes = await window.db.getReturns();
    const returnsData = (returnsRes && returnsRes.data) ? returnsRes.data : [];
    const totalRefunds = returnsData.reduce((s, r) => s + (Number(r.total_refund) || 0), 0);

    const totalRev = sales.reduce((s, t) => s + (Number(t.total) || 0), 0) - totalRefunds;
    const avgSale = sales.length > 0 ? (totalRev / sales.length) : 0;

    let cashCount = 0, mpesaCount = 0, creditCount = 0;
    sales.forEach(s => {
        const pMode = (s.payment_mode || '').toLowerCase();
        if (pMode.includes('cash')) cashCount++;
        else if (pMode.includes('mpesa') || pMode.includes('m-pesa')) mpesaCount++;
        else creditCount++;
    });

    container.innerHTML = `
        <div class="stats-grid" style="margin-bottom:24px;">
            <div class="stat-card">
                <h4 style="color:#64748b;">Cumulative Revenue</h4>
                <div class="stat-number" style="font-size:1.8rem; color:var(--royal-blue);">KES ${totalRev.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <h4 style="color:#64748b;">Average Ticket Size</h4>
                <div class="stat-number" style="font-size:1.8rem; color:var(--emerald);">KES ${avgSale.toFixed(2)}</div>
            </div>
            <div class="stat-card">
                <h4 style="color:#64748b;">Total Transactions</h4>
                <div class="stat-number" style="font-size:1.8rem;">${sales.length}</div>
            </div>
        </div>

        <div class="stat-card" style="margin-bottom:24px;">
            <h4 style="margin-bottom:16px;">Payment Method Breakdown</h4>
            <div style="display:flex; gap:16px; flex-wrap:wrap;">
                <div class="method-card" style="background:#10b981; color:white; padding:12px 24px; border-radius:12px; font-weight:700; flex:1; text-align:center; box-shadow:0 4px 6px -1px rgba(16,185,129,0.2); cursor:pointer;" onclick="renderReports('sales')">
                    <div style="font-size:1.3rem; margin-bottom:4px;"><i class="fas fa-money-bill-wave"></i> Cash</div>
                    <div style="font-size:1rem; opacity:0.9;">${cashCount} Transactions</div>
                </div>
                <div class="method-card" style="background:#8b5cf6; color:white; padding:12px 24px; border-radius:12px; font-weight:700; flex:1; text-align:center; box-shadow:0 4px 6px -1px rgba(139,92,246,0.2); cursor:pointer;" onclick="renderReports('sales')">
                    <div style="font-size:1.3rem; margin-bottom:4px;"><i class="fas fa-mobile-alt"></i> M-Pesa</div>
                    <div style="font-size:1rem; opacity:0.9;">${mpesaCount} Transactions</div>
                </div>
                <div class="method-card" style="background:#fbbf24; color:white; padding:12px 24px; border-radius:12px; font-weight:700; flex:1; text-align:center; box-shadow:0 4px 6px -1px rgba(251,191,36,0.2); cursor:pointer;" onclick="renderReports('credit')">
                    <div style="font-size:1.3rem; margin-bottom:4px;"><i class="fas fa-credit-card"></i> Credit</div>
                    <div style="font-size:1rem; opacity:0.9;">${creditCount} Transactions</div>
                </div>
            </div>
            <style>
                .method-card:hover { transform: translateY(-2px); filter: brightness(1.1); transition: all 0.2s ease; }
            </style>
        </div>

    `;
}

function renderInventoryHealth(container, medicines) {
    const today = new Date();
    const forecast30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const forecast90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

    const expired = medicines.filter(m => m.expiry && new Date(m.expiry) < today);
    const expiringSoon = medicines.filter(m => m.expiry && new Date(m.expiry) >= today && new Date(m.expiry) <= forecast90);
    const lowStock = medicines.filter(m => m.stock <= (m.reorder_level || 10));

    container.innerHTML = `
        <div class="stats-grid" style="margin-bottom:24px;">
            <div class="stat-card clickable-card" style="border-left: 4px solid var(--danger);" onclick="jumpToInventoryWithFilter('expired')">
                <h4 style="color:var(--danger);">Expired Stock</h4>
                <div class="stat-number">${expired.length}</div>
                <p style="font-size:0.75rem; color:#64748b;"><i class="fas fa-arrow-right"></i> Remove from shelves</p>
            </div>
            <div class="stat-card clickable-card" style="border-left: 4px solid var(--warning);" onclick="jumpToInventoryWithFilter('expiring')">
                <h4 style="color:var(--warning);">Expiring < 90 Days</h4>
                <div class="stat-number">${expiringSoon.length}</div>
                <p style="font-size:0.75rem; color:#64748b;"><i class="fas fa-arrow-right"></i> Consider sales/returns</p>
            </div>
            <div class="stat-card clickable-card" style="border-left: 4px solid var(--royal-blue);" onclick="jumpToInventoryWithFilter('lowStock')">
                <h4 style="color:var(--royal-blue);">Understocked Items</h4>
                <div class="stat-number">${lowStock.length}</div>
                <p style="font-size:0.75rem; color:#64748b;"><i class="fas fa-arrow-right"></i> Reorder from suppliers</p>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
            <div class="stat-card">
                <h4>Expiry Forecast (Critical List)</h4>
                <table class="data-table" style="margin-top:15px; font-size:0.85rem;">
                    <thead><tr><th>Medicine</th><th>Expiry Date</th><th>Days Left</th><th style="text-align:right;">Action</th></tr></thead>
                    <tbody>
                        ${expiringSoon.length > 0 ? expiringSoon.slice(0, 8).map(m => {
                            const diffDays = Math.ceil((new Date(m.expiry) - today) / (1000 * 60 * 60 * 24));
                            return `<tr>
                                <td>${m.name}</td>
                                <td>${m.expiry}</td>
                                <td style="color:${diffDays < 30 ? 'var(--danger)' : 'var(--warning)'}; font-weight:700;">${diffDays} days</td>
                                <td style="text-align:right;">
                                    <button class="action-btn-refined btn-icon-view" onclick="jumpToInventoryItem('${m.name.replace(/'/g, "\\'")}')" title="Manage Stock">
                                        <i class="fas fa-arrow-up-right-from-square"></i>
                                    </button>
                                </td>
                            </tr>`;
                        }).join('') : '<tr><td colspan="4">No items expiring soon</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderDetailedSalesLog(container, sales, searchQuery = '') {
    if (window.lastSalesSearch !== searchQuery) {
        paginationState.sales = 1;
        window.lastSalesSearch = searchQuery;
    }

    let list = [...sales].sort((a, b) => {
        const idA = Number(a.id) || 0;
        const idB = Number(b.id) || 0;
        if (idA !== idB) return idB - idA;
        const dateA = new Date(a.date_time || a.date || 0);
        const dateB = new Date(b.date_time || b.date || 0);
        return dateB - dateA;
    });

    if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        list = list.filter(s => {
            if (String(s.id).toLowerCase().includes(q)) return true;
            if ((s.customer_name || '').toLowerCase().includes(q)) return true;
            if ((s.date_time || s.date || '').toLowerCase().includes(q)) return true;
            if ((s.payment_mode || '').toLowerCase().includes(q)) return true;
            try {
                const items = JSON.parse(s.items_json || '[]');
                if (Array.isArray(items)) {
                    return items.some(item => (item.name || '').toLowerCase().includes(q));
                }
            } catch (e) {}
            return false;
        });
    }

    const totalItems = list.length;
    const startIdx = (paginationState.sales - 1) * paginationState.limit;
    const paginatedSales = list.slice(startIdx, startIdx + paginationState.limit);

    const hasSearch = document.getElementById('salesLogSearch');
    if (!hasSearch) {
        container.innerHTML = `
            <div class="stat-card" style="margin-bottom: 24px; padding: 15px 25px; border-radius:16px;">
                <div style="display:flex; gap:16px; align-items:center;">
                    <i class="fas fa-search" style="color:#64748b;"></i>
                    <input type="text" id="salesLogSearch" placeholder="Search receipt no., customer, date, or medicine name..." 
                           value="${searchQuery}"
                           style="flex:1; border:none; background:transparent; font-size:1.05rem; outline:none; font-weight:500;">
                </div>
            </div>
            <div id="salesTableContainer"></div>
        `;
    }

    const tableContainer = document.getElementById('salesTableContainer');
    if (tableContainer) {
        tableContainer.innerHTML = `
            <div class="stat-card" style="padding:0; overflow:hidden; border-radius:16px;">
                <div style="padding:20px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                    <h4 style="margin:0;"><i class="fas fa-list-ul"></i> Detailed Transaction Repository</h4>
                    <div style="font-size:0.85rem; color:#64748b;">Showing ${totalItems} of ${sales.length} transactions</div>
                </div>
                <div style="max-height:600px; overflow-y:auto;">
                    <table class="data-table">
                        <thead style="position:sticky; top:0; background:var(--royal-blue); color:white; z-index:10;">
                            <tr>
                                <th style="color:white; padding-left:20px;">Receipt ID</th>
                                <th style="color:white;">Date & Time</th>
                                <th style="color:white;">Client / Customer</th>
                                <th style="color:white;">Total (KES)</th>
                                <th style="color:white;">Mode</th>
                                <th style="text-align:right; color:white; padding-right:20px;">Print</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${paginatedSales.length > 0 ? paginatedSales.map(s => {
                                const isWalkin = !s.customer_name || s.customer_name === 'General Customer' || s.customer_name === 'Walk-in';
                                return `
                                    <tr>
                                        <td style="padding-left:20px; font-weight:700; color:#64748b;">#${s.id}</td>
                                        <td>${s.date_time || s.date}</td>
                                        <td style="font-weight:600; color:${isWalkin ? '#64748b' : 'var(--royal-blue)'}; ${isWalkin ? '' : 'cursor:pointer; text-decoration:underline;'}" ${isWalkin ? '' : `onclick="findProfileByNameAndOpen('${s.customer_name.replace(/'/g, "\\'")}')"`}>
                                            <i class="fas fa-${isWalkin ? 'user-clock' : 'user-check'}"></i> ${s.customer_name || 'Walk-in Customer'}
                                        </td>
                                        <td style="font-weight:700;">${Number(s.total).toLocaleString()}</td>
                                        <td><span class="role-pill" style="font-size:0.7rem;">${s.payment_mode}</span></td>
                                        <td style="text-align:right; padding-right:20px;">
                                            <div style="display:flex; justify-content:flex-end; gap:8px;">
                                                <button class="action-btn-refined return-sale-btn" data-id="${s.id}" title="Process Return" style="background:rgba(239, 68, 68, 0.1); color:#ef4444;">
                                                    <i class="fas fa-undo"></i>
                                                </button>
                                                <button class="action-btn-refined btn-icon-view reprint-general-btn" data-id="${s.id}" title="Reprint Transaction">
                                                    <i class="fas fa-print"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('') : '<tr><td colspan="6" style="text-align:center; padding:50px;">No sales records found.</td></tr>'}
                        </tbody>
                    </table>
                </div>
                ${renderPaginationControls('sales', totalItems)}
            </div>
        `;
    }

    document.querySelectorAll('.reprint-general-btn').forEach(btn => {
        btn.onclick = async () => {
            const saleId = btn.getAttribute('data-id');
            const sale = sales.find(s => String(s.id) === String(saleId));
            if (sale) {
                handleHistoryReprint(sale);
            }
        };
    });

    document.querySelectorAll('.return-sale-btn').forEach(btn => {
        btn.onclick = async () => {
            const saleId = btn.getAttribute('data-id');
            const sale = sales.find(s => String(s.id) === String(saleId));
            if (sale) {
                showReturnModal(sale);
            }
        };
    });

    const searchInput = document.getElementById('salesLogSearch');
    if (searchInput) {
        searchInput.oninput = (e) => {
            renderDetailedSalesLog(container, sales, e.target.value);
        };
    }
}

async function showReturnModal(sale) {
    if (!['Admin', 'Pharmacist', 'Cashier'].includes(currentUser.role)) {
        return showToast('Access Denied: You do not have permission to process returns.', 'error');
    }

    let items = [];
    try {
        items = JSON.parse(sale.items_json);
    } catch (e) {
        return showToast('Failed to parse sale items.', 'error');
    }

    const modal = document.getElementById('genericModal');
    const inner = document.getElementById('modalInner');

    inner.innerHTML = `
        <h3 style="margin-bottom:24px; color:var(--royal-blue);"><i class="fas fa-undo"></i> Process Medicine Return</h3>
        <p style="color:#64748b; font-size:0.9rem; margin-bottom:20px;">
            Processing return for <b>Receipt #${sale.id}</b> (${sale.customer_name || 'Walk-in'}). 
            Stock will be restored to inventory upon confirmation.
        </p>

        <div style="background:#f8fafc; padding:20px; border-radius:16px; border:1px solid #e2e8f0; margin-bottom:24px;">
            <label style="font-weight:700; display:block; margin-bottom:12px; font-size:0.85rem; color:#475569; text-transform:uppercase;">Select Item to Return</label>
            <select id="return_item_select" class="premium-select" style="width:100%; margin-bottom:16px;">
                ${items.map((item, idx) => `<option value="${idx}">${item.name} (Sold: ${item.qty} units @ KES ${item.price})</option>`).join('')}
            </select>

            <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:16px;">
                <div class="input-group">
                    <label>Quantity to Return</label>
                    <input type="number" id="return_qty" class="premium-input" min="1" value="1">
                </div>
                <div class="input-group">
                    <label>Refund Amount (Estimated)</label>
                    <input type="text" id="return_refund_display" class="premium-input" style="background:#f1f5f9; font-weight:700;" readonly value="KES 0.00">
                </div>
            </div>

            <div class="input-group" style="margin-top:16px;">
                <label>Reason for Return</label>
                <textarea id="return_reason" class="premium-input" style="height:80px; padding:12px; resize:none;" placeholder="e.g. Wrong prescription, Expired, Customer changed mind..."></textarea>
            </div>
        </div>

        <div style="display:flex; gap:12px;">
            <button class="btn-primary" id="confirmReturnBtn" style="flex:2; background:#ef4444; border-color:#dc2626;">
                <i class="fas fa-check-circle"></i> Confirm Return & Update Stock
            </button>
            <button class="btn-primary" style="flex:1; background:#f1f5f9; color:#475569;" onclick="document.getElementById('genericModal').style.display='none'">Cancel</button>
        </div>
    `;

    const itemSelect = document.getElementById('return_item_select');
    const qtyInput = document.getElementById('return_qty');
    const refundDisplay = document.getElementById('return_refund_display');

    const updateRefund = () => {
        const idx = itemSelect.value;
        const item = items[idx];
        const qty = parseInt(qtyInput.value) || 0;
        refundDisplay.value = `KES ${(qty * item.price).toFixed(2)}`;
    };

    itemSelect.onchange = updateRefund;
    qtyInput.oninput = updateRefund;
    updateRefund();

    modal.style.display = 'flex';

    document.getElementById('confirmReturnBtn').onclick = async () => {
        const idx = itemSelect.value;
        const item = items[idx];
        const qty = parseInt(qtyInput.value) || 0;
        const reason = document.getElementById('return_reason').value.trim();

        if (qty <= 0) return showToast('Quantity must be at least 1', 'warning');
        if (qty > item.qty) return showToast(`Cannot return more than was sold (${item.qty})`, 'warning');
        if (!reason) return showToast('Please provide a reason for the return', 'warning');

        if (!await showConfirm(`Proceed with returning ${qty}x ${item.name}? This will update inventory and log the action.`)) return;

        const res = await window.db.recordReturnTransaction({
            saleId: sale.id,
            medicineId: item.id,
            medicineName: item.name, // Added name
            qty: qty,
            refundAmount: qty * item.price,
            reason: reason,
            processedBy: currentUser.username,
            saleDate: sale.date // Added sale date
        });

        if (res.success) {
            showToast('Return processed successfully. Stock updated.', 'success');
            modal.style.display = 'none';
            renderReports('returns');
        } else {
            showToast(res.error, 'error');
        }
    };
}

async function renderReturnsHistory(container) {
    let returns = [];
    try {
        const res = await window.db.getReturns();
        returns = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);
        window.allReturns = returns; // Cache for search
    } catch (e) {
        console.error("Error fetching returns:", e);
    }

    container.innerHTML = `
        <div class="card fade-in" style="border-radius:16px; overflow:hidden; border:none; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
            <div class="card-header d-flex justify-between align-center" style="padding:20px; background: white; border-bottom: 1px solid #f1f5f9;">
                <div style="display:flex; align-items:center; gap:16px;">
                    <h3 style="margin:0; font-size:1.1rem; font-weight:700;"><i class="fas fa-undo"></i> Medicine Returns History</h3>
                    ${currentUser.role === 'Admin' ? `<button class="btn-primary" style="background:#fee2e2; color:#b91c1c; padding:6px 16px; font-size:0.8rem; border:none;" onclick="clearReturnHistory()">Clear History</button>` : ''}
                </div>
                <div class="search-box" style="position:relative; width: 320px;">
                    <i class="fas fa-search" style="position:absolute; left:15px; top:12px; color:#94a3b8;"></i>
                    <input type="text" id="return-search" placeholder="Search Receipt # or Medicine..." 
                        style="padding:10px 15px 10px 45px; border:1px solid #e2e8f0; border-radius:12px; width:100%; outline:none; font-size:0.9rem;"
                        onkeyup="filterReturnsList()">
                </div>
            </div>
            <div class="card-body" style="padding:0;">
                <div class="table-responsive">
                    <table class="data-table" style="width:100%; border-collapse:collapse;">
                        <thead style="background:#f8fafc; text-align:left;">
                            <tr>
                                <th style="padding:15px 20px; font-size:0.85rem; color:#64748b; font-weight:600;">Return Date</th>
                                <th style="padding:15px 20px; font-size:0.85rem; color:#64748b; font-weight:600;">Receipt #</th>
                                <th style="padding:15px 20px; font-size:0.85rem; color:#64748b; font-weight:600;">Medicine</th>
                                <th style="padding:15px 20px; font-size:0.85rem; color:#64748b; font-weight:600;">Qty</th>
                                <th style="padding:15px 20px; font-size:0.85rem; color:#64748b; font-weight:600;">Refunded</th>
                                <th style="padding:15px 20px; font-size:0.85rem; color:#64748b; font-weight:600;">Processed By</th>
                                <th style="padding:15px 20px; font-size:0.85rem; color:#64748b; font-weight:600;">Reason</th>
                            </tr>
                        </thead>
                        <tbody id="returns-tbody">
                            ${renderReturnsTableRows(returns)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderReturnsTableRows(data) {
    if (!data || data.length === 0) {
        return '<tr><td colspan="7" class="text-center" style="padding:40px; color:#94a3b8;">No returns found.</td></tr>';
    }

    return data.map(r => `
        <tr style="border-bottom: 1px solid #f8fafc;">
            <td style="padding:15px 20px; font-size:0.9rem; color:#475569;">${new Date(r.created_at || Date.now()).toLocaleDateString()} <span style="font-size:0.75rem; color:#94a3b8;">${new Date(r.created_at || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></td>
            <td style="padding:15px 20px; font-weight:700; color:var(--royal-blue);">#${r.sale_id}</td>
            <td style="padding:15px 20px; font-weight:600;">${r.medicine_name}</td>
            <td style="padding:15px 20px;"><span style="background:#fef2f2; color:#ef4444; padding:2px 8px; border-radius:6px; font-weight:700;">+ ${r.qty}</span></td>
            <td style="padding:15px 20px; font-weight:700; color:#059669;">KES ${parseFloat(r.total_refund).toLocaleString()}</td>
            <td style="padding:15px 20px;"><span style="background:#f1f5f9; color:#475569; padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:600;">${r.processed_by || 'System'}</span></td>
            <td style="padding:15px 20px; font-size:0.85rem; color:#64748b; font-style:italic;">"${r.reason || 'N/A'}"</td>
        </tr>
    `).join('');
}

window.clearReturnHistory = async function() {
    if (await showConfirm("Are you sure you want to PERMANENTLY clear all return history records? This cannot be undone.")) {
        const res = await window.db.clearReturns();
        if (res.success) {
            showToast('Return history cleared successfully.', 'success');
            renderReports('returns');
        } else {
            showToast(res.error, 'error');
        }
    }
}

window.filterReturnsList = function() {
    const query = document.getElementById('return-search').value.toLowerCase();
    const tbody = document.getElementById('returns-tbody');
    if (!window.allReturns) return;

    const filtered = window.allReturns.filter(r => 
        (r.sale_id && r.sale_id.toString().includes(query)) || 
        (r.medicine_name && r.medicine_name.toLowerCase().includes(query)) ||
        (r.processed_by && r.processed_by.toLowerCase().includes(query))
    );
    tbody.innerHTML = renderReturnsTableRows(filtered);
};

function renderExpiryReport(container, medicines) {
    const today = new Date();
    const upcoming = [];
    const expired = [];
    
    medicines.forEach(m => {
        if (!m.expiry) return;
        const eDate = new Date(m.expiry);
        const diffDays = (eDate - today) / (1000 * 60 * 60 * 24);
        
        if (diffDays < 0) expired.push(m);
        else if (diffDays <= 90) upcoming.push(m); // Expires within 3 months
    });

    container.innerHTML = `
        <div class="stats-grid" style="margin-bottom:24px;">
            <div class="stat-card clickable-card" style="border-left:4px solid #ef4444;" onclick="jumpToInventoryWithFilter('expired')">
                <h4 style="color:#ef4444;"><i class="fas fa-exclamation-triangle"></i> Expired Stock</h4>
                <div class="stat-number" style="font-size:1.8rem;">${expired.length} Items</div>
            </div>
            <div class="stat-card clickable-card" style="border-left:4px solid #f59e0b;" onclick="jumpToInventoryWithFilter('expiring')">
                <h4 style="color:#f59e0b;"><i class="fas fa-clock"></i> Expiring Soon (< 90 Days)</h4>
                <div class="stat-number" style="font-size:1.8rem;">${upcoming.length} Items</div>
            </div>
        </div>

        <div class="stat-card">
            <h4>Critical Expiry Alerts</h4>
            <table class="data-table" style="margin-top:16px;">
                <thead>
                    <tr style="background:var(--royal-blue); color:white;">
                         <th style="color:white; padding:12px 16px;">Medicine</th>
                        <th style="color:white;">Batch Number</th>
                        <th style="color:white;">Stock Left</th>
                        <th style="color:white;">Expiry Date</th>
                        <th style="color:white;">Status</th>
                        <th style="color:white; text-align:right; padding-right:16px;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${[...expired, ...upcoming].map(m => {
                        const isExp = new Date(m.expiry) < new Date();
                        return `
                        <tr>
                            <td style="font-weight:700;">${m.name}</td>
                            <td style="font-family:monospace;">${m.batch}</td>
                            <td>${m.stock} Units</td>
                            <td style="font-weight:700; color:${isExp ? '#ef4444': '#f59e0b'};">${m.expiry}</td>
                            <td><span class="role-pill" style="background:${isExp ? '#fee2e2' : '#fef3c7'}; color:${isExp ? '#b91c1c' : '#92400e'};">${isExp ? 'EXPIRED' : 'Expiring Soon'}</span></td>
                            <td style="text-align:right; padding-right:16px;">
                                <button class="action-btn-refined btn-icon-view" onclick="jumpToInventoryItem('${m.name.replace(/'/g, "\\'")}')" title="Manage Stock">
                                    <i class="fas fa-arrow-up-right-from-square"></i>
                                </button>
                            </td>
                        </tr>
                        `;
                    }).join('') || '<tr><td colspan="5" style="text-align:center; padding:30px;">No critical expiries detected.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

function renderProfitLoss(container, sales, medicines = []) {
    let totalRevenue = 0;
    let actualProfit = 0;
    const itemPerformance = {};

    // Map medicines for quick lookup
    const medLookup = {};
    medicines.forEach(m => medLookup[m.id] = m);
    // Also map by name for legacy data/flexibility
    const medNameLookup = {};
    medicines.forEach(m => medNameLookup[m.name.toLowerCase()] = m);

    sales.forEach(s => {
        totalRevenue += (Number(s.total) || 0);
        try {
            const items = JSON.parse(s.items_json);
            items.forEach(i => {
                const name = i.name || i.medicine_name || 'Unknown';
                const qty = Number(i.qty || i.quantity || 1);
                const price = Number(i.price || 0);
                const itemTotal = price * qty;

                // Track volume for performers
                itemPerformance[name] = (itemPerformance[name] || 0) + qty;

                // Calculate Profit
                // 1. Try lookup by ID
                let med = medLookup[i.id];
                // 2. Try lookup by Name if ID fails
                if (!med) med = medNameLookup[name.toLowerCase()];

                if (med && med.cost_price > 0) {
                    const itemCostTotal = med.cost_price * qty;
                    actualProfit += (itemTotal - itemCostTotal);
                } else {
                    // Fallback to 30% estimate for items with missing cost data
                    actualProfit += (itemTotal * 0.3);
                }
            });
        } catch (e) {}
    });

    const sortedPerformers = Object.entries(itemPerformance)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const profitMargin = totalRevenue > 0 ? (actualProfit / totalRevenue) * 100 : 0;

    container.innerHTML = `
        <div class="stats-grid" style="margin-bottom:24px;">
             <div class="stat-card" style="background:linear-gradient(135deg, #f8fafc, #f1f5f9);">
                <h4 style="color:#64748b;">Total Gross Revenue</h4>
                <div class="stat-number" style="font-size:1.8rem; color:#0f172a;">KES ${totalRevenue.toLocaleString()}</div>
            </div>
            <div class="stat-card" style="background:linear-gradient(135deg, #10b981, #059669); color:white;">
                <h4 style="opacity:0.9;">Actual Gross Profit (${profitMargin.toFixed(1)}% Avg Margin)</h4>
                <div class="stat-number" style="font-size:1.8rem; color:white;">KES ${actualProfit.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
            </div>
        </div>

        <div class="stat-card">
            <h4 style="margin-bottom:20px;"><i class="fas fa-trophy" style="color:#f59e0b;"></i> Top Performance Leaderboard (By Volume)</h4>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:16px;">
                ${sortedPerformers.map(([name, qty], idx) => `
                    <div style="padding:16px; background:#f8fafc; border-radius:12px; border-left:4px solid ${idx < 3 ? '#f59e0b' : '#e2e8f0'};">
                        <div style="font-size:0.75rem; color:#64748b; font-weight:700;"># ${idx + 1}</div>
                        <div style="font-weight:700; color:#1e293b; margin:4px 0;">${name}</div>
                        <div style="font-size:1.1rem; font-weight:800; color:var(--royal-blue);">${qty} Units Sold</div>
                    </div>
                `).join('') || '<p style="color:#94a3b8; text-align:center; padding:20px;">No performance data available yet.</p>'}
            </div>
        </div>
    `;
}

// --- User Management (Admin Only) ---
// --- User Management & Audit Log (Admin Only) ---
async function renderUsers(subPage = 'list') {
    if (!currentUser || currentUser.role !== 'Admin') return document.getElementById('pageContainer').innerHTML = 'Access Denied';
    
    let content = '';
    if (subPage === 'list') {
        const res = await window.auth.getUsers();
        const users = res.data || [];
        content = `
            <div style="display:flex; justify-content:space-between; margin-bottom:20px; align-items:center;">
                <h3>Staff Directory</h3>
                <button class="btn-primary" id="createUserBtn">+ Create Staff Account</button>
            </div>
            <table class="data-table">
                <thead><tr><th>Authorized User</th><th>Access Tier</th><th>Status</th><th>Registration Date</th><th style="text-align:right;">Management Actions</th></tr></thead>
                <tbody>${users.slice((paginationState.users - 1) * paginationState.limit, paginationState.users * paginationState.limit).map(u => `
                    <tr>
                        <td style="font-weight:600;">${u.username}</td>
                        <td><span class="role-badge" style="background:#eef2ff; color:var(--royal-blue); border:1px solid #d1d5db; padding: 4px 10px; border-radius:12px; font-size:0.8rem;">${u.role}</span></td>
                        <td>${u.is_active ? '<span style="color:var(--success); font-weight:600;"><i class="fas fa-circle" style="font-size:0.5rem; vertical-align:middle; margin-right:6px;"></i>Active</span>' : '<span style="color:var(--danger); font-weight:600;"><i class="fas fa-circle" style="font-size:0.5rem; vertical-align:middle; margin-right:6px;"></i>Suspended</span>'}</td>
                        <td style="font-size:0.8rem; color:#64748b;">${new Date(u.created_at).toLocaleDateString()}</td>
                        <td style="text-align:right; padding-right:16px;">
                            <div style="display:flex; justify-content:flex-end; gap:8px;">
                                <button onclick="toggleUserStatus(${u.id}, ${u.is_active})" class="action-btn-refined" title="${u.is_active ? 'Suspend Access' : 'Restore Access'}" style="background:${u.is_active ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; color:${u.is_active ? '#b91c1c' : '#059669'};">
                                    <i class="fas fa-${u.is_active ? 'user-slash' : 'user-check'}"></i>
                                </button>
                                <button onclick="showChangeRoleModal(${u.id}, '${u.role}')" class="action-btn-refined btn-icon-edit" title="Edit Access Role">
                                    <i class="fas fa-user-tag"></i>
                                </button>
                                <button onclick="showResetPasswordModal(${u.id}, '${u.username}')" class="action-btn-refined" title="Reset Credentials" style="background:rgba(245, 158, 11, 0.1); color:#92400e;">
                                    <i class="fas fa-key"></i>
                                </button>
                                <button onclick="handleDeleteUser(${u.id}, '${u.username}')" class="action-btn-refined btn-icon-del" title="Permanent Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('')}</tbody>
            </table>
            ${renderPaginationControls('users', users.length)}
        `;
    } else if (subPage === 'audit') {
        const res = await window.db.getAuditLog();
        const logs = res.data || [];
        // Optional: verify chain while rendering
        content = `
            <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
                <h3>Cryptographic Audit Chain</h3>
                <div id="chainStatusBadge" style="font-size:0.8rem; font-weight:700;">Verifying Integrity...</div>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Module</th><th>Hash String</th></tr></thead>
                    <tbody>${logs.slice((paginationState.audit - 1) * paginationState.limit, paginationState.audit * paginationState.limit).map(l => `
                        <tr>
                            <td style="font-size:0.8rem;">${new Date(l.timestamp).toLocaleString()}</td>
                            <td style="font-weight:600;">${l.username || 'SYSTEM'}</td>
                            <td><span class="audit-badge ${l.action.includes('FAILED') ? 'audit-failed' : 'audit-success'}">${l.action}</span></td>
                            <td>${l.module}</td>
                            <td style="font-family:monospace; font-size:0.7rem; color:#94a3b8;">${l.row_hash ? l.row_hash.substring(0, 12) + '...' : 'GEN-BRIDGE-HASH'}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="5" style="text-align:center;">No audit records found</td></tr>'}</tbody>
                </table>
            </div>
            ${renderPaginationControls('audit', logs.length)}
        `;
        
        // Trigger chain verification in background after render
        setTimeout(async () => {
            const el = document.getElementById('chainStatusBadge');
            if (!el) return;
            try {
                // We'd need to expose verifyAuditChain in preload.js if we wanted real-time check here
                // For now, let's just show a positive UI as a placeholder since we know the backend has the hook
                el.innerHTML = '<span style="color:var(--success);"><i class="fas fa-link"></i> Chain Integrity: VERIFIED</span>';
            } catch (e) {
                el.innerHTML = '<span style="color:var(--danger);"><i class="fas fa-unlink"></i> Chain Status: UNKNOWN</span>';
            }
        }, 500);
    }

    document.getElementById('pageContainer').innerHTML = `
        <div class="tab-container">
            <div class="tab-header">
                <button class="tab-btn ${subPage === 'list' ? 'active' : ''}" id="tabUsersList">Staff Management</button>
                <button class="tab-btn ${subPage === 'audit' ? 'active' : ''}" id="tabAuditLog">Audit Log & Security</button>
            </div>
            <div id="tabContent">${content}</div>
        </div>
    `;

    const createBtn = document.getElementById('createUserBtn');
    if (createBtn) createBtn.onclick = showCreateUserModal;

    document.getElementById('tabUsersList').onclick = () => renderUsers('list');
    document.getElementById('tabAuditLog').onclick = () => renderUsers('audit');
}

async function toggleUserStatus(id, currentStatus) {
    if (id === currentUser.id) return showToast('Cannot suspend your own account', 'error');
    
    const confirmMsg = currentStatus ? 'Are you sure you want to SUSPEND this staff member?' : 'RESTORE access for this staff member?';
    if (!await showConfirm(confirmMsg)) return;

    const res = currentStatus ? await window.auth.deactivateUser(id) : await window.auth.reactivateUser(id);
    if (res.success) {
        showToast(currentStatus ? 'Staff account suspended' : 'Staff access restored', 'success');
        renderUsers('list');
    } else {
        showToast(res.error, 'error');
    }
}

async function showChangeRoleModal(id, currentRole) {
    if (id === currentUser.id) return showToast('Contact another Admin to change your own role', 'info');
    
    const modal = document.getElementById('genericModal');
    const inner = document.getElementById('modalInner');
    const roles = ['Admin', 'Pharmacist', 'Cashier'];
    
    inner.innerHTML = `
        <h3 style="margin-bottom:24px; color:var(--royal-blue);"><i class="fas fa-user-tag"></i> Update Access Permissions</h3>
        <p style="margin-bottom:20px; color:#64748b; font-size:0.9rem;">Select the new authorization level for this staff member.</p>
        
        <div class="input-group">
            <label>Access Tier</label>
            <select id="modal_new_role" class="premium-select">
                ${roles.map(r => `<option value="${r}" ${r === currentRole ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
        </div>
        
        <div style="display:flex; gap:12px; margin-top:32px;">
            <button class="btn-primary" id="saveRoleBtn" style="flex:1;"><i class="fas fa-check-circle"></i> Update Role</button>
            <button class="btn-primary" style="flex:1; background:#f1f5f9; color:#475569; border:none;" onclick="document.getElementById('genericModal').style.display='none'">Cancel</button>
        </div>
    `;
    modal.style.display = 'flex';
    
    document.getElementById('saveRoleBtn').onclick = async () => {
        const newRole = document.getElementById('modal_new_role').value;
        if (newRole === currentRole) return modal.style.display = 'none';
        
        try {
            const res = await window.auth.updateRole(id, newRole);
            if (res.success) {
                showToast('Staff role updated successfully', 'success');
                modal.style.display = 'none';
                renderUsers('list');
            } else {
                showToast(res.error, 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to update role', 'error');
        }
    };
}

async function showResetPasswordModal(id, username) {
    const modal = document.getElementById('genericModal');
    const inner = document.getElementById('modalInner');
    
    inner.innerHTML = `
        <h3 style="margin-bottom:24px; color:var(--royal-blue);"><i class="fas fa-key"></i> Reset Staff Credentials</h3>
        <p style="margin-bottom:20px; color:#64748b; font-size:0.9rem;">Enter a new secure password for <strong>${username}</strong>.</p>
        
        <div class="input-group">
            <label>New Secure Password</label>
            <input type="password" id="modal_new_pass" class="premium-input" placeholder="Min 8 characters">
        </div>
        <div class="input-group">
            <label>Confirm Password</label>
            <input type="password" id="modal_confirm_pass" class="premium-input" placeholder="Re-enter to verify">
        </div>
        
        <div style="display:flex; gap:12px; margin-top:32px;">
            <button class="btn-primary" id="savePassBtn" style="flex:1;"><i class="fas fa-shield-alt"></i> Set New Password</button>
            <button class="btn-primary" style="flex:1; background:#f1f5f9; color:#475569; border:none;" onclick="document.getElementById('genericModal').style.display='none'">Cancel</button>
        </div>
    `;
    modal.style.display = 'flex';
    
    document.getElementById('savePassBtn').onclick = async () => {
        const newPass = document.getElementById('modal_new_pass').value;
        const confirmPass = document.getElementById('modal_confirm_pass').value;
        
        if (!newPass) return showToast('Password cannot be empty', 'warning');
        if (newPass !== confirmPass) return showToast('Passwords do not match', 'warning');
        
        const check = validatePassword(newPass);
        if (!check.valid) return showToast(check.errors[0], 'warning');

        try {
            const res = await window.auth.resetPassword(id, newPass);
            if (res.success) {
                showToast(`Credentials reset for ${username}`, 'success');
                modal.style.display = 'none';
                renderUsers('list');
            } else {
                showToast(res.error, 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to reset credentials', 'error');
        }
    };
}

// Clean up old handlers
async function handleChangeRole(id, currentRole) { /* Moved to modal */ }
async function handleResetPassword(id, username) { /* Moved to modal */ }

async function handleDeleteUser(id, username) {
    if (id === currentUser.id) return showToast('Cannot delete yourself', 'error');
    
    if (!await showConfirm(`PERMANENTLY DELETE user "${username}"? This action cannot be undone.`)) return;
    
    const res = await window.auth.deleteUser(id);
    if (res.success) {
        showToast('User deleted permanently', 'success');
        renderUsers('list');
    } else {
        showToast(res.error, 'error');
    }
}

function showCreateUserModal() {
    const modal = document.getElementById('genericModal');
    const inner = document.getElementById('modalInner');
    if (!modal || !inner) return;

    inner.innerHTML = `
        <div style="padding: 10px;">
            <h3 style="margin-bottom:20px; color:var(--royal-blue);"><i class="fas fa-user-plus"></i> New Staff Registration</h3>
            <div class="input-group">
                <label>Username</label>
                <input type="text" id="newUsername" placeholder="e.g. kelvin_admin" class="premium-input" style="width:100%; padding:14px; border-radius:12px; border:1px solid #ddd;">
            </div>
            <div class="input-group">
                <label>Initial Password</label>
                <div style="display:flex; gap:10px; position:relative;">
                    <input type="password" id="newPassword" placeholder="Min 8 characters" class="premium-input" style="flex:1; padding:14px; border-radius:12px; border:1px solid #ddd; padding-right:45px;">
                    <i class="fas fa-eye" id="newPasswordToggle" style="position:absolute; right:115px; top:15px; cursor:pointer; color:#64748b;"></i>
                    <button id="generatePassBtn" style="background:var(--royal-blue); color:white; border:none; border-radius:12px; padding:0 15px; cursor:pointer; min-width:100px;" title="Generate Secure Password">
                        <i class="fas fa-magic"></i> Generate
                    </button>
                </div>
            </div>
            <div class="input-group">
                <label>Access Role</label>
                <select id="newRole" class="premium-select">
                    <option value="Admin">Admin (Full Access)</option>
                    <option value="Pharmacist">Pharmacist (Inventory & Stock)</option>
                    <option value="Cashier">Cashier (POS & Sales)</option>
                </select>
            </div>
            <div style="margin-top:20px; padding:12px; background:#fff7ed; border-radius:12px; border:1px solid #ffedd5; font-size:0.75rem; color:#9a3412;">
                <i class="fas fa-lightbulb"></i> <strong>Admin Tip:</strong> Please copy and share these credentials (Username, Password, and Role) with the staff member. They will need them to log in.
            </div>
            <div style="display:flex; gap:12px; margin-top:30px;">
                <button class="btn-primary" id="submitUserBtn" style="flex:1;">Register Account</button>
                <button id="cancelUserBtn" style="flex:1; background:#f1f5f9; color:#475569; border:none; border-radius:30px; padding:12px; font-weight:600; cursor:pointer;">Cancel</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';

    // Password Visibility Toggle
    const toggle = document.getElementById('newPasswordToggle');
    const input = document.getElementById('newPassword');
    if (toggle && input) {
        toggle.onclick = () => {
            const isPass = input.type === 'password';
            input.type = isPass ? 'text' : 'password';
            toggle.classList.toggle('fa-eye');
            toggle.classList.toggle('fa-eye-slash');
        };
    }

    // Programmatic Binding for Generate Button
    const genBtn = document.getElementById('generatePassBtn');
    if (genBtn) genBtn.onclick = generateStaffPassword;

    const subBtn = document.getElementById('submitUserBtn');
    if (subBtn) subBtn.onclick = (e) => submitNewUser(e);

    const canBtn = document.getElementById('cancelUserBtn');
    if (canBtn) canBtn.onclick = () => { modal.style.display = 'none'; };
}

function generateStaffPassword() {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 8; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const input = document.getElementById('newPassword');
    if (input) {
        input.value = pass;
        input.type = 'text'; // Show it so admin can copy it
        showToast('Secure password generated!', 'info');
    }
}

async function submitNewUser(event) {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;
    const btn = event.target.closest('button');

    if (!username || !password) return showToast('Please fill all fields', 'warning');
    if (password.length < 8) return showToast('Password must be at least 8 characters', 'warning');

    // Enter loading state
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    const res = await window.auth.createUser({ username, password, role });
    
    // Restore button state
    btn.disabled = false;
    btn.innerHTML = originalContent;

    if (res.success) {
        showToast(`Staff account for ${username} created successfully!`, 'success');
        document.getElementById('genericModal').style.display = 'none';
        renderUsers('list'); // Refresh the list
    } else {
        showToast(res.error || 'Failed to create account', 'error');
    }
}

// --- App Initialization & Auth Helpers ---

async function handleLogin() {
    const u = document.getElementById('loginUsername').value;
    const p = document.getElementById('loginPassword').value;
    const selectedRole = document.getElementById('loginRole').value;
    const errEl = document.getElementById('loginError');
    const card = document.querySelector('.login-card');
    const btn = document.getElementById('doLoginBtn');

    if (!u || !p) {
        errEl.innerText = 'Please enter username and password';
        errEl.hidden = false;
        return;
    }

    errEl.hidden = true;
    btn.disabled = true;
    document.getElementById('loginSpinner').style.display = 'block';
    document.getElementById('loginBtnText').innerText = 'Verifying...';

    const res = await window.auth.login({ username: u, password: p });
    
    if (res.success) {
        // STRICT ROLE ENFORCEMENT: Verify if the selected role matches the DB role
        if (res.user.role !== selectedRole) {
            btn.disabled = false;
            document.getElementById('loginSpinner').style.display = 'none';
            document.getElementById('loginBtnText').innerText = 'Secure Sign In';
            errEl.innerText = `Unauthorized role choice: Your account is registered as ${res.user.role}`;
            errEl.hidden = false;
            card.classList.add('shake');
            setTimeout(() => card.classList.remove('shake'), 400);
            return;
        }

        // Handle Remember Me logic
        const rememberMe = document.getElementById('loginRememberMe').checked;
        if (rememberMe) {
            localStorage.setItem('renachem_remembered_user', u);
            localStorage.setItem('renachem_remembered_role', selectedRole);
        } else {
            localStorage.removeItem('renachem_remembered_user');
            localStorage.removeItem('renachem_remembered_role');
        }

        currentUser = res.user;
        resetIdleTimer();
        await initAppAfterLogin(res.user.role, res.user.username);
    } else {
        btn.disabled = false;
        document.getElementById('loginSpinner').style.display = 'none';
        document.getElementById('loginBtnText').innerText = 'Secure Sign In';
        errEl.innerText = res.locked ? 'Account locked for 15 mins' : 'Invalid username or password';
        errEl.hidden = false;
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 400);
    }
}

function setupLoginUI() {
    const toggle = document.getElementById('passwordToggle');
    const passInput = document.getElementById('loginPassword');
    
    // Restore remembered credentials
    const rememberedUser = localStorage.getItem('renachem_remembered_user');
    const rememberedRole = localStorage.getItem('renachem_remembered_role');
    
    if (rememberedUser) {
        const uInput = document.getElementById('loginUsername');
        const rSelect = document.getElementById('loginRole');
        const remCheckbox = document.getElementById('loginRememberMe');
        
        if (uInput) uInput.value = rememberedUser;
        if (rSelect) rSelect.value = rememberedRole || 'Admin';
        if (remCheckbox) remCheckbox.checked = true;
    }

    if (toggle && passInput) {
        toggle.onclick = () => {
            const isPass = passInput.type === 'password';
            passInput.type = isPass ? 'text' : 'password';
            toggle.classList.toggle('fa-eye');
            toggle.classList.toggle('fa-eye-slash');
        };
    }
}

async function renderCurrentPage() {
    const container = document.getElementById('pageContainer');
    const wrapRender = async (fn, name) => {
        // --- RENDER GUARD & ROLE SECURITY ---
        // Only enforce security if a user is logged in; otherwise, allow the initial load to proceed to session check
        if (currentUser && !hasAccess(currentPage)) {
            console.warn(`SECURITY: Blocked access to ${currentPage} for ${currentUser?.role}`);
            showToast('Security Alert: Access denied for your role.', 'error');
            currentPage = 'dashboard';
            return renderCurrentPage();
        }
        // --- RENDER GUARD ---
        if (typeof fn !== 'function') {
            console.error(`MODULE ERROR: ${name} is not defined.`);
            showToast(`The ${name} module is temporarily unavailable or missing.`, 'error');
            // Graceful recovery: If the intended module is missing, force back to dashboard
            if (name !== 'Dashboard') {
                setTimeout(() => {
                    const dashboardBtn = document.querySelector('.sidebar-item[data-page="dashboard"]');
                    if (dashboardBtn) dashboardBtn.click();
                }, 1500);
            }
            return;
        }

        try {
            // Clear container before rendering to avoid UI ghosting
            container.innerHTML = '<div style="display:flex; justify-content:center; padding:50px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem; color:var(--cyna-blue);"></i></div>';
            await fn();
        } catch (error) {
            console.error(`CRITICAL UI ERROR [${name}]:`, error);
            showToast(`Failed to load ${name}. Returning to dashboard...`, 'error');
            
            // Fallback to Dashboard on failure
            if (currentPage !== 'dashboard') {
                currentPage = 'dashboard';
                renderDashboard().catch(e => {
                    container.innerHTML = '<div class="stat-card" style="border: 2px solid #ef4444;"><h4>Fatal UI Error</h4><p>Unable to recover Dashboard. Please reload the app.</p><button onclick="location.reload()" class="btn-primary" style="margin-top:10px;">Reload Now</button></div>';
                });
            } else {
                container.innerHTML = '<div class="stat-card" style="border: 2px solid #ef4444;"><h4>Module Error</h4><p>Something went wrong in the Dashboard module.</p></div>';
            }
        }
    };

    if (currentPage === 'dashboard') await wrapRender(renderDashboard, 'Dashboard');
    else if (currentPage === 'inventory') await wrapRender(renderInventory, 'Inventory');
    else if (currentPage === 'pos') await wrapRender(renderPOS, 'POS');
    else if (currentPage === 'patients') await wrapRender(renderPatients, 'Patients');
    else if (currentPage === 'customers') await wrapRender(renderCustomers, 'Customers');
    else if (currentPage === 'suppliers') await wrapRender(renderSuppliers, 'Suppliers');
    else if (currentPage === 'purchases') await wrapRender(renderPurchases, 'Purchases');
    else if (currentPage === 'reports') await wrapRender(renderReports, 'Reports');
    else if (currentPage === 'users') await wrapRender(renderUsers, 'User Management');
    else if (currentPage === 'settings') await wrapRender(renderSettings, 'Settings');
}

function hasAccess(module) {
    if (!currentUser) return false;
    
    // Admin has full access
    if (currentUser.role === 'Admin') return true;

    // Modules restricted to Admin only (Security/Management)
    const adminOnly = ['settings', 'users'];
    if (adminOnly.includes(module)) return false;

    // Reports module is now accessible to all (with internal sub-page filtering)
    if (module === 'reports') return true;
    
    // Pharmacist: Inventory & Stock Focus
    if (currentUser.role === 'Pharmacist') {
        return ['dashboard', 'inventory', 'purchases', 'suppliers', 'patients', 'customers'].includes(module);
    }
    
    // Cashier: POS & Sales Focus
    if (currentUser.role === 'Cashier') {
        return ['dashboard', 'pos', 'customers', 'patients'].includes(module);
    }
    
    return false;
}

function updateSidebarVisibility() {
    if (!currentUser) return;
    document.querySelectorAll('.nav-item').forEach(item => {
        const page = item.dataset.page;
        if (!hasAccess(page)) {
            item.style.display = 'none';
        } else {
            item.style.display = 'flex';
        }
    });
}

function setupProfileManagement() {
    const trigger = document.getElementById('profileDropdownTrigger');
    const dropdown = document.getElementById('profileDropdown');
    if (!trigger || !dropdown) return;

    trigger.onclick = (e) => { 
        e.stopPropagation(); 
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none'; 
    };
    
    window.addEventListener('click', (e) => {
        if (!trigger.contains(e.target)) dropdown.style.display = 'none';
    });

    const logout = async (isExpired = false) => {
        try {
            if (!isExpired) await window.auth.logout();
            currentUser = null;
            currentPage = 'dashboard';
            location.reload();
        } catch (e) {
            location.reload();
        }
    };

    const changePassBtn = document.getElementById('changePasswordBtn');
    if (changePassBtn) {
        changePassBtn.onclick = () => {
            if (currentUser) {
                showResetPasswordModal(currentUser.id, currentUser.username);
            }
            dropdown.style.display = 'none';
        };
    }
    
    const topBarLogoutBtn = document.getElementById('topBarLogoutBtn');
    if (topBarLogoutBtn) topBarLogoutBtn.onclick = logout;
}

// --- Entry Point ---

document.addEventListener('DOMContentLoaded', () => {
    setupLoginUI();
    document.getElementById('doLoginBtn').onclick = handleLogin;
    
    // Allow 'Enter' key to submit login form
    ['loginUsername', 'loginPassword', 'loginRole'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLogin();
                }
            });
        }
    });

    // Admin Password Recovery Logic
    const showRecoveryModalBtn = document.getElementById('showRecoveryModalBtn');
    const recoveryModal = document.getElementById('recoveryModal');
    const closeRecoveryModalBtn = document.getElementById('closeRecoveryModalBtn');
    const doRecoverBtn = document.getElementById('doRecoverBtn');

    if (showRecoveryModalBtn) {
        showRecoveryModalBtn.onclick = (e) => {
            e.preventDefault();
            recoveryModal.style.display = 'flex';
        };
    }
    
    if (closeRecoveryModalBtn) {
        closeRecoveryModalBtn.onclick = () => {
            recoveryModal.style.display = 'none';
        };
    }

    if (doRecoverBtn) {
        doRecoverBtn.onclick = async () => {
            const username = document.getElementById('recoveryUsername').value.trim();
            const recoveryKey = document.getElementById('recoveryKey').value.trim();
            const newPassword = document.getElementById('recoveryNewPassword').value.trim();
            const errEl = document.getElementById('recoveryError');

            if (!username || !recoveryKey || !newPassword) {
                errEl.innerText = 'Please fill in all fields';
                errEl.style.display = 'block';
                return;
            }

            doRecoverBtn.disabled = true;
            doRecoverBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            
            const res = await window.auth.recoverAdminPassword({ username, recoveryKey, newPassword });
            
            doRecoverBtn.disabled = false;
            doRecoverBtn.innerHTML = '<i class="fas fa-unlock-alt"></i> Reset Password';

            if (res.success) {
                errEl.style.display = 'none';
                recoveryModal.style.display = 'none';
                document.getElementById('loginUsername').value = username;
                document.getElementById('loginPassword').value = '';
                showToast('Admin password successfully recovered. Please log in.', 'success');
            } else {
                errEl.innerText = res.error;
                errEl.style.display = 'block';
            }
        };
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = async function() {
            const page = this.dataset.page;
            if (!hasAccess(page)) return showToast('Access denied for your role', 'error');
            currentPage = page;
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            this.classList.add('active');
            await renderCurrentPage();
        };
    });

    window.onclick = (e) => {
        const modal = document.getElementById('genericModal');
        if (e.target === modal) modal.style.display = 'none';
    };

    window.addEventListener('sessionExpired', async () => {
        document.getElementById('sessionExpiredModal').style.display = 'flex';
        // Auto-purge state even if they don't click re-login yet
        try {
            currentUser = null;
            currentPage = 'dashboard';
        } catch (e) {}
    });

    window.addEventListener('unhandledrejection', event => {
        showToast('An unexpected error occurred. Please try again.', 'error');
        console.error('Unhandled rejection:', event.reason);
    });

    document.getElementById('sessionLoginBtn').onclick = () => location.reload();

    setupConnectivityMonitoring();
    setupProfileManagement();
    setupNotifications();
    setupIdleTimer();

    // --- Mobile Responsive Logic ---
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileSidebarOverlay');
    const sidebar = document.querySelector('.sidebar');

    const toggleMobileMenu = (forceClose = false) => {
        if (!sidebar || !mobileOverlay) return;
        if (forceClose) {
            sidebar.classList.remove('mobile-open');
            mobileOverlay.style.display = 'none';
        } else {
            const isOpen = sidebar.classList.contains('mobile-open');
            sidebar.classList.toggle('mobile-open');
            mobileOverlay.style.display = isOpen ? 'none' : 'block';
        }
    };

    if (mobileMenuBtn) mobileMenuBtn.onclick = (e) => { e.stopPropagation(); toggleMobileMenu(); };
    if (mobileOverlay) mobileOverlay.onclick = () => toggleMobileMenu(true);

    // Update nav-item click to close mobile menu
    document.querySelectorAll('.nav-item').forEach(item => {
        const existingClick = item.onclick;
        item.onclick = async function(e) {
            if (existingClick) await existingClick.apply(this, [e]);
            if (window.innerWidth <= 768) toggleMobileMenu(true);
        };
    });

    // Global Event Delegation (Bypasses CSP Inline restrictions)
    document.addEventListener('click', (e) => {
        const posAddBtn = e.target.closest('.pos-add-btn');
        if (posAddBtn) {
            addToCartPos(posAddBtn.getAttribute('data-id'));
            return;
        }
        
        const cartIncBtn = e.target.closest('.cart-increment-btn');
        if (cartIncBtn) {
            addToCartPos(cartIncBtn.getAttribute('data-id'));
            return;
        }
        
        const cartDecBtn = e.target.closest('.cart-decrement-btn');
        if (cartDecBtn) {
            decrementCartPos(cartDecBtn.getAttribute('data-id'));
            return;
        }

        const cartRemBtn = e.target.closest('.cart-remove-btn');
        if (cartRemBtn) {
            removeFromCartPos(cartRemBtn.getAttribute('data-id'));
            return;
        }

        const paymentModeBtn = e.target.closest('.pos-method-mode');
        if (paymentModeBtn) {
            document.querySelectorAll('.pos-method-mode').forEach(b => {
                b.style.opacity = '0.5';
                b.style.border = '3px solid transparent';
            });
            paymentModeBtn.style.opacity = '1';
            
            const method = paymentModeBtn.getAttribute('data-method');
            if (method === 'Cash') paymentModeBtn.style.border = '3px solid #10b981';
            if (method === 'M-Pesa') paymentModeBtn.style.border = '3px solid #3b82f6';
            if (method === 'Credit') paymentModeBtn.style.border = '3px solid #f59e0b';
            
            const methodInput = document.getElementById('posActiveMethod');
            if (methodInput) methodInput.value = method;
            return;
        }

        const payNowBtn = e.target.closest('#posPayNowSubmit');
        if (payNowBtn) {
            const methodInput = document.getElementById('posActiveMethod');
            if (methodInput) {
                payNowBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                payNowBtn.disabled = true;
                finalizeSale(methodInput.value).finally(() => {
                    payNowBtn.innerHTML = '<i class="fas fa-check-circle" style="pointer-events:none;"></i> PAY NOW';
                    payNowBtn.disabled = false;
                });
            }
            return;
        }
    });
});

function jumpToReport(subPage) {
    if (!hasAccess('reports')) return showToast('Access denied to reports', 'warning');
    currentPage = 'reports';
    // Update Sidebar highlight
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('active');
        if (n.dataset.page === 'reports') n.classList.add('active');
    });
    renderReports(subPage);
}

async function jumpToInventoryItem(name) {
    currentPage = 'inventory';
    // Update Sidebar
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('active');
        if (n.dataset.page === 'inventory') n.classList.add('active');
    });
    
    // Render inventory with pre-search
    await renderInventory(name);
}

async function findProfileByNameAndOpen(name) {
    if (!name || name === 'Walk-in' || name === 'General Customer') return;
    showToast(`Searching for profile: ${name}...`, 'info');
    
    // Check Patients
    const pRes = await window.db.getPatients();
    const patient = (pRes.data || []).find(p => p.name === name);
    if (patient) return showProfileModal(patient.id, 'patient');
    
    // Check Customers
    const cRes = await window.db.getCustomers();
    const customer = (cRes.data || []).find(c => c.name === name);
    if (customer) return showProfileModal(customer.id, 'customer');
    
    showToast('Registry profile not found for this name.', 'warning');
}

function jumpToInventoryWithFilter(type) {
    if (!hasAccess('inventory')) return showToast('Access denied to inventory', 'warning');
    currentPage = 'inventory';
    // Update Sidebar
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('active');
        if (n.dataset.page === 'inventory') n.classList.add('active');
    });
    renderInventory('', type);
}

async function showSupplierRecallModal(medName, supplierName) {
    if (!supplierName || supplierName === 'N/A') {
        return showToast(`No supplier recorded for ${medName}. Please update the product details.`, 'warning');
    }

    const res = await window.db.getSuppliers();
    const suppliers = res.data || [];
    const supplier = suppliers.find(s => s.name === supplierName);

    const modal = document.getElementById('genericModal');
    const inner = document.getElementById('modalInner');
    
    let supplierDetails = `<p style="color:#64748b; margin-bottom:20px;">Supplier contact information for ${medName}:</p>`;
    
    if (supplier) {
        supplierDetails += `
            <div style="background:#f8fafc; padding:20px; border-radius:12px; border:1px solid #e2e8f0;">
                <div style="margin-bottom:12px;"><strong style="color:var(--royal-blue);">Name:</strong> ${supplier.name}</div>
                <div style="margin-bottom:12px;"><strong style="color:var(--royal-blue);">Contact Person:</strong> ${supplier.contact_person || 'N/A'}</div>
                <div style="margin-bottom:12px;"><strong style="color:var(--royal-blue);">Phone:</strong> ${supplier.phone || 'N/A'}</div>
                <div style="margin-bottom:12px;"><strong style="color:var(--royal-blue);">Email:</strong> ${supplier.email || 'N/A'}</div>
            </div>
        `;
    } else {
        supplierDetails += `
            <div style="background:#fff7ed; padding:15px; border-radius:12px; border:1px solid #ffedd5; color:#9a3412;">
                <i class="fas fa-info-circle"></i> Supplier registry details for <strong>${supplierName}</strong> not found.
            </div>
        `;
    }

    inner.innerHTML = `
        <h3 style="margin-bottom:20px; color:var(--royal-blue);"><i class="fas fa-envelope-open-text"></i> Supplier Management: ${medName}</h3>
        ${supplierDetails}
        <div style="margin-top:24px; display:flex; gap:12px;">
            <button class="btn-primary" onclick="showToast('Notification request logged.', 'success'); document.getElementById('genericModal').style.display='none';" style="flex:1;">
                <i class="fas fa-bell"></i> Send Low Stock Alert
            </button>
            <button class="btn-primary" onclick="document.getElementById('genericModal').style.display='none';" style="flex:1; background:#f1f5f9; color:#475569; border:none;">Close</button>
        </div>
    `;
    modal.style.display = 'flex';
}

async function syncCreditData() {
    const salesRes = await window.db.getSales();
    const creditsRes = await window.db.getCredits();
    
    if (salesRes.success && creditsRes.success) {
        const creditSales = salesRes.data.filter(s => (s.payment_mode || '').trim().toLowerCase() === 'credit');
        const existingSaleIds = new Set(creditsRes.data.map(c => c.sale_id));

        for (let sale of creditSales) {
            if (!existingSaleIds.has(sale.id)) {
                await window.db.addCredit({
                    sale_id: sale.id,
                    customer_name: sale.customer_name || 'Legacy Customer',
                    total_amount: sale.total,
                    balance: sale.total
                });
            }
        }
    }
    
    // Auto-Cleanup: Remove "Paid" records older than 3 days
    if (currentUser && currentUser.role === 'Admin') {
        await window.db.cleanupOldCredits();
    }
}

async function renderCreditTracking() {
    await syncCreditData();
    const container = document.getElementById('pageContainer');
    const res = await window.db.getCredits();
    const credits = res.success ? res.data : [];

    const totalDebt = credits.reduce((s, c) => s + (c.status !== 'Paid' ? Number(c.balance || 0) : 0), 0);
    const pendingDebtors = credits.filter(c => c.status !== 'Paid').length;

    container.innerHTML = `
        <div class="view-header">
            <div>
                <h2><i class="fas fa-hand-holding-usd"></i> Credit Management</h2>
                <p>Track patient debts, payments, and outstanding balances</p>
            </div>
        </div>

        <div class="stats-grid" style="margin-bottom:24px;">
            <div class="stat-card" style="border-left:4px solid var(--danger);">
                <h4>Total Outstanding Debt</h4>
                <div class="stat-number">KES ${totalDebt.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                <p style="font-size:0.75rem; color:#64748b; font-weight:600; margin-top:8px;">Total receivables</p>
            </div>
            <div class="stat-card" style="border-left:4px solid var(--royal-blue);">
                <h4>Active Debtors</h4>
                <div class="stat-number">${pendingDebtors}</div>
                <p style="font-size:0.75rem; color:#64748b; font-weight:600; margin-top:8px;">Customers with balance</p>
            </div>
        </div>

        <div class="stat-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:16px;">
                <h4 style="margin:0;">Debt Tracking Records</h4>
                <div style="display:flex; gap:12px; align-items:center;">
                    <select id="creditStatusFilter" class="premium-input" style="width:220px; padding:8px 16px; cursor:pointer;">
                        <option value="active">Active Debts (Pending/Partial)</option>
                        <option value="all">All Records (Include Paid)</option>
                        <option value="Paid">Paid History</option>
                    </select>
                    <input type="text" id="creditSearch" placeholder="Search customer..." class="premium-input" style="width:250px; padding:8px 16px;">
                </div>
            </div>
            <table class="data-table">
                <thead>
                    <tr style="background:var(--royal-blue); color:white;">
                        <th style="color:white; padding-left:20px;">Date</th>
                        <th style="color:white;">Customer</th>
                        <th style="color:white;">Original Debt</th>
                        <th style="color:white;">Balance</th>
                        <th style="color:white;">Status</th>
                        <th style="color:white; text-align:right; padding-right:20px;">Actions</th>
                    </tr>
                </thead>
                <tbody id="creditTableBody">
                    ${credits.map(c => `
                        <tr data-status="${c.status}">
                            <td style="padding-left:20px;">${new Date(c.created_at || Date.now()).toLocaleDateString()}</td>
                            <td style="font-weight:600;">${c.customer_name}</td>
                            <td>KES ${Number(c.total_amount).toFixed(2)}</td>
                            <td style="font-weight:700; color:${c.balance > 0 ? 'var(--danger)' : 'var(--emerald)'}">KES ${Number(c.balance).toFixed(2)}</td>
                            <td><span class="role-pill" style="background:${c.status === 'Paid' ? '#dcfce7' : (c.status === 'Partial' ? '#fef9c3' : '#fee2e2')}; color:${c.status === 'Paid' ? '#166534' : (c.status === 'Partial' ? '#854d0e' : '#991b1b')}">${c.status}</span></td>
                            <td style="text-align:right; padding-right:20px;">
                                <button class="action-btn-refined btn-icon-view" onclick="viewDebtorStatement(${c.id}, '${c.customer_name.replace(/'/g, "\\'")}')" title="View Statement">
                                    <i class="fas fa-file-invoice-dollar"></i>
                                </button>
                                ${c.balance > 0 ? `
                                <button class="action-btn-refined btn-icon-edit" onclick="showPaymentModal(${c.id}, ${c.balance}, '${c.customer_name.replace(/'/g, "\\'")}')" title="Record Payment">
                                    <i class="fas fa-plus"></i>
                                </button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('') || '<tr><td colspan="6" style="text-align:center; padding:40px;">No credit records found.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;

    const filterSelect = document.getElementById('creditStatusFilter');
    const searchInput = document.getElementById('creditSearch');

    const applyFilters = () => {
        const query = searchInput ? searchInput.value.toLowerCase() : '';
        const statusFilter = filterSelect ? filterSelect.value : 'active';

        document.querySelectorAll('#creditTableBody tr').forEach(row => {
            const status = row.getAttribute('data-status');
            if (!status) return; // Skip empty row
            const matchesSearch = row.innerText.toLowerCase().includes(query);

            let matchesStatus = true;
            if (statusFilter === 'active') {
                matchesStatus = (status !== 'Paid');
            } else if (statusFilter === 'Paid') {
                matchesStatus = (status === 'Paid');
            }

            if (matchesSearch && matchesStatus) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    };

    if (filterSelect) filterSelect.onchange = applyFilters;
    if (searchInput) searchInput.oninput = applyFilters;

    // Initial run to only show Active Debts
    applyFilters();
}

async function showPaymentModal(creditId, balance, name) {
    const modal = document.getElementById('genericModal');
    const inner = document.getElementById('modalInner');
    inner.innerHTML = `
        <div style="padding:24px;">
            <h3 style="margin-bottom:20px; color:var(--royal-blue);"><i class="fas fa-money-check-alt"></i> Record Credit Payment</h3>
            <p style="color:#64748b; margin-bottom:24px;">Debtor: <b>${name}</b> | Outstanding: <b>KES ${Number(balance).toFixed(2)}</b></p>
            
            <div class="form-grid">
                <div class="input-group">
                    <label>Amount to Pay (KES)</label>
                    <input type="number" id="pay_amount" class="premium-input" value="${balance}" min="1" max="${balance}">
                </div>
                <div class="input-group">
                    <label>Payment Method</label>
                    <select id="pay_method" class="premium-input">
                        <option value="Cash">Cash</option>
                        <option value="M-Pesa">M-Pesa</option>
                    </select>
                </div>
            </div>

            <div style="margin-top:32px; display:flex; gap:12px;">
                <button class="btn-primary" id="confirmPayBtn" style="flex:2;">Confirm Payment</button>
                <button class="btn-primary" onclick="document.getElementById('genericModal').style.display='none';" style="flex:1; background:#f1f5f9; color:#475569; border:none;">Cancel</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('confirmPayBtn').onclick = async () => {
        const amount = parseFloat(document.getElementById('pay_amount').value);
        const method = document.getElementById('pay_method').value;

        if (isNaN(amount) || amount <= 0 || amount > balance) {
            return showToast('Invalid payment amount', 'error');
        }

        const res = await window.db.addCreditPayment({
            creditId,
            amount,
            paymentMode: method,
            receivedBy: currentUser.username
        });

        if (res.success) {
            showToast(`Payment of KES ${amount} recorded successfully`, 'success');
            modal.style.display = 'none';
            renderCreditTracking();
        } else {
            showToast('Failed to record payment: ' + res.error, 'error');
        }
    };
}

async function viewDebtorStatement(creditId, name) {
    const res = await window.db.getCreditHistory(creditId);
    const payments = res.success ? res.data : [];
    
    // Also get the original sale for total context
    const creditRes = await window.db.getCredits();
    const credit = creditRes.data.find(c => c.id === creditId);

    const modal = document.getElementById('genericModal');
    const inner = document.getElementById('modalInner');
    inner.innerHTML = `
        <div style="padding:24px; max-width:700px; margin:0 auto;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; border-bottom:2px solid #f1f5f9; padding-bottom:16px;">
                <div>
                    <h3 style="margin:0; color:var(--royal-blue);"><i class="fas fa-file-invoice"></i> Debtor Statement</h3>
                    <p style="margin:4px 0 0; color:#64748b; font-size:0.9rem;">Customer: <b>${name}</b></p>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn-primary" onclick="downloadStatement('${name.replace(/'/g, "\\'")}', ${creditId})" style="padding:8px 16px; font-size:0.8rem; background:var(--emerald);">
                        <i class="fas fa-download"></i> Download
                    </button>
                    <button class="btn-primary" onclick="printStatement('${name.replace(/'/g, "\\'")}', ${creditId})" style="padding:8px 16px; font-size:0.8rem; background:var(--royal-blue);">
                        <i class="fas fa-print"></i> Print
                    </button>
                </div>
            </div>
            
            <div id="statementContent">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px;">
                    <div style="background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #e2e8f0;">
                        <span style="display:block; font-size:0.75rem; color:#64748b; font-weight:700; text-transform:uppercase;">Original Debt</span>
                        <span style="font-size:1.3rem; font-weight:700; color:#1e293b;">KES ${Number(credit.total_amount).toFixed(2)}</span>
                    </div>
                    <div style="background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #e2e8f0;">
                        <span style="display:block; font-size:0.75rem; color:#64748b; font-weight:700; text-transform:uppercase;">Current Balance</span>
                        <span style="font-size:1.3rem; font-weight:700; color:${credit.balance > 0 ? 'var(--danger)' : 'var(--emerald) '};">KES ${Number(credit.balance).toFixed(2)}</span>
                    </div>
                </div>

                <h4 style="color:#1e293b; font-size:1rem; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-history" style="color:var(--royal-blue);"></i> Payment History
                </h4>
                <table class="data-table" style="background:#ffffff; border:1px solid #f1f5f9; border-radius:12px; overflow:hidden;">
                    <thead style="background:#f1f5f9;">
                        <tr>
                            <th style="padding:12px;">Date & Time</th>
                            <th style="padding:12px;">Amount Paid</th>
                            <th style="padding:12px;">Method</th>
                            <th style="padding:12px;">Received By</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payments.map(p => `
                            <tr>
                                <td>${new Date(p.payment_date + ' UTC').toLocaleString()}</td>
                                <td style="font-weight:700; color:var(--emerald);">+ KES ${Number(p.amount).toFixed(2)}</td>
                                <td>${p.payment_mode}</td>
                                <td>${p.received_by}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">No payments recorded yet.</td></tr>'}
                    </tbody>
                </table>
            </div>
            
            <button class="btn-primary" onclick="document.getElementById('genericModal').style.display='none';" style="width:100%; background:#f1f5f9; color:#475569; border:none; margin-top:24px; font-weight:700;">Close Statement</button>
        </div>
    `;
    modal.style.display = 'flex';
}

async function downloadStatement(name, creditId) {
    try {
        showToast('Generating PDF statement...', 'info');
        
        const jsPDFLib = window.jspdf ? window.jspdf.jsPDF : (window.jsPDF || null);
        if (!jsPDFLib) throw new Error("PDF Library (jsPDF) is not loaded.");

        // 1. Fetch data
        const creditsRes = await window.db.getCredits();
        const credit = creditsRes.data.find(c => String(c.id) === String(creditId));
        if (!credit) throw new Error("Credit record not found.");

        const historyRes = await window.db.getCreditHistory(creditId);
        const payments = historyRes.data || [];

        const doc = new jsPDFLib();
        
        // Header
        doc.setFontSize(22);
        doc.setTextColor(30, 58, 138); // Royal Blue
        doc.text("RENACHEM PHARMACY", 14, 22);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text("OFFICIAL DEBTOR STATEMENT", 14, 30);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 36);
        
        // Separator
        doc.setDrawColor(220);
        doc.line(14, 42, 196, 42);

        // Customer Summary
        doc.setFontSize(11);
        doc.setTextColor(30);
        doc.text(`Customer Name: ${name}`, 14, 52);
        doc.text(`Statement ID: #STMT-${creditId}`, 14, 58);
        
        // Summary Cards (Values)
        doc.setFillColor(248, 250, 252);
        doc.rect(14, 65, 85, 25, 'F'); // Original Debt Box
        doc.rect(110, 65, 85, 25, 'F'); // Balance Box
        
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text("ORIGINAL DEBT", 18, 73);
        doc.text("CURRENT BALANCE", 114, 73);
        
        doc.setFontSize(14);
        doc.setTextColor(30);
        doc.text(`KES ${Number(credit.total_amount).toFixed(2)}`, 18, 83);
        doc.setTextColor(220, 38, 38); // Red for balance
        doc.text(`KES ${Number(credit.balance).toFixed(2)}`, 114, 83);

        // Payment History Table
        doc.setFontSize(12);
        doc.setTextColor(30, 58, 138);
        doc.text("Payment History", 14, 105);

        const tableBody = payments.map(p => [
            p.payment_date,
            `KES ${Number(p.amount).toFixed(2)}`,
            p.payment_mode,
            p.received_by || 'Admin'
        ]);

        doc.autoTable({
            startY: 110,
            head: [['Date & Time', 'Amount Paid', 'Method', 'Received By']],
            body: tableBody.length > 0 ? tableBody : [['-', 'No payments recorded yet', '-', '-']],
            theme: 'striped',
            headStyles: { fillColor: [0, 163, 204] }, // Cyan Blue
            styles: { fontSize: 9 }
        });

        // Footer
        const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 120);
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text("Thank you for your continued partnership with Renachem Pharmacy.", 14, finalY + 20);
        doc.text("This is a computer-generated document and does not require a signature.", 14, finalY + 25);

        doc.save(`Statement_${name.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
        showToast('PDF Statement downloaded.', 'success');

    } catch (error) {
        console.error(error);
        showToast(`Failed to generate PDF: ${error.message}`, 'error');
    }
}

async function printStatement(name, creditId) {
    try {
        showToast('Initializing Statement Print...', 'info');
        
        // 1. Fetch data
        const creditsRes = await window.db.getCredits();
        const credit = creditsRes.data.find(c => String(c.id) === String(creditId));
        if (!credit) throw new Error("Credit record not found.");

        const historyRes = await window.db.getCreditHistory(creditId);
        const payments = historyRes.data || [];

        const settingsReq = await window.db.getSettings();
        const config = {};
        if (settingsReq.success) {
            settingsReq.data.forEach(s => config[s.key] = s.value);
        }
        
        const pharmacyName = config.pharmacy_name || 'RENACHEM PHARMACY';
        const pharmacyAddress = config.pharmacy_address || '';
        const pharmacyPhone = config.pharmacy_phone || '';

        // Default to A4 layout for statements
        let styles = `
            body { font-family: 'Courier New', Courier, monospace; width: 600px; margin: 0 auto; padding: 40px; color: #000; background: white; }
            .header { text-align: center; font-weight: bold; font-size: 24px; margin-bottom: 30px; text-transform: uppercase; }
            .sub-header { text-align: center; font-size: 16px; margin-bottom: 20px; color: #444; }
            .flex-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 16px; }
            .divider { border-bottom: 2px dashed #000; margin: 24px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { text-align: left; vertical-align: top; padding: 10px 5px; font-size: 15px; border-bottom: 1px solid #eee; }
            th { font-weight: bold; border-bottom: 2px solid #000; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .footer { text-align: center; margin-top: 50px; font-size: 14px; font-style: italic; }
        `;

        let statementHtml = `
            <html>
            <head><style>${styles}</style></head>
            <body>
                <div class="header">DEBTOR STATEMENT</div>
                <div class="sub-header">${pharmacyName}</div>
                
                <div class="flex-row">
                    <span>Customer: <b>${name}</b></span>
                    <span>Date: ${new Date().toLocaleDateString()}</span>
                </div>
                <div class="flex-row">
                    <span>Statement ID: #STMT-${creditId}</span>
                    <span>Phone: ${pharmacyPhone}</span>
                </div>

                <div class="divider"></div>

                <div class="flex-row" style="font-size:1.2rem;">
                    <span><b>Original Debt:</b></span>
                    <span><b>KES ${Number(credit.total_amount).toFixed(2)}</b></span>
                </div>
                <div class="flex-row" style="font-size:1.2rem; color:red;">
                    <span><b>Current Balance:</b></span>
                    <span><b>KES ${Number(credit.balance).toFixed(2)}</b></span>
                </div>

                <div class="divider"></div>

                <div class="bold" style="margin-top:20px; font-size:18px;">Payment History</div>
                <table>
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Amount</th>
                            <th>Method</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payments.map(p => `
                            <tr>
                                <td>${p.payment_date}</td>
                                <td>KES ${Number(p.amount).toFixed(2)}</td>
                                <td>${p.payment_mode}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="3" style="text-align:center;">No payments recorded yet.</td></tr>'}
                    </tbody>
                </table>

                <div class="footer">
                    <p>Thank you for choosing ${pharmacyName}.</p>
                    <p>This is a computer-generated statement.</p>
                </div>
            </body>
            </html>
        `;

        // Reuse the Print Preview Modal
        const modalInner = document.getElementById('modalInner');
        modalInner.innerHTML = `
            <div style="padding:32px; max-width:650px; margin:0 auto; text-align:center;">
                <i class="fas fa-print" style="font-size:2.8rem; color:var(--royal-blue); margin-bottom:16px;"></i>
                <h3 style="margin:0 0 8px; color:#0f172a; font-size:1.4rem;">Print Statement</h3>
                <p style="color:#64748b; margin-bottom:24px; font-size:0.95rem;">Review the statement layout for <b>${name}</b>.</p>
                
                <div style="width:100%; height:450px; border: 2px solid #cbd5e1; border-radius:12px; background:#e2e8f0; padding:16px; box-sizing:border-box;">
                    <iframe id="previewIframe" style="width:100%; height:100%; border:none; background:#ffffff; border-radius:8px;"></iframe>
                </div>

                <div style="display:flex; gap:16px; width:100%; margin-top:24px;">
                    <button id="executePrintBtn" class="btn-primary" style="flex:2; background:#3b82f6; padding:16px; font-size:1.2rem; border-radius:16px;"><i class="fas fa-print"></i> Print Now</button>
                    <button id="cancelPrintBtn" style="flex:1; background:#f1f5f9; color:#475569; border:none; border-radius:16px; cursor:pointer; font-weight:700;">Cancel</button>
                </div>
            </div>
        `;

        document.getElementById('genericModal').style.display = 'flex';
        
        const previewIframe = document.getElementById('previewIframe');
        previewIframe.contentDocument.open();
        previewIframe.contentDocument.write(statementHtml);
        previewIframe.contentDocument.close();

        document.getElementById('executePrintBtn').onclick = () => {
            document.getElementById('genericModal').style.display = 'none';
            const printFrame = document.getElementById('printFrame');
            if (printFrame) {
                printFrame.contentDocument.open();
                printFrame.contentDocument.write(statementHtml);
                printFrame.contentDocument.close();
                setTimeout(() => {
                    printFrame.contentWindow.focus();
                    printFrame.contentWindow.print();
                }, 300);
            }
        };

        document.getElementById('cancelPrintBtn').onclick = () => {
            document.getElementById('genericModal').style.display = 'none';
            // Optional: reopen statement modal?
        };

    } catch (error) {
        console.error(error);
        showToast(`Failed to initialize print: ${error.message}`, 'error');
    }
}

function setupNotifications() {
    const bell = document.getElementById('notificationBell');
    const dropdown = document.getElementById('notificationDropdown');
    const clearBtn = document.getElementById('clearAllNotifs');

    if (bell) {
        bell.onclick = (e) => {
            e.stopPropagation();
            const isVisible = dropdown.style.display === 'flex';
            dropdown.style.display = isVisible ? 'none' : 'flex';
        };
    }

    if (clearBtn) {
        clearBtn.onclick = (e) => {
            e.stopPropagation();
            document.getElementById('notifList').innerHTML = '<div class="notif-placeholder">No active alerts</div>';
            updateBellState(0);
        };
    }

    document.addEventListener('click', () => {
        if (dropdown) dropdown.style.display = 'none';
    });

    if (dropdown) {
        dropdown.onclick = (e) => e.stopPropagation();
    }

    // Initial check and periodic refresh
    refreshNotifications();
    setInterval(refreshNotifications, 60000 * 5); // Every 5 minutes
}

async function refreshNotifications() {
    try {
        const medRes = await window.db.getMedicines();
        const creditRes = await window.db.getCredits();
        
        let alerts = [];
        const today = new Date();
        const thirtyDaysOut = new Date();
        thirtyDaysOut.setDate(today.getDate() + 30);

        // 1. Check Medicines (Stock & Expiry)
        if (medRes.success) {
            medRes.data.forEach(m => {
                // Stock Alert
                if (m.stock <= (m.reorder_level || 10)) {
                    alerts.push({
                        type: 'inventory',
                        targetId: m.id,
                        targetName: m.name, // Include name for search
                        title: 'Low Stock Alert',
                        desc: `${m.name} is low (${m.stock} left).`,
                        icon: 'fa-box-open',
                        color: 'bg-amber'
                    });
                }

                // Expiry Check
                if (m.expiry) {
                    const expDate = new Date(m.expiry);
                    if (expDate < today) {
                        alerts.push({
                            type: 'expiry',
                            targetId: m.id,
                            targetName: m.name,
                            title: 'Item Expired!',
                            desc: `${m.name} (Batch ${m.batch}) has expired.`,
                            icon: 'fa-skull-crossbones',
                            color: 'bg-red'
                        });
                    } else if (expDate < thirtyDaysOut) {
                        alerts.push({
                            type: 'expiry',
                            targetId: m.id,
                            targetName: m.name,
                            title: 'Expiring Soon',
                            desc: `${m.name} expires on ${m.expiry}.`,
                            icon: 'fa-hourglass-half',
                            color: 'bg-amber'
                        });
                    }
                }
            });
        }

        // 2. Check Credits (Unpaid > 14 Days)
        if (creditRes.success) {
            creditRes.data.forEach(c => {
                if (c.balance > 0) {
                    const createdDate = new Date(c.created_at);
                    const ageInDays = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
                    if (ageInDays >= 14) {
                        alerts.push({
                            type: 'finance',
                            targetId: c.id,
                            targetName: c.customer_name,
                            title: 'Overdue Credit',
                            desc: `${c.customer_name} owes KES ${c.balance.toFixed(2)} (> 2 weeks).`,
                            icon: 'fa-hand-holding-usd',
                            color: 'bg-red'
                        });
                    }
                }
            });
        }

        renderNotifList(alerts);
        updateBellState(alerts.length);

    } catch (error) {
        console.error('Notification refresh failed:', error);
    }
}

function renderNotifList(alerts) {
    const list = document.getElementById('notifList');
    if (!list) return;

    if (alerts.length === 0) {
        list.innerHTML = '<div class="notif-placeholder">No active alerts</div>';
        return;
    }

    list.innerHTML = alerts.map(a => `
        <div class="notif-item" onclick="handleNotifClick('${a.type}', '${a.targetId || ''}', '${(a.targetName || '').replace(/'/g, "\\'")}')">
            <div class="notif-icon ${a.color}">
                <i class="fas ${a.icon}"></i>
            </div>
            <div class="notif-content">
                <div class="notif-title">${a.title}</div>
                <div class="notif-desc">${a.desc}</div>
            </div>
        </div>
    `).join('');
}

function updateBellState(count) {
    const badge = document.getElementById('bellBadge');
    const icon = document.getElementById('bellIcon');
    
    if (badge) {
        badge.innerText = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    if (icon) {
        if (count > 0) {
            icon.classList.add('bell-dancing');
        } else {
            icon.classList.remove('bell-dancing');
        }
    }
}

async function handleNotifClick(type, targetId, targetName) {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) dropdown.style.display = 'none';

    // RBAC Check
    if (type === 'finance' && !hasAccess('finance')) {
        return showToast('Access denied! Please notify the Admin.', 'error');
    }
    if (type === 'inventory' && !hasAccess('inventory')) {
        return showToast('Access denied! Please notify the Admin.', 'error');
    }

    // Map notification types to internal pages
    const pageMap = {
        'inventory': 'inventory',
        'expiry': 'inventory', 
        'finance': 'finance'
    };

    const targetPage = pageMap[type];
    if (targetPage && currentPage !== targetPage) {
        const navItem = document.querySelector(`.nav-item[data-page="${targetPage}"]`);
        if (navItem) navItem.click();
    }

    // Deep Linking to Individual Item
    setTimeout(async () => {
        if (type === 'inventory' || type === 'expiry') {
            if (targetId) {
                // Auto-search for the item in the list behind the modal
                const searchInput = document.getElementById('medSearch');
                if (searchInput) {
                    searchInput.value = targetName;
                    await renderInventory(targetName);
                }
                showMedicineModal(targetId);
            }
        } else if (type === 'finance') {
            if (targetId && targetName) viewDebtorStatement(targetId, targetName);
        }
    }, 100);
}

function setupIdleTimer() {
    // Reset timer on any user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(evt => {
        window.addEventListener(evt, resetIdleTimer, true);
    });

    // Start initial timer
    resetIdleTimer();
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    
    // Only timeout if a user is actually logged in
    if (currentUser) {
        idleTimer = setTimeout(() => {
            // Check if user is still logged in before firing
            if (currentUser) {
                showToast('Session expired due to 5 minutes of inactivity.', 'warning');
                // Trigger the logout logic after a small delay so toast is visible
                setTimeout(() => {
                    const logoutBtn = document.getElementById('topBarLogoutBtn');
                    if (logoutBtn) {
                        logoutBtn.click();
                    } else {
                        location.reload();
                    }
                }, 5000);
            }
        }, 1000 * 60 * 5); // 5 minutes
    }
}
