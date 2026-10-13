# WaanOfii Architecture — Payment Security & Anti-Fraud Controls

## 1. Overview

The WaanOfii financial architecture is engineered to resist common fraud, client manipulation, replay attacks, race conditions, and cross-tenant leakage.

---

## 2. Threat Models & Mitigations

### 2.1 Client Price Tampering
* **Threat**: A malicious client alters the payment request payload to set `amount: 1.00 ETB` or injects `isPaid: true`.
* **Mitigation**:
  * `InitiatePaymentDto` strictly forbids `amount`, `currency`, `status`, or `isPaid` via NestJS `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`.
  * The backend computes authoritative prices directly from the active `membership_plans` table inside a PostgreSQL RLS transaction.
  * Attempting to send extraneous fields immediately returns `HTTP 400 Bad Request`.

### 2.2 Payment Replay & Race Conditions (Idempotency)
* **Threat**: Double-clicking, network retry, or automated replay generates duplicate payment charges or duplicate memberships.
* **Mitigation**:
  * Clients send an `Idempotency-Key` HTTP header.
  * The database enforces a `UNIQUE(idempotency_key)` constraint on the `payments` table.
  * If an existing payment with the same idempotency key is detected, the API re-serves the existing record with `isReplay: true`, returning `HTTP 201 Created` with zero duplicate rows created.

### 2.3 Double Activation Replay
* **Threat**: Finance officer or attacker submits duplicate approval requests for an already verified payment.
* **Mitigation**:
  * Approval handlers inspect `if (payment.status === PaymentStatus.VERIFIED)` and immediately reject with `HTTP 409 Conflict` ("Payment has already been verified and processed").

### 2.4 Self-Approval (Segregation of Duties)
* **Threat**: A finance officer or system admin registers as a member, initiates a payment, and approves their own receipt without third-party oversight.
* **Mitigation**:
  * `PaymentsService.approvePayment` and `PaymentsService.rejectPayment` check `payment.memberProfile.userId === reviewerUserId`.
  * If matched, the request is aborted with `HTTP 403 Forbidden` and audited.

### 2.5 Proof Slip Reuse / Forgery
* **Threat**: An applicant re-uploads a previously used bank slip from another transaction or member.
* **Mitigation**:
  * PostgreSQL enforces `UNIQUE(organization_id, file_url)` in `payment_proofs`.
  * Reusing the same slip inside the organization throws database error `P2002`.

### 2.6 Cross-Tenant Financial Breaches
* **Threat**: A member or finance officer from Tenant A attempts to initiate, view, submit proof, or approve payments belonging to Tenant B.
* **Mitigation**:
  * All database operations are wrapped in `prisma.withTenantContext(organizationId, ...)`.
  * PostgreSQL Row-Level Security ensures that cross-tenant record lookups return 0 rows (triggering `HTTP 404 Not Found`).
  * `TenantGuard` verifies that the caller's JWT has valid membership in the requested `x-tenant-id`.
  * Cross-tenant attacks yield `HTTP 403 Forbidden` or `HTTP 404 Not Found`.

---

## 3. Financial Audit Trail

Every financial action writes an immutable record to the `audit_logs` table:
* `PAYMENT_INITIATED`: User ID, payment ID, reference, amount, currency.
* `PAYMENT_PROOF_SUBMITTED`: User ID, proof ID, file URL, submitted bank reference.
* `PAYMENT_APPROVED`: Reviewer user ID, payment ID, membership ID, card ID minted.
* `PAYMENT_REJECTED`: Reviewer user ID, payment ID, mandatory rejection reason.
* `CARD_ROTATED`: Member user ID, previous version, new version, rotation reason.

These records cannot be altered or removed through application APIs.
