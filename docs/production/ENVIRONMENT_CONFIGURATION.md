# WaanOfii — Environment Configuration & Secrets Management

## 1. Environment Separation Principles

WaanOfii enforces strict environment segregation across four tiers:
* **Development (`development`)**: Local developer workstation with mocked providers.
* **Test (`test`)**: Automated test suites executed with in-memory or ephemeral databases.
* **Staging (`staging`)**: Isolated mirror of production with sanitized seed data and sandbox provider keys.
* **Production (`production`)**: Live commercial deployment with encrypted credentials and strict firewall isolation.

---

## 2. Secrets Protection Rules

1. **Zero Secret Persistence in Git**: `.env` and `.env.local` files are strictly ignored by `.gitignore`.
2. **Frontend Bundle Isolation**: Only variables prefixed with `NEXT_PUBLIC_` are exposed to client JavaScript. Database URLs, JWT secrets, webhook secrets, encryption keys, and SMTP credentials must **never** be prefixed with `NEXT_PUBLIC_`.
3. **Log Sanitization**: Application loggers and filters redact sensitive keys (`password`, `accessToken`, `signature`, `tokenHash`, `qrToken`, `secret`).

---

## 3. Backend Configuration Variables

| Variable | Required | Default / Format | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Environment mode (`development`, `test`, `production`) |
| `PORT` | No | `3000` | HTTP port for backend API |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/db` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | 64+ char random hex string | Secret key for signing access tokens |
| `JWT_REFRESH_SECRET`| Yes | 64+ char random hex string | Secret key for signing refresh tokens |
| `COOKIE_SECRET` | Yes | 32+ char random string | Secret key for signing HttpOnly cookies |
| `CORS_ORIGINS` | Yes | `https://waanofii.com,https://*.waanofii.com` | Comma-separated allowlist of origins |
| `STORAGE_ENDPOINT` | No | S3 endpoint URL | Object storage endpoint for uploads |
| `STORAGE_BUCKET` | No | `waanofii-proofs-prod` | Storage bucket name |
| `SMTP_HOST` | No | `smtp.provider.com` | Production SMTP hostname |
| `SMTP_PORT` | No | `587` | SMTP submission port |
| `SMTP_USER` | No | `notifications@waanofii.com` | SMTP username |
| `SMTP_PASS` | No | Secret string | SMTP password |
| `CHAPA_SECRET_KEY` | No | `CHASECK_LIVE_...` | Chapa merchant API secret key |
| `CHAPA_WEBHOOK_SECRET` | No | 32+ char string | Webhook HMAC verification secret |
| `TELEBIRR_APP_ID` | No | Provider ID | Telebirr merchant application ID |
| `TELEBIRR_PUBLIC_KEY` | No | PEM string | Telebirr RSA public key |
| `TELEBIRR_PRIVATE_KEY`| No | PEM string | Merchant RSA private key for order signing |
| `CBE_BIRR_MERCHANT_CODE` | No | Merchant code | CBE Birr merchant identification |
| `CBE_BIRR_KEY` | No | Secret string | CBE Birr API cryptographic key |

---

## 4. Frontend Configuration Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Publicly reachable base URL of backend API (e.g., `https://api.waanofii.com/api/v1`) |
| `NEXT_PUBLIC_APP_DOMAIN` | Yes | Root domain of application (e.g., `waanofii.com`) |
