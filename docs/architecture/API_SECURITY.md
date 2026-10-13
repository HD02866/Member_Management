# WAANOFII API SECURITY ARCHITECTURE & POLICIES
## Phase 3: Defense-in-Depth, Security Headers & Network Controls

---

## 1. DEFENSE-IN-DEPTH SECURITY MATRIX

WaanOfii enforces security across six concentric layers:

```text
+-------------------------------------------------------------------------------+
| LAYER 1: Network & Ingress (Helmet Headers, Strict CORS, Request Size Limits) |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
| LAYER 2: Request Throttling (Rate Limiting via @nestjs/throttler)             |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
| LAYER 3: Input Validation & Sanitization (Strict ValidationPipe & DTOs)       |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
| LAYER 4: Identity & Tenant Context (JWT, Argon2id, TenantGuard, RBAC)         |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
| LAYER 5: Database Role Separation ('waanofii_app' with NOBYPASSRLS)          |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
| LAYER 6: PostgreSQL Kernel Row-Level Security (FORCE ROW LEVEL SECURITY)     |
+-------------------------------------------------------------------------------+
```

---

## 2. HTTP SECURITY HEADERS (HELMET)

The backend utilizes `helmet` to automatically inject standard defensive HTTP headers:
* **Content-Security-Policy (CSP):** Configured to block cross-site script execution and unapproved content sources.
* **X-Content-Type-Options: `nosniff`:** Prevents MIME-type sniffing attacks.
* **X-Frame-Options: `DENY`:** Prevents clickjacking attacks by blocking iframe embedding.
* **Strict-Transport-Security (HSTS):** Enforces HTTPS transport with `max-age=31536000; includeSubDomains`.
* **X-XSS-Protection: `0`:** Disables obsolete, insecure browser XSS filters in favor of modern CSP.

---

## 3. STRICT CORS POLICY

* **Credentials:** `credentials: true` enables secure HTTP-only cookies across trusted origins.
* **Origin Whitelist:** Wildcard `*` origins are strictly forbidden when credentials are enabled.
* Allowed origins are dynamically configured via `CORS_ALLOWED_ORIGINS` (e.g. `http://localhost:3000,http://localhost:5173`).
* Requests from unauthorized origins are rejected before reaching controller route handlers.

---

## 4. RATE LIMITING & BRUTE-FORCE DEFENSE

Powered by `@nestjs/throttler`:
1. **Global Default:** 60 requests per minute per IP.
2. **Sensitive Authentication Routes (`/auth/login`, `/auth/register`):**
   * Stricter rate limit: **10 requests per minute** via `@Throttle({ default: { limit: 10, ttl: 60000 } })`.
   * Mitigates brute-force credential stuffing and registration flooding.
3. Extensible design: Ready for Redis storage in high-volume production deployments.

---

## 5. INPUT VALIDATION & PARAMETER INJECTION MITIGATION

Global `ValidationPipe` is enabled application-wide:
* `whitelist: true`: Automatically strips any property from the incoming JSON payload that is not explicitly declared in the target DTO.
* `forbidNonWhitelisted: true`: Immediately rejects payloads containing unknown or injected properties with `400 Bad Request`.
* Prevents privilege escalation attacks where an attacker attempts to inject `{ isPlatformAdmin: true }` or `{ role: "OWNER" }` into registration bodies.

---

## 6. STRUCTURED LOGGING & CORRELATION IDS

* **Request Correlation:** Every incoming request receives a unique UUID in header `x-correlation-id` (injected or preserved by `CorrelationIdMiddleware`).
* **Response Header:** The `x-correlation-id` is returned in the response header and response metadata for end-to-end distributed tracing.
* **Redaction Policy:**
  * Passwords, password hashes, and raw tokens are NEVER written to logs.
  * Audit logs automatically scrub sensitive keys (`password`, `token`, `secret`, `cookie`).
  * Database connection strings and credentials are completely absent from application logs.

---

## 7. SECRET MANAGEMENT STANDARDS

1. All secrets are managed strictly through environment variables (`.env`).
2. `.env` and `.env.*` are permanently ignored by [.gitignore](file:///C:/Users/Hp/Desktop/WaanOfii/.gitignore).
3. [.env.example](file:///C:/Users/Hp/Desktop/WaanOfii/.env.example) contains only non-sensitive placeholder templates.
4. Database superuser `postgres` is NEVER used for normal application operations; runtime queries execute under the dedicated `waanofii_app` non-superuser role.
