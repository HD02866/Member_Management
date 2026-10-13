# WaanOfii Architecture — Digital Membership ID & QR Verification

## 1. Overview

The WaanOfii Digital Membership ID provides an instant, tamper-resistant, verifiable identity credential for active organization members.

---

## 2. Cryptographic Token Generation & SHA-256 Hash-Only Lookup

Each digital card is paired with a 256-bit cryptographically secure verification token:

1. **Entropy**: Generated using Node.js `crypto.randomBytes(32).toString('hex')` (64 hexadecimal characters, 256 bits of entropy).
2. **Hash-Only Lookup (Phase 6 Hardening)**:
   * **Database Constraint**: `verification_tokens.token_hash` enforces a `UNIQUE` index (applied via migration `20261001120000_verification_token_hash_unique`).
   * **Lookup Pipeline**: When a verifier scans a token, `CardsService.verifyToken` computes `crypto.createHash('sha256').update(cleanToken).digest('hex')` and queries using `prisma.verificationToken.findUnique({ where: { tokenHash } })`.
   * **Security Guarantee**: Raw bearer tokens are never scanned sequentially in the database. Compromise of database read replicas or backup snapshots does not yield usable raw bearer QR tokens.
   * **Backward Compatibility**: Any legacy row lacking a hash is resolved once via fallback and immediately auto-upgraded with its computed SHA-256 hash.
3. **Expiration**: Synchronized with the membership expiration date (stored in UTC).


---

## 3. Public Verification & Minimal Disclosure

QR codes direct scanners to:
```text
https://waanofii.com/verify/{token}
```
Or via the public REST API:
```text
GET /api/v1/verify/:token
```

### 3.1 Unauthenticated Access
Because verifiers (event coordinators, venue security, partner institutions) may not possess accounts on WaanOfii, this endpoint is public and does not require authentication or tenant headers.

### 3.2 Minimal Disclosure Policy
To comply with strict privacy principles, verification responses disclose **only** the minimum necessary validation data:

```json
{
  "isValid": true,
  "result": "VALID",
  "message": "Membership credential is authentic and active.",
  "organization": {
    "name": "4B Association",
    "slug": "4b",
    "logoUrl": null
  },
  "member": {
    "displayName": "Abebe Bikila",
    "memberNumber": "4B-MEM-0001",
    "membershipPlan": "Annual Voting Member",
    "status": "ACTIVE"
  },
  "card": {
    "cardNumber": "4B-CARD-0001",
    "status": "ACTIVE",
    "cardVersion": 1,
    "expirationDate": "2027-10-01T00:00:00.000Z"
  }
}
```

#### Strictly Suppressed Fields:
* Email address
* Phone number
* National ID / Passport number
* Residential address
* Internal user ID
* Billing / payment details

### 3.3 Verification Outcomes
The API evaluates the card state and returns a typed enum `VerificationResult`:
* **`VALID`**: Card status is `ACTIVE`, token is unrevoked, expiration date is in the future, and membership status is `ACTIVE`.
* **`EXPIRED`**: Card or token expiration date is in the past.
* **`REVOKED`**: Card status is `REVOKED` or `isRevoked: true` (e.g., member suspended or card reported lost).
* **`INVALID`**: Token does not exist, malformed, or associated membership is inactive.

### 3.4 Verification Audit Logging
Every scan attempts to write a record to `verification_logs`:
* Scanned card ID
* Tenant organization ID
* Timestamp (UTC)
* Result (`VALID`, `EXPIRED`, `REVOKED`, `INVALID`)
* IP address and User-Agent

---

## 4. Card Versioning & Rotation Workflow

If a member loses their device or suspects their QR code has been compromised, they can rotate the card credential:

1. Member invokes `POST /api/v1/cards/rotate` with an optional `reason`.
2. The system increments `digital_membership_cards.card_version = card_version + 1`.
3. The existing verification token is replaced with a fresh 256-bit token.
4. Old verification tokens are immediately invalidated: subsequent scans of old QR codes fail with `result: "INVALID"`.
5. An audit log is recorded under `CARD_ROTATED`.
