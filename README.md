# Renachem Pharmacy POS

A complete desktop pharmacy point-of-sale system for Kenyan pharmacies.

## Tech Stack
- Electron (desktop shell)
- SQLite with better-sqlite3 (local database)
- Express.js (M-Pesa payment server)
- M-Pesa Daraja API (STK Push payments)
- bcryptjs (password security)

## Setup for Developers
1. Clone: git clone [repo url]
2. Install: npm install
3. Create .env file (see Environment Variables below)
4. Start: npm start
5. Build installer: npm run build

## Environment Variables
Create a .env file in the root folder with these variables:
APP_SECRET — a random 64-character string
MPESA_CONSUMER_KEY — from Safaricom Daraja portal
MPESA_CONSUMER_SECRET — from Safaricom Daraja portal
MPESA_SHORTCODE — your Paybill or Till number
MPESA_PASSKEY — from Safaricom Daraja portal
MPESA_CALLBACK_URL — your public HTTPS callback URL
MPESA_BASE_URL — https://sandbox.safaricom.co.ke for testing or https://api.safaricom.co.ke for live

## Folder Structure
main.js — Electron main process
preload.js — Secure IPC bridge
server.js — Express M-Pesa server
database.js — SQLite database layer
renderer/ — Frontend HTML, CSS, JavaScript
assets/ — Icons and images

## Default Login
Username: admin
Password: Admin@1234 (forced change on first login)

## Features
- Role-based access: Admin, Pharmacist, Cashier
- Medicine inventory management
- Point of sale with cash and M-Pesa payments
- Patient and customer records
- Supplier management
- Purchase tracking
- Sales reports (daily, weekly, monthly, yearly)
- Audit log with tamper detection
- Auto-backup daily
