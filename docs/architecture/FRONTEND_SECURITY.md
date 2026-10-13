# WAANOFII FRONTEND SECURITY & TENANT ISOLATION SPECIFICATION
## Phase 4: Browser Security, Token Handling, Headers & Isolation Guarantees

---

## 1. AUTHENTICATION & CREDENTIAL STORAGE POLICIES

### 1.1 Zero Sensitive Data in LocalStorage
The frontend strictly prohibits storing sensitive credentials in browser storage:
- **Forbidden:** JWT secrets, database connection strings, Argon2id hashes, refresh token hashes, or persistent access tokens in `localStorage` or `sessionStorage`.
- **Permitted in LocalStorage:** Only non-sensitive UI state:
  - `waanofii_lang`: Current selected language (`en` or `am`).
  - `active_tenant_id`: Last selected organization context identifier.

### 1.2 HTTP-Only Cookie Strategy
Authentication primarily leverages secure HTTP-only cookies:
- **Cookie Name:** `access_token`
- **Attributes:**
  - `HttpOnly: true` (Inaccessible to client-side scripts, mitigating XSS token extraction)
  - `SameSite: Lax` in development; `Strict` in production
  - `Secure: true` in production (enforced via HTTPS)
  - `Max-Age: 900000` (15 minutes)
- **Fallback In-Memory Token:** If cross-port development partitions cookies, tokens are retained strictly in process memory (`let inMemoryAccessToken = null;`) and cleared on tab closure or logout.

---

## 2. TENANT ISOLATION AT THE CLIENT BOUNDARY

1. **No Client-Side Tenant Trust:** The frontend never assumes that a user has access to an organization merely because an ID is known or stored.
2. **Server-Side Verification:** Every tenant-scoped request is validated by `TenantGuard` and executed under PostgreSQL Row-Level Security (`withTenantContext`).
3. **Mismatched Header Protection:** If a user passes an active tenant header for Organization A while attempting to query records of Organization B, PostgreSQL RLS returns 0 rows or `TenantGuard` aborts with **HTTP 403 Forbidden**.

---

## 3. CORS & NETWORK SECURITY

### 3.1 Allowed Origins
The NestJS backend explicitly configures CORS origin whitelisting:
- Configured via `CORS_ALLOWED_ORIGINS` (defaults: `http://localhost:3000,http://localhost:3001,http://localhost:5173`).
- Wildcards (`Access-Control-Allow-Origin: *`) are strictly disabled.
- `credentials: true` enables the browser to transmit HTTP-only cookies securely.

### 3.2 Security Headers (Helmet)
The backend enforces security headers via `helmet`:
- `Content-Security-Policy`
- `X-Frame-Options: SAMEORIGIN` (Clickjacking prevention)
- `X-Content-Type-Options: nosniff` (MIME-sniffing mitigation)
- `Strict-Transport-Security` (HSTS)
- `X-XSS-Protection`

---

## 4. INPUT VALIDATION & ERROR ENVELOPES

1. **Client-Side Validation for UX:** Forms provide immediate feedback (required fields, email format, minimum password length).
2. **Server-Side Authoritative DTOs:** All controllers enforce `ValidationPipe` with:
   - `whitelist: true` (Discards undeclared properties)
   - `forbidNonWhitelisted: true` (Rejects payloads containing unexpected or protected fields with HTTP 400)
   - `transform: true` (Coerces types safely)
3. **No Account Enumeration:** Login and registration endpoints use uniform generic responses (`"Invalid credentials"`), preventing attackers from enumerating valid emails or phone numbers.
4. **Zero Internal Leakage:** Database connection strings, SQL traces, stack dumps, and passwords are fully stripped by `HttpExceptionFilter` and `AuditService.sanitizeData`.
