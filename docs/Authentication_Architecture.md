# Renachem POS Authentication Architecture

## Overview
This document outlines the authentication architecture for the Renachem Pharmacy POS system, specifically detailing the migration from Supabase GoTrue to a custom local JSON Web Token (JWT) implementation.

## The Problem: Supabase GoTrue Rate Limits and Lockouts
Initially, the system utilized Supabase Auth (GoTrue) to manage user sessions by creating "shadow" accounts (e.g., `username@renachem.local`) behind the scenes. 

While secure, this approach introduced a critical operational bottleneck for a Point of Sale environment: **IP-based Rate Limiting**.
Supabase enforces a strict limit of 5 login attempts per minute per IP address to prevent brute-force attacks. In a real-world pharmacy environment, if an Admin logs out and a Cashier immediately attempts to log in on the same network or device, Supabase flags this as suspicious behavior. 

This resulted in:
- **"Invalid username or password" / "Cloud session failed" errors.**
- **A 30 to 45-minute IP lockout**, completely preventing any staff from accessing the POS system.
- Inability for multiple users to log in simultaneously or sequentially from the same network without artificial delays.

## The Solution: Local HMAC-SHA256 In-Memory JWTs
To eliminate these bottlenecks while maintaining enterprise-grade security, the dependency on Supabase Auth (GoTrue) was completely removed. The system now utilizes stateless, cryptographically signed JSON Web Tokens (JWTs) generated natively by the Node.js backend.

### How It Works

1. **Database Authentication (`api/auth-login.js`)**:
   - When a user logs in, the backend queries the custom `public.users` table in Supabase.
   - The provided password is securely verified against the stored `password_hash` using standard `bcryptjs`.

2. **JWT Generation**:
   - Upon successful verification, the server generates a JWT containing the user's `id`, `username`, and `role`.
   - This token is signed using the HMAC-SHA256 algorithm via Node's native `crypto` module, utilizing the highly secure `APP_SECRET` environment variable as the cryptographic key.
   - The token is set to expire after 24 hours.

3. **Zero-Latency Verification (`api/utils/auth.js`)**:
   - For every subsequent API request (e.g., fetching products, recording sales), the client sends the JWT in the `Authorization` header.
   - The backend decodes and verifies the token's signature mathematically in-memory.
   - **Crucially, this verification requires ZERO network calls to Supabase.** 

4. **Streamlined Recovery (`api/auth-recover.js`)**:
   - Password resets are handled entirely by updating the `bcrypt` hash in the `public.users` table, bypassing any external auth synchronization.

## Benefits of the New Architecture

- **Zero Rate Limits**: Staff can log in and out instantaneously as many times as needed. There are no lockouts or delays.
- **Concurrent Access**: Multiple users (Cashiers, Pharmacists, Admins) can log in simultaneously from the same IP address or network without interfering with each other.
- **Lightning Fast Performance**: Because token verification happens locally in memory via cryptography rather than making an HTTP request to an external auth server, API route execution is incredibly fast.
- **Simplified Database**: There is no longer a need to maintain and synchronize a "shadow" user database in Supabase Auth. The `public.users` table acts as the single source of truth.

## Security Considerations
- The integrity of the entire authentication system relies on the `APP_SECRET` environment variable. This secret must remain confidential and should be securely configured in the Vercel dashboard.
- If the `APP_SECRET` is compromised or changed, all existing user sessions will immediately become invalid, requiring users to log in again.
