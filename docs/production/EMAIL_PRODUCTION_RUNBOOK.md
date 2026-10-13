# WaanOfii — Email Delivery & Communications Runbook

## 1. Provider Abstraction & Architecture

Email delivery is managed by `NotificationsService` via an extensible provider abstraction:
* **`ConsoleEmailProvider`**:
  - Writes structured notification logs to standard output and audit logs.
  - Active and primary default in development, test, and unconfigured staging environments.
  - Status: **LOCALLY & INTEGRATION VERIFIED**.
* **`SmtpEmailProvider`**:
  - Implements production SMTP delivery via NodeMailer.
  - Connects to external SMTP hosts using TLS/STARTTLS.
  - Status: **IMPLEMENTED — EXTERNAL VERIFICATION NOT TESTED** (unconfigured in current environment).

---

## 2. Configuration & Credentials

When activating production email delivery, provide the following environment variables:
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxxxxx
SMTP_FROM="WaanOfii Platform <notifications@waanofii.com>"
```

### 2.1 Failure Handling & Non-Blocking Guarantee
- Email dispatch failures are logged with full correlation IDs but do **not** abort primary database transactions (such as membership activation or payment verification).
- In-app notification feed records are created independently of external SMTP status.

---

## 3. Communication Preferences & Anti-Spam
- System and security events (e.g., payment receipts, account security alerts) are flagged as non-opt-outable.
- General announcements and marketing broadcasts strictly respect member preferences (`notification_preferences.email_enabled = false`).
- Duplicate notification requests containing an `idempotencyKey` are deduplicated and logged.
