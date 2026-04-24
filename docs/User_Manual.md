# Renachem Pharmacy POS - Comprehensive User Manual

## 1. System Overview
Renachem Pharmacy POS is a professional, high-security management system designed to streamline pharmaceutical operations, inventory tracking, and financial reporting.

---

## 2. User Roles & Accessibility
The system uses a strict **Role-Based Access Control (RBAC)** model to ensure data security and operational integrity.

### **A. Admin (Super User)**
*   **Permissions**: Full system access.
*   **Exclusive Features**:
    *   **Staff Management**: Create, deactivate, and reset passwords for all users.
    *   **System Maintenance**: Perform modular data resets (Wiping history for handover).
    *   **Full Analytics**: Access to detailed Profit/Loss margins and cost-price data.
    *   **System Settings**: Configure pharmacy name, address, and M-Pesa details.

### **B. Pharmacist**
*   **Permissions**: Core clinical and inventory operations.
*   **Key Features**:
    *   **Inventory Mgmt**: Add/Edit medicines and manage stock levels.
    *   **Stock Intake**: Record new deliveries from suppliers.
    *   **Clinical Records**: View and update patient/customer medical history.
    *   **POS Billing**: Full access to sell and manage credits.

### **C. Cashier**
*   **Permissions**: Basic sales and customer interactions.
*   **Key Features**:
    *   **POS Billing**: Search medicines and process sales.
    *   **Payment Processing**: Handle Cash, M-Pesa, and Credit transactions.
    *   **Restricted**: Cannot edit medicine details, cannot see profit reports, and cannot access system settings.

---

## 3. Module Guide (Tabs)

### **Dashboard**
*   **Real-time Metrics**: View Daily Revenue, Transaction counts, and Net Profit.
*   **Intelligent Alerts**: Automated notifications for "Low Stock" and "Expiring Soon" items.
*   **Quick Links**: Direct navigation from alerts to specific inventory items.

### **POS Billing**
*   **Checkout Engine**: Search by name or barcode.
*   **Multi-mode Payment**: Supports Cash, M-Pesa (with code tracking), and Credit.
*   **Receipt Printing**: Supports both Thermal (80mm) and Standard A4 formats.
*   **Profile Linkage**: Automatically updates Patient/Customer clinical history upon sale.

### **Inventory**
*   **Medicine Catalog**: Comprehensive list of all drugs, batches, and expiries.
*   **Smart Filtering**: Filter by "Expired," "Low Stock," or "Expiring in 90 Days."
*   **Search**: Instant lookup by name or barcode.

### **Patient & Customer Mgmt**
*   **Clinical Tracking**: View every prescription and purchase made by a specific person.
*   **Reprint Engine**: Directly reprint historical receipts from within a user's profile.

### **Suppliers**
*   **Wholesale CRM**: Manage contact details and product links for all wholesalers/distributors.

### **Purchase & Stock**
*   **Delivery Records**: Log new stock receipts with Buying Price (Cost) and Selling Price.
*   **Historical Log**: Track the history of all intakes to identify supply trends.

### **Reports (Business Intelligence)**
*   **Detailed Sales Log**: Paginated history of every transaction.
*   **Profit/Loss**: Advanced analytics using real cost-price data to calculate exact margins.
*   **Credit Tracking**: Manage outstanding balances, record partial payments, and view debtor statements.
*   **Expiry Report**: Predictive list of medicines nearing their end-of-life.

### **Settings**
*   **Pharmacy Profile**: Customize the information that appears on your receipts.
*   **Staff Directory**: Centralized management for all authorized users.
*   **Modular Reset**: Specialized "Danger Zone" buttons to clear operational logs before system delivery.

---

## 4. Security & Automation
*   **Idle Timeout**: The system automatically logs users out after 5 minutes of inactivity for security.
*   **Auto-Backup**: The database performs a secure daily backup to the local system.
*   **Audit Logging**: Every sensitive action (Login, Sale, Reset) is recorded in a tamper-proof audit trail.
