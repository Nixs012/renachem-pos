# RENACHEM PHARMACY POS — MASTER REFERENCE GUIDE
> **Read this file at the start of EVERY prompt. Do not skip any section.**
> **Last Updated: 2026-05-23 | Version: 1.0.0**

---

## ⚠️ CRITICAL RULES — READ BEFORE EVERY SINGLE PROMPT

```
1. READ THIS FILE FULLY before writing a single line of code
2. NEVER break existing working features while adding new ones
3. ALWAYS wrap every function in try/catch — no exceptions
4. ALWAYS test what you build before saying it is done
5. NEVER hardcode API keys, URLs, or secrets in code
6. ALWAYS use the SUPABASE_SERVICE_ROLE_KEY for server-side operations
7. NEVER commit .env files to GitHub
8. ALWAYS show the complete updated file — never partial snippets
9. ALWAYS add CORS headers to every new API route
10. ALWAYS check the existing code before adding anything new
    — do not duplicate functions or create conflicts
```

---

## 🏗️ SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                   CLIENT BROWSER                        │
│  renderer/index.html + app.js + style.css               │
│  web-app.js (callApi bridge — calls /api/* routes)      │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTPS fetch to /api/*
┌──────────────────▼──────────────────────────────────────┐
│              VERCEL (hosting + API routes)               │
│  /api/auth-login.js                                     │
│  /api/auth-create-user.js                               │
│  /api/auth-verify.js                                    │
│  /api/save-sale.js                                      │
│  /api/get-invoices.js                                   │
│  /api/generate-invoice-number.js                        │
│  /api/get-medicine-sales-stats.js                       │
│  /api/update-medicine-stock.js                          │
│  /api/get-app-version.js                                │
└──────────────────┬──────────────────────────────────────┘
                   │ Supabase JS client
┌──────────────────▼──────────────────────────────────────┐
│              SUPABASE (PostgreSQL database)              │
│  Tables: users, sales, medicines, patients,             │
│  customers, suppliers, purchases, settings,             │
│  audit_log                                              │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 FILE STRUCTURE

```
renachem-pos/
├── api/                          ← ALL Vercel API routes live here
│   ├── auth-login.js
│   ├── auth-create-user.js
│   ├── auth-verify.js
│   ├── save-sale.js
│   ├── get-invoices.js
│   ├── generate-invoice-number.js
│   ├── get-medicine-sales-stats.js
│   ├── update-medicine-stock.js
│   └── get-app-version.js
├── renderer/
│   ├── index.html                ← Main HTML — no inline scripts
│   ├── app.js                    ← All frontend JavaScript
│   ├── style.css                 ← All CSS
│   └── web-app.js                ← API bridge (callApi function)
├── docs/                         ← Documentation only
├── .env.local                    ← Local dev only — NEVER commit
├── .gitignore                    ← Must include .env*, *.db, node_modules
├── vercel.json                   ← Vercel config (no Netlify rewrites)
├── package.json
└── RENACHEM_POS_MASTER_REFERENCE.md  ← THIS FILE
```

---

## 🚫 THINGS THAT MUST NEVER EXIST IN THIS CODEBASE

```
❌ /.netlify/functions/  — wrong platform, use /api/ always
❌ exports.handler =     — Netlify format, use export default function handler(req,res)
❌ localStorage          — replaced by Supabase, never use for data storage
❌ alert()               — replaced by showToast(), never use
❌ confirm()             — replaced by showConfirm() modal, never use
❌ Hardcoded URLs        — use window.location.origin or env vars
❌ Hardcoded API keys    — use process.env.* always
❌ Plain text passwords  — always use bcryptjs with saltRounds 12
❌ anon key for writes   — always use SUPABASE_SERVICE_ROLE_KEY server-side
❌ netlify/ folder       — deleted, must not reappear
❌ .env in git commits   — must be in .gitignore
```

---

## ✅ MANDATORY PATTERNS — USE THESE EVERY TIME

### Every /api/ route file must follow this exact template:
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // ← SERVICE ROLE KEY always
)

export default async function handler(req, res) {
  // CORS headers — mandatory on every route
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    // All logic inside try/catch
    const { field1, field2 } = req.body

    // Validate inputs before using them
    if (!field1) {
      return res.status(400).json({ success: false, message: 'field1 is required' })
    }

    // Do the work
    const { data, error } = await supabase.from('table').select('*')
    if (error) throw error

    return res.status(200).json({ success: true, data })

  } catch (error) {
    console.error('[route-name] Error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'An unexpected error occurred'
    })
  }
}
```

### Every callApi call in app.js must follow this pattern:
```javascript
try {
  const result = await callApi('route-name', { payload })
  if (!result.success) {
    showToast(result.message || 'Operation failed', 'error')
    return
  }
  // Use result.data
  showToast('Success message', 'success')
} catch (error) {
  showToast('Something went wrong. Please try again.', 'error')
  console.error('Error:', error)
}
```

### Every async render function must follow this pattern:
```javascript
async function renderXxx() {
  try {
    // render logic
  } catch (error) {
    showToast('Error loading [page name]. Please try again.', 'error')
    console.error('renderXxx error:', error)
    // Fallback — do not leave blank screen
    renderDashboard()
  }
}
```

---

## 🗄️ DATABASE SCHEMA (Supabase PostgreSQL)

### users
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
username    TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL          -- bcryptjs saltRounds 12
role        TEXT NOT NULL CHECK(role IN ('Admin','Pharmacist','Cashier'))
is_active   BOOLEAN DEFAULT true
is_temp_password BOOLEAN DEFAULT true
created_at  TIMESTAMPTZ DEFAULT NOW()
```
**RLS: DISABLED** — service role key used for all operations

### sales
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
invoice_number  TEXT                    -- format: INV-YYYYMMDD-XXXX
date            DATE
date_time       TEXT
items_json      TEXT                    -- JSON array of {name,qty,price,subtotal}
subtotal        NUMERIC DEFAULT 0
total           NUMERIC DEFAULT 0
payment_mode    TEXT                    -- 'Cash' | 'M-Pesa' | 'Split'
cash_amount     NUMERIC DEFAULT 0
mpesa_amount    NUMERIC DEFAULT 0
mpesa_code      TEXT DEFAULT ''
cashier_name    TEXT DEFAULT ''
customer_name   TEXT DEFAULT 'Walk-in'
receipt_html    TEXT DEFAULT ''
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### medicines
```sql
id              TEXT PRIMARY KEY
name            TEXT NOT NULL
batch           TEXT
expiry          TEXT
stock           INTEGER DEFAULT 0
reorder_level   INTEGER DEFAULT 10
price           NUMERIC DEFAULT 0
barcode         TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### patients
```sql
id          TEXT PRIMARY KEY
name        TEXT NOT NULL
age         TEXT
gender      TEXT
diagnosis   TEXT
prescriptions TEXT
history     TEXT
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### customers
```sql
id              TEXT PRIMARY KEY
name            TEXT NOT NULL
phone           TEXT
prescriptions   TEXT
history         TEXT
```

### suppliers
```sql
id      TEXT PRIMARY KEY
name    TEXT NOT NULL
contact TEXT
items   TEXT
```

### purchases
```sql
id          INTEGER PRIMARY KEY
med_name    TEXT
batch       TEXT
qty         INTEGER
date        TEXT
```

### settings
```sql
key         TEXT PRIMARY KEY
value       TEXT
updated_at  TIMESTAMPTZ DEFAULT NOW()
```
**Important keys:**
- `last_invoice_number` — global invoice counter
- `invoice_counter_YYYYMMDD` — daily counter per date
- `app_version` — current deployed version
- `last_backup` — last backup date

### audit_log
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     TEXT
username    TEXT
action      TEXT
module      TEXT
details     TEXT
timestamp   TIMESTAMPTZ DEFAULT NOW()
row_hash    TEXT
```
**Trigger:** `prevent_audit_delete` — deletion is blocked

---

## 👥 ROLES AND ACCESS CONTROL

```
Admin       → ALL modules including User Management, Invoices, Reports
Pharmacist  → dashboard, inventory, purchases, suppliers, 
              reports, patients, invoices
Cashier     → dashboard, pos, customers, patients
              (NO: user management, invoices, reports)
```

### hasAccess() must always enforce this:
```javascript
function hasAccess(module) {
  const role = currentUser?.role
  const access = {
    Admin:      ['dashboard','inventory','pos','patients','customers',
                 'suppliers','purchases','reports','users','invoices','help'],
    Pharmacist: ['dashboard','inventory','purchases','suppliers',
                 'reports','patients','invoices','help'],
    Cashier:    ['dashboard','pos','customers','patients','help']
  }
  return (access[role] || []).includes(module)
}
```

---

## 🔒 SECURITY CHECKLIST — VERIFY AFTER EVERY PROMPT

Before marking any prompt as complete, check all of these:

```
□ No hardcoded secrets or API keys in any file
□ All /api/ routes use SUPABASE_SERVICE_ROLE_KEY (not anon key)
□ All /api/ routes have CORS headers
□ All /api/ routes have try/catch wrapping all logic
□ All /api/ routes validate input before processing
□ All passwords hashed with bcryptjs saltRounds 12
□ .env is in .gitignore and not in git status
□ No localStorage used for data storage
□ No alert() or confirm() — only showToast() and showConfirm()
□ No /.netlify/functions references anywhere
□ All render functions have try/catch with fallback
□ Session token validated on all protected IPC/API calls
```

---

## 💳 PAYMENT MODES

```
Cash     → cashAmount = total, mpesaAmount = 0
M-Pesa   → cashAmount = 0, mpesaAmount = total (no STK Push — manual confirmation)
Split    → cashAmount + mpesaAmount = total exactly
           MUST tick "customer confirmed M-Pesa payment" checkbox
           One receipt issued showing both amounts
Insurance → record only, no payment processing
```

**Split Payment validation rules:**
1. cashAmount > 0
2. mpesaAmount > 0
3. Math.abs((cashAmount + mpesaAmount) - total) < 0.01
4. mpesaConfirmedCheck.checked === true
5. Complete Sale button disabled until all 4 pass

---

## 🧾 INVOICE NUMBER FORMAT

```
Format:  INV-YYYYMMDD-XXXX
Example: INV-20260522-0001
         INV-20260522-0002  (next sale same day)
         INV-20260523-0001  (resets next day)

Counter stored in: settings table
Key: invoice_counter_20260522  (one key per day)
Value: '3' (current count as string)
```

**Generation logic:**
```javascript
const today = new Date().toISOString().slice(0,10).replace(/-/g,'') // '20260522'
const settingKey = 'invoice_counter_' + today
// fetch current counter, increment, save, format with padStart(4,'0')
```

---

## 📊 MEDICINE SALES GRAPH

```
Location:   Reports page — above existing report tables
Chart type: Bar chart (Chart.js — already loaded in index.html)
X-axis:     Medicine names (top 15 by quantity)
Y-axis:     Quantity sold OR Revenue in KES (user selects)
Filter:     Date range from/to, defaults to current month
Data source: Parse items_json from sales table, aggregate by medicine name
Click:      Clicking a bar shows detail for that medicine
```

---

## 📑 INVOICES PAGE

```
Visible to: Admin, Pharmacist (NOT Cashier)
Nav icon:   fas fa-file-invoice
Data source: sales table (with invoice_number, cash_amount, mpesa_amount)
Default:    Last 50 invoices, current month date range
Badges:     SPLIT (purple), M-PESA (green), CASH (blue)
Actions:    View receipt modal, Print receipt
Export:     CSV download of filtered results
```

---

## 🔄 SYSTEM UPDATE MECHANISM

```
How it works:
1. APP_VERSION env var set in Vercel dashboard (e.g. '1.0.1')
2. CLIENT_VERSION constant in app.js (e.g. '1.0.0')
3. On login and every 30 mins: fetch /api/get-app-version
4. If versions differ: show blue banner at top of screen
5. "Update Now" → window.location.reload(true)
6. "Later" → dismiss banner

To deploy an update:
1. Push code to GitHub (Vercel auto-deploys)
2. Update APP_VERSION in Vercel env vars
3. Users see the update banner on next login or check
```

---

## 🧱 UI COMPONENT STANDARDS

### Toast notifications (ALWAYS use these, never alert()):
```javascript
showToast('Message here', 'success')   // green
showToast('Message here', 'error')     // red
showToast('Message here', 'warning')   // amber
// Auto-dismisses after 4000ms
```

### Confirm dialogs (ALWAYS use these, never confirm()):
```javascript
const confirmed = await showConfirm('Are you sure you want to delete this?')
if (!confirmed) return
```

### Loading states:
```javascript
// Always show loading state on buttons during async operations
btn.textContent = 'Saving...'
btn.disabled = true
try {
  await doWork()
} finally {
  btn.textContent = 'Save'
  btn.disabled = false
}
```

### Empty states (never show a blank table):
```javascript
if (data.length === 0) {
  tbody.innerHTML = `
    <tr><td colspan="X" style="text-align:center;padding:40px;color:#94a3b8;">
      <i class="fas fa-inbox" style="font-size:2rem;margin-bottom:8px;display:block;"></i>
      No records found
    </td></tr>
  `
  return
}
```

---

## 🌐 ENVIRONMENT VARIABLES

### Required in Vercel Dashboard (Settings → Environment Variables):
```
SUPABASE_URL              = https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhbGc...  (long key from Supabase API settings)
APP_SECRET                = [64 random chars]
APP_VERSION               = 1.0.0
RELEASE_NOTES             = Latest version
LAST_UPDATED              = 2026-05-22
```

### .env.local (local development only — NEVER commit):
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_SECRET=
APP_VERSION=1.0.0
```

### web-app.js callApi — always use dynamic origin:
```javascript
const BASE_URL = window.location.origin
const API_BASE = '/api'

const callApi = async (functionName, body = {}, method = 'POST') => {
  try {
    const url = `${BASE_URL}${API_BASE}/${functionName}`
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'GET' ? JSON.stringify(body) : undefined
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.message || `Request failed: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error(`API Call Failed [${functionName}]:`, error)
    throw error
  }
}
```

---

## 🧪 TESTING CHECKLIST — RUN AFTER EVERY PROMPT

### After every single prompt, verify:
```
□ No console errors on page load
□ No console errors when navigating to the affected page
□ The new feature works as described
□ Existing features still work (do a quick smoke test):
    □ Admin can log in
    □ Cash sale can be completed
    □ Inventory page loads
    □ Reports page loads
□ Mobile view is not broken (check at 375px width)
□ Check Network tab — no 401, 404, 500 errors
□ Supabase table has correct data after the operation
```

### After every GROUP of prompts:
```
□ Run git status — confirm .env not staged
□ All new /api/ routes exist and respond correctly
□ All new nav items respect role access
□ All new UI has error handling (try/catch, empty states)
□ No duplicate function names in app.js
□ No duplicate CSS class names in style.css
□ Receipt modal works and prints correctly
□ Export/download features work
```

---

## 🚀 DEPLOYMENT CHECKLIST

```
Before every git push:
□ Run: git status (confirm no .env, no *.db files staged)
□ Run: git diff (review all changes one more time)
□ All console.log statements that expose sensitive data removed
□ All TODO comments resolved or documented
□ Version number updated if this is a release

After every git push:
□ Check Vercel deployment logs for build errors
□ Visit the live URL and confirm app loads
□ Test login works on live URL
□ Test one complete sale flow on live URL
□ Check Vercel Functions logs for any runtime errors
```

---

## 🔧 COMMON ERRORS AND FIXES

### 401 Unauthorized on API calls
```
Cause:  Wrong API URL (Netlify vs Vercel) or missing auth
Fix:    Check web-app.js API_BASE = '/api' (not /.netlify/functions)
        Check Vercel env vars are set and redeployed after change
```

### User created but cannot log in
```
Cause:  Supabase RLS blocking reads OR using anon key instead of service role
Fix:    Run: ALTER TABLE users DISABLE ROW LEVEL SECURITY;
        Confirm all /api/ routes use SUPABASE_SERVICE_ROLE_KEY
```

### Invoice number not generating
```
Cause:  settings table does not exist OR API route not deployed
Fix:    Run SQL: CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)
        Check /api/generate-invoice-number.js exists and deployed
```

### Graph not showing
```
Cause:  Chart.js not loaded OR items_json parse failing
Fix:    Confirm <script src="Chart.js CDN"> is in index.html
        Add try/catch around JSON.parse(sale.items_json)
        Check items_json format in Supabase — must be valid JSON array
```

### Split payment amounts not adding up
```
Cause:  Floating point precision errors
Fix:    Always use: Math.abs((cash + mpesa) - total) < 0.01
        Never use: (cash + mpesa) === total
```

### Blank screen after navigation
```
Cause:  Render function threw and no catch block
Fix:    Wrap every render function in try/catch
        In catch block call renderDashboard() as fallback
```

### CORS error on API call
```
Cause:  Missing CORS headers on /api/ route
Fix:    Add to every route handler before any other code:
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
        if (req.method === 'OPTIONS') { res.status(200).end(); return }
```

---

## 📋 FEATURES STATUS TRACKER

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Role-based auth (Admin/Pharmacist/Cashier) | ✅ Done | |
| 2 | User management (Admin only) | ✅ Done | |
| 3 | Inventory management | ✅ Done | |
| 4 | POS — Cash payment | ✅ Done | |
| 5 | POS — M-Pesa payment (manual) | ✅ Done | No STK Push |
| 6 | Patient records | ✅ Done | |
| 7 | Customer records | ✅ Done | |
| 8 | Supplier management | ✅ Done | |
| 9 | Purchase tracking | ✅ Done | |
| 10 | Reports | ✅ Done | |
| 11 | Invoice generation + storage | 🔄 In Progress | Steps 1-2 Done, Steps 3-4 Pending |
| 12 | Split payment (Cash + M-Pesa) | 🔄 In Progress | Step 5 |
| 13 | Medicine sales graph | 🔄 In Progress | Step 6 |
| 14 | Invoices page (view/reprint) | 🔄 In Progress | Step 7 |
| 15 | System update notification | 🔄 In Progress | Step 8 |
| 16 | Loss report | ⏳ Planned | Next phase |
| 17 | Real M-Pesa STK Push | ⏳ Planned | Daraja live keys required |

---

## 📝 IMPLEMENTATION STEPS — CURRENT PHASE

### Do these in exact order. Do not skip.

```
STEP 1  → Invoice DB setup (Supabase SQL) [✅ Done]
STEP 2  → /api/generate-invoice-number.js [✅ Done]
STEP 3  → generateReceiptHTML() + showReceiptModal() in app.js
STEP 4  → Update finalizeSale() + /api/save-sale.js + /api/update-medicine-stock.js
STEP 5  → Split payment panel HTML + CSS + JavaScript in POS
STEP 6  → /api/get-medicine-sales-stats.js + graph in Reports page
STEP 7  → /api/get-invoices.js + renderInvoices() + Invoices nav item
STEP 8  → /api/get-app-version.js + checkForUpdates() + update banner
STEP 9  → Full end-to-end test of all features (29 test cases)
```

---

## 🎨 DESIGN SYSTEM

### Colors (use these — do not invent new ones):
```css
--primary:        #0ea5e9   /* Sky blue — buttons, headers */
--primary-dark:   #0284c7   /* Hover states */
--primary-light:  #e0f2fe   /* Light backgrounds */
--success:        #10b981   /* Green — success toasts, active badges */
--error:          #ef4444   /* Red — error toasts, warnings */
--warning:        #f59e0b   /* Amber — warning toasts */
--gray-50:        #f8fafc   /* Page backgrounds */
--gray-100:       #f1f5f9   /* Card backgrounds */
--gray-200:       #e2e8f0   /* Borders */
--gray-500:       #64748b   /* Secondary text */
--gray-900:       #0f172a   /* Primary text */
--split-purple:   #7c3aed   /* Split payment badge */
```

### Border radius (use these consistently):
```css
Buttons:      border-radius: 30px   (pill shape)
Cards:        border-radius: 20px
Inputs:       border-radius: 10px
Badges:       border-radius: 20px
Tables:       border-radius: 16px
Modals:       border-radius: 24px
```

### Spacing:
```css
Card padding:     24px
Section margin:   24px bottom
Input padding:    10px 14px
Button padding:   10px 24px (normal) | 6px 14px (small)
Table cell:       12px 16px
```

### Typography:
```css
Font:         'Inter' or system sans-serif
Page title:   1.5rem bold
Section head: 1.1rem bold
Body:         0.9rem regular
Small/hint:   0.78rem italic, color gray-500
```

---

## 🔁 GIT WORKFLOW

```bash
# Before starting any work
git pull origin main

# After completing each step
git add .
git status   # verify .env is NOT listed
git commit -m "feat: [what was done in plain language]"
git push origin main

# Commit message examples:
# "feat: add invoice number generation API route"
# "feat: add split payment panel to POS"
# "fix: correct CORS headers on get-invoices route"
# "style: add split payment badge styles to CSS"
```

---

## 📞 SUPPORT CONTACTS

```
Safaricom API Support:      APISupport@safaricom.co.ke
M-Pesa Business Team:       MpesaBusiness@Safaricom.co.ke
M-Pesa Organisation Portal: org.ke.mpesa.com
Supabase Support:           supabase.com/support
Vercel Support:             vercel.com/support
```

---

## 🔖 QUICK REFERENCE — PASTE AT TOP OF EVERY ANTIGRAVITY SESSION

```
SYSTEM: Renachem Pharmacy POS
STACK:  HTML/CSS/JS frontend + Vercel API routes + Supabase PostgreSQL
REPO:   GitHub → auto-deploys to Vercel on push
RULES:
  - API routes: /api/*.js (Vercel format, NOT Netlify)
  - DB key: SUPABASE_SERVICE_ROLE_KEY (not anon key)
  - No localStorage — use Supabase for all data
  - No alert() — use showToast()
  - No hardcoded URLs — use window.location.origin
  - Every function: try/catch with user-friendly error message
  - Every API route: CORS headers + input validation + try/catch
  - Read RENACHEM_POS_MASTER_REFERENCE.md before every prompt
```

---

*This document is the single source of truth for the Renachem Pharmacy POS project.
Update the Features Status Tracker after each completed step.
Keep this file in the project root and commit it to GitHub.*
