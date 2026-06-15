# Frontend Performance Audit: Slow Tab Switching

## 1. Executive Summary
An investigation into the "slow tabs" issue reported after migrating to the Vercel cloud environment has identified the root cause: **Synchronous, Blocking Network Requests on Tab Clicks**. 

While the application logic was perfectly fine for a local Electron desktop app with a zero-latency SQLite database, it creates significant bottlenecks when running in a cloud architecture.

## 2. Root Cause Analysis

### The Problem
When a user clicks a tab (e.g., clicking "Inventory"), the following sequence occurs in `app.js`:

1. The UI is cleared and a loading spinner is displayed.
2. The application pauses rendering and triggers `await window.db.getMedicines()`.
3. Because the system is running in Cloud Mode (`web-app.js`), this triggers a real HTTP request across the internet to the Vercel API.
4. The Vercel serverless function starts up, connects to Supabase, downloads the **entire** inventory table, and sends it back to the client.
5. Only after this entire multi-second network trip completes does the tab actually render the HTML.

### Why this didn't happen before
In the original local Desktop app, `window.db` communicated directly with an internal SQLite database via IPC (Inter-Process Communication). This happened in less than 5 milliseconds, making it perfectly safe to re-fetch data on every tab switch. Over the internet, this takes 500ms to 3,000ms.

## 3. Recommended Solutions

To make the tabs feel instantaneous again, we need to adapt the frontend architecture for the cloud. We should implement the following steps:

### Phase 1: Implement In-Memory Data Caching (Quickest Win)
Instead of fetching data every time a tab is clicked, we should implement a client-side cache (`window.appCache`). 
- When a user logs in, we fetch the core data (Medicines, Customers, Settings) once.
- When they click "Inventory", the app instantly renders from the local cache.

### Phase 2: Stale-While-Revalidate (SWR) Pattern
To ensure the data isn't outdated:
- Tab clicks render instantly from the cache.
- In the background, the app silently pings the Vercel API for any updates.
- If the background ping detects new data (e.g., another cashier made a sale), it quietly updates the cache and refreshes the table without a loading spinner.

### Phase 3: Server-Side Pagination
Currently, `app.js` downloads the entire database table and paginates it in JavaScript using `.slice()`. As the pharmacy grows to thousands of records, downloading the entire table will crash the browser. We need to move pagination to the Vercel API (`LIMIT` and `OFFSET` in Supabase) so the frontend only downloads 50 items at a time.

---

> [!IMPORTANT]
> **Next Steps:**
> I recommend we start with **Phase 1 & 2** by creating a unified `CacheManager` in `app.js` that intercepts calls to `window.db` and implements instant-loading. Do you approve moving forward with implementing the client-side caching?
