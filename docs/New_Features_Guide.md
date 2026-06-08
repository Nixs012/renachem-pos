# Renachem POS — New Features Step-by-Step Guide

This document provides a step-by-step guide on how to use the latest features added to the Renachem POS system: the Invoice System, Split Payment, Medicine Sales Graph, Invoices Page, and System Update Checker.

---

## 1. Invoice System
**What it does:** Automatically generates unique, sequential invoice numbers (e.g., `INV-YYYYMMDD-XXXX`) for every completed sale and creates printable receipts.

### How to use it:
1. **Add Items:** Go to the POS billing page and add medicines to the cart.
2. **Checkout:** Select any payment method (Cash, M-Pesa, or Split).
3. **Complete Sale:** Click "Complete Sale". The system automatically hooks into the database, decrements stock, and assigns a permanent, sequential invoice number.
4. **View Receipt:** A receipt modal will instantly pop up showing the pharmacy details, purchased items, total, and the newly generated invoice number.
5. **Print:** Click "Print Receipt" in the modal to physically print the receipt (supports standard thermal printers or A4).

---

## 2. Split Payment (Cash + M-Pesa)
**What it does:** Allows a single transaction to be split into two payment types: Cash and M-Pesa. It forces the cashier to ensure the split equals the total exact amount.

### How to use it:
1. **Select Payment Method:** In the POS screen, use the payment method dropdown and select **Split Payment (Cash + M-Pesa)**.
2. **Split Panel Appears:** A special split payment panel will slide into view showing the Total Due.
3. **Enter Cash Amount:** Type the amount the customer is paying in Cash. 
4. **Auto-Calculation:** The system will automatically calculate the remaining balance and lock it in as the required M-Pesa amount.
5. **Confirm M-Pesa:** Ensure the customer has sent the M-Pesa amount. Enter the M-Pesa code if required, and **tick the confirmation checkbox** ("I confirm customer has completed M-Pesa payment").
6. **Complete:** Click "Complete Sale". The receipt will clearly detail how much was paid in Cash and how much in M-Pesa.

---

## 3. Medicine Sales Graph
**What it does:** Provides a visual bar chart of the top 15 bestselling medicines based on your historical sales data.

### How to use it:
1. **Navigate to Reports:** Click on "Reports" in the sidebar menu.
2. **Locate the Graph:** You will see the "Medicine Sales Graph" section prominently displayed above the standard tables.
3. **Set Date Range:** Use the "Date From" and "Date To" inputs to filter the sales data.
4. **Load Graph:** Click "Load Graph". The system will aggregate the data and render a beautiful bar chart.
5. **Switch Views:** You can easily toggle the view to show either the **Quantity Sold** or the **Revenue in KES** to analyze which medicines are driving the most volume vs the most profit.

---

## 4. Invoices Page
**What it does:** A dedicated page for Admins and Pharmacists to view, search, reprint, and export historical transactions.

### How to use it:
1. **Access the Page:** Click on "Invoices" in the sidebar menu (note: this is hidden from standard Cashier roles).
2. **View Transactions:** A table will load showing all historical transactions, the cashier, the customer, the invoice number, and the payment mode.
3. **Color Badges:** Quickly identify how a sale was paid for using color-coded badges (Blue for Cash, Green for M-Pesa, Purple for Split).
4. **Search and Filter:** Use the search bar to find specific invoice numbers or customer names.
5. **Reprint Receipts:** Click the "View" button next to any transaction to pull up the receipt modal, from where you can click "Print Receipt" again.
6. **Export:** Click "Export CSV" to download the currently filtered list of invoices directly to an Excel/CSV file for accounting.

---

## 5. System Update Checker
**What it does:** Automatically notifies all logged-in staff whenever a new version of the system has been deployed, ensuring everyone is on the latest software.

### How to use it:
1. **Automatic Checking:** The system checks for updates silently when a user logs in, and every 30 minutes thereafter while the app is open.
2. **Update Banner:** If an administrator updates the `APP_VERSION` in the Vercel dashboard, a blue banner will appear at the top of the screen for all active users.
3. **Update Now:** Clicking "Update Now" will gracefully reload the application and pull the latest code.
4. **Later:** Clicking "Later" dismisses the banner until the next session.
5. **Manual Check:** Users can click their profile avatar in the sidebar and click "Check for Updates Now" under the "About & Updates" section to manually verify their version.

---

## 6. Supplier Invoice Tracking (Purchase & Stock)
**What it does:** Allows you to attach specific supplier invoice numbers (e.g., `INV-1002`) to incoming stock deliveries, so you can easily search for and verify which medicines came from which exact invoice delivery later.

### How to use it:
1. **Manual Entry:** When clicking **"Record New Stock Receipt"**, you will see a new field called **"Supplier Invoice"** next to the Supplier dropdown. Type the invoice number from the physical paper receipt (e.g., `INV-1029`).
2. **Bulk CSV Entry:** If using the **"Bulk CSV Import"**, download the latest template. You will find a new column named `Supplier Invoice`. Fill this in for the medicines arriving in that delivery.
3. **Database Engine Integration:** When the stock receipt is saved, the backend engine automatically merges the invoice number with the supplier's name (saving it as `Supplier Name (Inv: INV-1029)`). This brilliantly tracks the invoice without requiring complex database schema changes.
4. **Search and Verify:** Head to the **Purchase & Stock** page. You can now use the new search bar to type in any invoice number (e.g., `INV-1029`). The paginated table will instantly filter to show *only* the medicines that were received under that specific invoice!
