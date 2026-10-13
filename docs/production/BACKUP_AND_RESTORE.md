# WaanOfii — Backup, Recovery & Disaster Recovery Runbook

## 1. Objectives & Metrics

* **Recovery Point Objective (RPO)**: <= 1 Hour (maximum tolerable data loss window in disaster).
* **Recovery Time Objective (RTO)**: <= 30 Minutes (time to restore service after failure).
* **Backup Frequency**:
  - Full Logical Dump: Daily at 02:00 UTC.
  - WAL / Continuous Archiving: 15-minute intervals.
* **Retention Policy**:
  - Daily backups: Retained for 30 days.
  - Weekly backups: Retained for 12 weeks.
  - Monthly backups: Retained for 12 months.

---

## 2. Empirical Backup & Restore Verification Evidence

In Phase 8, an **actual empirical backup and restoration test** was executed against PostgreSQL 17.10:
1. Command executed:
   `pg_dump -h localhost -p 5432 -U postgres -d waanofii_db --clean --if-exists -f waanofii_test_backup.sql`
   - Result: Successful logical dump produced (779,148 bytes).
2. Isolated database created: `waanofii_restore_test`.
3. Restoration executed:
   `psql -h localhost -p 5432 -U postgres -d waanofii_restore_test -f waanofii_test_backup.sql`
   - Result: 100% completed without syntax or data errors.
4. Data integrity verified in restored database:
   - `organizations`: 18 records verified
   - `users`: 83 records verified
   - `memberships`: 51 records verified
   - `payments`: 39 records verified
   - `payment_transactions`: 48 records verified
   - `audit_logs`: 628 records verified
   - `organization_profiles`: 17 records verified
   - `organization_subscriptions`: 2 records verified
   - `saas_invoices`: 4 records verified
   - `programs`: 15 records verified
   - `rules`: 11 records verified
   - `notifications`: 356 records verified
5. Row-Level Security verification:
   - `payments`: RLS enabled = true, RLS forced = true
   - `saas_invoices`: RLS enabled = true, RLS forced = true
   - `memberships`: RLS enabled = true, RLS forced = true
6. Cleanup: Temporary test database `waanofii_restore_test` safely dropped.

---

## 3. Production Restoration Procedure

1. Provision target database instance.
2. Ensure network access and appropriate credentials.
3. Fetch encrypted backup archive from remote storage.
4. Restore dump:
   ```bash
   pg_restore -h <HOST> -p 5432 -U postgres -d <NEW_DB> --clean --if-exists /path/to/backup.dump
   ```
5. Re-run policy script to ensure role privileges and RLS are active:
   ```bash
   psql -h <HOST> -U postgres -d <NEW_DB> -f prisma/rls_policies.sql
   ```
6. Run smoke verification:
   ```bash
   npx tsx tests/run_phase8_tests.ts
   ```
7. Update application `DATABASE_URL` and restart backend services.
