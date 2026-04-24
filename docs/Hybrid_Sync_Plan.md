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

## 4. Security Considerations
*   **Encryption**: All data synced to the cloud must be encrypted via HTTPS/SSL.
*   **Data Residency**: Ensure cloud backups comply with local medical data privacy laws.
*   **Access Keys**: Never hardcode cloud passwords; use environment variables (`.env`).
