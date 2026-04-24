# Implementation Plan: Online/Offline Hybrid Sync

This document outlines the strategic roadmap for enabling remote access for the owner while maintaining high-speed offline capabilities for the pharmacy shop.

---

## 1. The Strategy: Hybrid Synchronization
To ensure the system works even during internet outages (Offline) but allows the owner to view reports from anywhere (Online), we will implement a **Local-First Sync Engine**.

### **How it works:**
1.  **Local Processing**: Sales and inventory updates happen instantly on the local SQLite database (no lag).
2.  **Background Sync**: Every 5 minutes (or when internet is detected), the system pushes new data to a cloud database (e.g., Supabase or PostgreSQL).
3.  **Owner Portal**: The owner logs into a secure web dashboard to see real-time sales and stock levels.

---

## 2. Step-by-Step Implementation Guide

### **Phase 1: Cloud Infrastructure Setup**
1.  **Database**: Provision a hosted database (Supabase is recommended for its built-in API).
2.  **Schema Mirroring**: Recreate the `sales`, `inventory`, and `credits` tables in the cloud to match the local system.
3.  **API Keys**: Generate secure API keys to allow the POS app to communicate with the cloud.

### **Phase 2: Database Hardening (Local)**
1.  **Add Sync Markers**: Add a `is_synced` (BOOLEAN) column to all major tables (`sales`, `purchases`, `credits`).
2.  **Sync Queue**: Create a logic that identifies all records where `is_synced = 0`.

### **Phase 3: The Sync Engine (Electron)**
1.  **Background Worker**: Create a background task in `main.js` that checks for an internet connection.
2.  **Push Logic**:
    *   Find all `is_synced = 0` records.
    *   Upload them to the cloud database via secure HTTPS.
    *   Upon success, update local records to `is_synced = 1`.
3.  **Conflict Resolution**: Use "Last Write Wins" logic to ensure that if stock is updated on two machines, the most recent change is kept.

### **Phase 4: Remote Owner Dashboard**
1.  **Web Application**: Build a lightweight Next.js or React dashboard.
2.  **Authentication**: Ensure only the Owner (Admin) can log in.
3.  **Real-time Reports**: Connect this dashboard directly to the Cloud Database to see sales as they happen.

---

## 3. Alternative: The "Zero-Code" Quick Fix
If you need immediate remote access without rewriting the database logic:

### **Using Tailscale or Ngrok**
1.  **Setup**: Install a tunneling service like Tailscale on the shop machine.
2.  **Port Forwarding**: Expose the POS backend port (e.g., 3001) to the owner's private network.
3.  **Access**: The owner can then open the dashboard on their phone/laptop as if they were sitting in the shop.
*   *Note: This requires the shop computer to be turned on.*

---

## 4. Cost & Infrastructure Analysis

### **A. Monthly Costs (Using Supabase)**
*   **Database (Supabase)**: **$0 / month** (Free Tier). 
    *   Supabase's free tier allows for 500MB of data. For a pharmacy, this will typically cover **1-2 years of transactions** before needing an upgrade.
    *   *Upgrade Cost*: $25/month for the Pro tier (up to 8GB of data).
*   **Hosting (Vercel/Netlify)**: **$0 / month** (Free Tier).
    *   The Owner Dashboard can be hosted for free on platforms like Vercel.
*   **Domain Name**: **Optional ($0 to $15/year)**.
    *   Free: `renachem-reports.vercel.app`
    *   Custom: `reports.renachem.com` (~$15/year).

**Total Startup Cost: $0.00**

---

## 5. M-Pesa Integration (Non-Daraja)
Since this system uses **Manual M-Pesa Code Entry** (not Daraja API), the sync process is very simple:
1.  The cashier enters the M-Pesa code locally as they do now.
2.  The code is saved to the local `sales` table.
3.  The **Sync Engine** simply uploads that code along with the sale details to the cloud.
4.  The owner sees the M-Pesa code in their remote dashboard and can verify it against their business phone.
*   *Benefit*: No need for expensive API certificates or static IPs required by Daraja.

---

## 6. Security & Data Residency
*   **Encryption**: All data synced to the cloud is encrypted via HTTPS/SSL by default in Supabase.
*   **Access Control**: Only the Admin user account created in Phase 4 will have permission to view the cloud data.
*   **Environment Variables**: We will use a `.env` file to store the Supabase URL and API Keys so they are never exposed in the source code.
