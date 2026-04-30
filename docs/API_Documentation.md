# Technical API Documentation: Renachem POS Cloud

This document describes the API architecture, endpoints, and operational flow of the Renachem Pharmacy POS cloud backend.

## 1. System Architecture
The system uses a **Hybrid Bridge Architecture**. 
- **Desktop Mode**: Uses local SQLite via Electron IPC.
- **Web Mode**: Uses the `web-app.js` bridge to communicate with **Netlify Serverless Functions** via RESTful APIs.

## 2. Core API Modules

### A. Authentication & Security (`auth-*`)
| Endpoint | Function | Importance |
| :--- | :--- | :--- |
| `auth-login` | Authenticates users and generates a 24h Bearer Token. | The gatekeeper of the system. |
| `auth-recover` | Resets Admin password using the `APP_SECRET` key. | Emergency access recovery. |
| `auth-verify` | Verifies passwords for sensitive actions (e.g., deleting records). | Prevents unauthorized destruction. |

### B. Inventory Management (`products-*`)
| Endpoint | Function | Importance |
| :--- | :--- | :--- |
| `products-get` | Retrieves the list of medicines, stock levels, and prices. | Powers the POS and Inventory tabs. |
| `products-add` | Creates new medicine records in the cloud. | Essential for onboarding new stock. |
| `products-update` | Modifies existing products (price changes, stock edits). | Keeps the inventory accurate. |

### C. Sales & Finance (`sales-*`, `credits-*`)
| Endpoint | Function | Importance |
| :--- | :--- | :--- |
| `sales-add` | Processes a complete sale and updates stock levels. | The primary revenue-generating API. |
| `sales-get` | Fetches historical sales data for reports. | Powers the Dashboard and Reports. |
| `credits-manage` | Handles credit tracking, payments, and history. | Manages debt and customer balances. |

### D. Relationship Management (`clients-*`, `suppliers-*`)
| Endpoint | Function | Importance |
| :--- | :--- | :--- |
| `clients-manage` | Handles CRUD for both **Patients** and **Customers**. | Tracks patient history and standing meds. |
| `suppliers-manage` | Manages vendor information and contact details. | Essential for stock procurement. |

### E. System Operations (`settings-*`, `audit-*`)
| Endpoint | Function | Importance |
| :--- | :--- | :--- |
| `settings-manage` | Handles user accounts, roles, and store config. | Administrative control center. |
| `audit-log` | Records and retrieves cryptographic security logs. | Ensures accountability and security. |

---

## 3. Operational Flow

### 1. The Handshake (Tokenization)
When you log in, `auth-login` generates a secure `token`. This token is stored in your browser's `localStorage`. For every future request, the app sends this token in the `Authorization` header:
`Authorization: Bearer <your_token>`

### 2. The Verification Gate
The `verifySession` utility inside each API function checks:
1. Is the token provided?
2. Does it exist in the `sessions` table in Supabase?
3. Has it expired?
If any check fails, the API returns a `401 Unauthorized` error.

### 3. Database Interaction (Supabase)
The APIs act as a **Secure Proxy**. They use the `SUPABASE_SERVICE_KEY` to talk to the database. This ensures that the database is never directly exposed to the public; all data must pass through the API's security logic first.

### 4. Logging
Whenever a write operation happens (Adding a product, making a sale), the API automatically calls the `logAction` function to record who did it and when.

---
*Documentation Version: 1.2*
*Last Updated: 2026-04-30*
