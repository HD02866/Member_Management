# WAANOFII AUTHENTICATION & IDENTITY ARCHITECTURE
## Phase 3: Password Security, Dual Identifiers & Session Management

---

## 1. DUAL LOGIN IDENTIFIERS & CANONICAL NORMALIZATION

WaanOfii supports authentication via **Email** or **Mobile Phone Number**. To prevent account duplication and spoofing, all identifiers undergo strict normalization before lookup or insertion:

### 1.1 Email Normalization
* Trimmed of whitespace and converted entirely to lower-case (`email.toLowerCase().trim()`).
* Enforced at the database layer via PostgreSQL functional unique index:
  ```sql
  CREATE UNIQUE INDEX users_email_lower_unique ON users (LOWER(email)) WHERE email IS NOT NULL;
  ```

### 1.2 Phone Number Canonicalization
* Normalized to international E.164 format.
* Local Ethiopian formats (e.g. `0911000003` or `0711000003`) are canonically converted to `+251911000003`.
* Enforces single account identity regardless of whether user inputs local or international formatting.

### 1.3 Identity Guarantee
* A database-level CHECK constraint guarantees every user has at least one valid identifier:
  ```sql
  ALTER TABLE users ADD CONSTRAINT check_user_has_auth_identifier 
  CHECK (email IS NOT NULL OR phone_number IS NOT NULL);
  ```

---

## 2. PASSWORD SECURITY SPECIFICATION (ARGON2ID)

All passwords are cryptographically hashed using **Argon2id** (the winner of the Password Hashing Competition and industry standard for resistance against GPU/ASIC attacks):

* **Algorithm:** `argon2id` (hybrid of data-dependent and data-independent memory access)
* **Time Cost:** `3 iterations`
* **Memory Cost:** `65,536 KiB (64 MiB)`
* **Parallelism:** `4 threads`
* **Salt:** Cryptographically secure high-entropy random salt generated automatically per password.

### Prohibited Practices
1. Plaintext passwords are NEVER stored in any database column, file, cache, or log.
2. Password hashes are strictly excluded from DTO outputs, controller responses, and debug logs.
3. Passwords must pass complexity validation: minimum 8 characters, uppercase, lowercase, and numbers/symbols.

---

## 3. SESSION & TOKEN STRATEGY

WaanOfii implements a dual session-token strategy optimized for browser SaaS security and mobile/API client flexibility:

```
[Client Login Request]
       │
       ▼
[Verify Argon2id Hash]
       │
       ▼
[Create Database Session] ───► sessions table (UUID, user_id, token, ip_address, expires_at)
       │
       ├──► 1. Sign Short-Lived JWT Access Token (15m validity, carries sessionId)
       └──► 2. Issue Session Refresh Token (7 days validity)
       │
       ▼
[Client Response]
       ├── Sets Secure HTTP-Only Cookie: access_token (SameSite=Lax/Strict)
       └── Returns JSON Payload: { user: {...}, tokens: { accessToken, refreshToken, expiresIn } }
```

### 3.1 JWT Access Token Structure
* **Expiration:** `15 minutes`
* **Payload:**
  ```json
  {
    "id": "user-uuid",
    "email": "user@example.com",
    "phoneNumber": "+251911000003",
    "firstName": "Kebede",
    "lastName": "Tadesse",
    "isPlatformAdmin": false,
    "status": "ACTIVE",
    "sessionId": "session-uuid",
    "iat": 1790743000,
    "exp": 1790743900
  }
  ```

### 3.2 Server-Side Session Revocation
* When a user calls `POST /api/v1/auth/logout`:
  1. The specific `sessionId` record is removed from the database `sessions` table.
  2. The browser `access_token` cookie is cleared (`res.clearCookie`).
  3. If an account is suspended or compromised, deleting all session records for that `userId` immediately revokes all active devices on the platform.

---

## 4. ACCOUNT ENUMERATION MITIGATION

To prevent malicious enumeration of active email addresses or phone numbers:
1. Failed logins return identical generic error messages: `"Invalid credentials"` regardless of whether the user exists or the password was incorrect.
2. Timing differences are minimized by executing Argon2 verify passes consistently.
3. Registration endpoints apply rate limiting (10 attempts per minute) via `@Throttle({ default: { limit: 10, ttl: 60000 } })`.

---

## 5. AUTHENTICATION API SPECIFICATION

| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Public, Throttled | Creates a new global User identity (does not create membership). |
| `POST` | `/api/v1/auth/login` | Public, Throttled | Authenticates user via email/phone + password; returns tokens. |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revokes current session and clears HTTP-only cookie. |
| `GET` | `/api/v1/auth/me` | Authenticated | Returns current profile and all active multi-tenant affiliations. |
