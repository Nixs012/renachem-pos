function generateReceiptHTML(saleData) {
  let itemsHTML = '';
  if (saleData.items && saleData.items.length > 0) {
    saleData.items.forEach(item => {
      itemsHTML += `
    <div style="display:flex;margin-top:4px;">
      <span style="flex:3;">${item.name}</span>
      <span style="flex:1;text-align:center;">${item.qty}</span>
      <span style="flex:1;text-align:right;">${item.price}</span>
      <span style="flex:1;text-align:right;">${item.subtotal || (item.price * item.qty)}</span>
    </div>`;
    });
  }

  let paymentHTML = '';
  if (saleData.paymentMode === 'Cash') {
    paymentHTML = `
  <div style="border-top:1px dashed #000;padding-top:8px;margin-bottom:8px;">
    <div style="font-weight:bold;">PAYMENT: Cash</div>
    <div style="display:flex;justify-content:space-between;">
      <span>TOTAL PAID:</span><span>KES ${saleData.total}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span>BALANCE:</span><span>KES 0.00</span>
    </div>
  </div>`;
  } else if (saleData.paymentMode === 'M-Pesa') {
    paymentHTML = `
  <div style="border-top:1px dashed #000;padding-top:8px;margin-bottom:8px;">
    <div style="font-weight:bold;">PAYMENT: M-Pesa</div>
    <div style="display:flex;justify-content:space-between;">
      <span>TOTAL PAID:</span><span>KES ${saleData.total}</span>
    </div>
    ${saleData.mpesaCode ? `<div>M-Pesa Code: ${saleData.mpesaCode}</div>` : ''}
    <div style="display:flex;justify-content:space-between;">
      <span>BALANCE:</span><span>KES 0.00</span>
    </div>
  </div>`;
  } else if (saleData.paymentMode === 'Split') {
    paymentHTML = `
  <div style="border-top:1px dashed #000;padding-top:8px;margin-bottom:8px;">
    <div style="font-weight:bold;">PAYMENT: Split (Cash + M-Pesa)</div>
    <div style="display:flex;justify-content:space-between;">
      <span>Cash Paid:</span><span>KES ${saleData.cashAmount}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span>M-Pesa Paid:</span><span>KES ${saleData.mpesaAmount}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-weight:bold;border-top:1px dashed #000;margin-top:4px;padding-top:4px;">
      <span>TOTAL PAID:</span><span>KES ${saleData.total}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span>BALANCE:</span><span>KES 0.00</span>
    </div>
  </div>`;
  }

  return `
<div id="receiptContent" style="font-family:monospace;max-width:300px;margin:0 auto;padding:16px;font-size:13px;">
  
  <!-- Header -->
  <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px;">
    <div style="font-size:18px;font-weight:bold;">RENACHEM PHARMACY</div>
    <div style="font-size:11px;color:#555;">Your Health, Our Priority</div>
    <div style="font-size:11px;">Tel: [pharmacy phone]</div>
  </div>

  <!-- Invoice details -->
  <div style="margin-bottom:8px;">
    <div>Invoice No: ${saleData.invoiceNumber}</div>
    <div>Date: ${saleData.date}  Time: ${saleData.time}</div>
    <div>Cashier: ${saleData.cashierName}</div>
    <div>Customer: ${saleData.customerName}</div>
  </div>

  <!-- Items table -->
  <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:6px 0;margin-bottom:8px;">
    <div style="display:flex;font-weight:bold;">
      <span style="flex:3;">Item</span>
      <span style="flex:1;text-align:center;">Qty</span>
      <span style="flex:1;text-align:right;">Price</span>
      <span style="flex:1;text-align:right;">Total</span>
    </div>
    ${itemsHTML}
  </div>

  <!-- Totals -->
  <div style="margin-bottom:8px;">
    <div style="display:flex;justify-content:space-between;">
      <span>SUBTOTAL:</span><span>KES ${saleData.subtotal}</span>
    </div>
  </div>

  <!-- Payment breakdown — show based on paymentMode -->
  ${paymentHTML}

  <!-- Footer -->
  <div style="text-align:center;border-top:1px dashed #000;padding-top:8px;font-size:11px;">
    <div>Thank you for choosing Renachem Pharmacy</div>
    <div>Get well soon!</div>
    <div style="margin-top:4px;color:#888;">Powered by Renachem POS</div>
  </div>

</div>`;
}

function showReceiptModal(saleData) {
  const receiptHTML = generateReceiptHTML(saleData);
  
  const modalInner = document.getElementById('modalInner');
  if (modalInner) {
    modalInner.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; padding:10px;">
        <div style="border:1px solid #ccc; background:#fff; padding:10px; margin-bottom:20px; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
          ${receiptHTML}
        </div>
        <div style="display:flex; gap:16px; width:100%; max-width:300px;">
          <button id="printReceiptBtn" class="btn-primary" style="flex:1; background:#3b82f6; padding:12px; font-weight:bold; border-radius:8px;">Print Receipt</button>
          <button id="closeReceiptBtn" style="flex:1; background:#94a3b8; color:#fff; border:none; padding:12px; font-weight:bold; border-radius:8px; cursor:pointer;">Close</button>
        </div>
      </div>
    `;
    
    document.getElementById('genericModal').style.display = 'flex';
    
    document.getElementById('printReceiptBtn').onclick = () => {
      const printWindow = window.open('', '_blank');
      printWindow.document.write('<html><body>' + receiptHTML + '</body></html>');
      printWindow.document.close();
      printWindow.print();
      printWindow.close();
    };
    
    document.getElementById('closeReceiptBtn').onclick = () => {
      document.getElementById('genericModal').style.display = 'none';
      if (typeof window.cart !== 'undefined') {
        window.cart = [];
      } else if (typeof cart !== 'undefined') {
        cart = [];
      }
      
      if (typeof window.renderPOS === 'function') {
        window.renderPOS();
      } else if (typeof renderPOS === 'function') {
        renderPOS();
      }
    };
  }
}

// Make functions globally available
window.generateReceiptHTML = generateReceiptHTML;
window.showReceiptModal = showReceiptModal;
