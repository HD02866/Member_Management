# WaanOfii — Incident Response & Security Runbook

## 1. Incident Classification

| Severity | Definition | Examples | Response Target |
|---|---|---|---|
| **P1 - BLOCKER** | Complete service outage, data compromise, or cross-tenant data leak | PostgreSQL down, RLS bypass, authentication broken | Immediate (< 15 mins) |
| **P2 - HIGH** | Core feature failure affecting multiple tenants | Payments failing across providers, notification delivery halted | < 1 hour |
| **P3 - MEDIUM** | Degraded functionality or non-critical provider failure | Chapa webhook timeout, temporary email delay | < 4 hours |
| **P4 - LOW** | Minor cosmetic defect or edge case | Localization typo, dashboard chart rendering issue | Next maintenance window |

---

## 2. Standard Operating Procedures (SOPs)

### 2.1 Security & Compromised Credential Incident
1. **Immediate Quarantine**: If a platform admin or tenant token is compromised, terminate active sessions via session store.
2. **Rotate Secrets**: Rotate `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, or provider API keys in environment configuration.
3. **Inspect Audit Trail**: Query `audit_logs` using correlation IDs and IP addresses to identify unauthorized actions.
4. **Tenant Communication**: Notify affected tenant administrative contacts.

### 2.2 Cross-Tenant Isolation Incident
1. **Immediate Lockdown**: If a cross-tenant data leak is detected, isolate the endpoint immediately or set affected organization to `SUSPENDED`.
2. **Verify RLS Integrity**: Verify PostgreSQL RLS status on all 26 tables:
   ```sql
   SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('payments', 'saas_invoices', 'memberships');
   ```
3. **Session Verification**: Ensure `app.current_organization_id` was not improperly cached in connection pooling.

### 2.3 Payment Gateway / Webhook Outage
1. **Switch to Manual Fallback**: If an external provider gateway (e.g., Chapa or Telebirr) experiences an API outage, switch tenant payment method priority to `MANUAL_BANK`.
2. **Reconciliation Batch**: After the gateway resumes operations, trigger batch reconciliation:
   ```bash
   POST /api/v1/payments/reconcile/batch
   ```
3. **Audit Discrepancies**: Investigate any flagged status mismatches before manually activating memberships.

### 2.4 Database Outage or Data Corruption
1. **Halt Writes**: Stop backend API instances to avoid split-brain states.
2. **Assess Integrity**: Check PostgreSQL error logs.
3. **Execute Point-in-Time Restore**: Follow restoration instructions in `BACKUP_AND_RESTORE.md`.
4. **Smoke Test**: Execute `npx tsx tests/run_phase8_tests.ts` before reopening traffic.
