# WaanOfii — Payment Production Runbook & Gateway Operations

## 1. Supported Payment Gateways & Verification Status

| Provider | Integration Type | Security Mechanism | Status in Current Environment |
|---|---|---|---|
| **MANUAL_BANK** | Bank deposit slip / transaction code review | Two-person review rule, binary proof validation, anti-reuse index | **LOCALLY & INTEGRATION VERIFIED** |
| **CHAPA** | Hosted Checkout redirect, REST verification, Webhooks | HMAC-SHA256 signature verification over raw request body | **IMPLEMENTED — EXTERNAL VERIFICATION NOT TESTED** |
| **TELEBIRR** | Mobile web payment, async notifications | RSA-SHA256 digital signature order signing | **IMPLEMENTED — EXTERNAL VERIFICATION NOT TESTED** |
| **CBE_BIRR** | CBE Merchant API, FT reference confirmation | HMAC-SHA256 signature verification | **IMPLEMENTED — EXTERNAL VERIFICATION NOT TESTED** |

---

## 2. Server-Authoritative Financial Controls

1. **Strict Pricing Authority**: Payment amounts and currencies are strictly derived from server-side database records of `membership_plans`. Any attempt by client requests or webhooks to submit a modified amount is rejected with `HTTP 400 Bad Request` and audited.
2. **Idempotency & Replay Protection**:
   - `payments` enforce compound uniqueness on `[organizationId, idempotencyKey]`.
   - `payment_transactions` enforce uniqueness on `[provider, providerTransactionId]`.
   - Webhook re-deliveries return `{ success: true, isReplay: true }` without double-crediting or re-issuing duplicate digital cards.
3. **Segregation of Duties**: Reviewers cannot approve or reject their own payments. Staff members must hold `tenant:payments:approve` permission.

---

## 3. Webhook Ingress Architecture

Public webhook ingress is mounted at:
`POST /api/v1/payments/webhooks/:provider`

### 3.1 Ingress Requirements
- **Raw Request Body**: Required to verify cryptographic signatures (configured via `NestFactory.create(AppModule, { rawBody: true })`).
- **Signature Headers**:
  - Chapa: `x-chapa-signature` (HMAC-SHA256)
  - Telebirr: `x-telebirr-signature` (RSA-SHA256)
  - CBE Birr: `x-cbe-birr-signature` (HMAC-SHA256)
- **Failure Behavior**: Missing or invalid signatures fail immediately with `HTTP 401 Unauthorized`.

---

## 4. Reconciliation & Reversals

### 4.1 Reconciliation Engine
- Individual: `POST /api/v1/payments/:id/reconcile`
- Batch: `POST /api/v1/payments/reconcile/batch`
- Scans `PENDING` and `UNDER_REVIEW` transactions against the external gateway API. Auto-resolves dropped webhooks if the provider confirms payment.

### 4.2 Financial Reversal vs. External Refund
> [!IMPORTANT]
> The WaanOfii reversal endpoint (`POST /api/v1/payments/:id/reverse`) performs an **internal financial-state reversal**:
> 1. Payment transitioned to `REFUNDED`.
> 2. Associated membership transitioned to `SUSPENDED`.
> 3. Digital card transitioned to `REVOKED` and QR token invalidated.
> 
> Status: **INTERNAL REVERSAL ONLY — EXTERNAL GATEWAY REFUND NOT IMPLEMENTED**. It does NOT trigger automated wire payouts via bank gateways.
