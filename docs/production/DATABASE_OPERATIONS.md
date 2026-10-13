# WaanOfii — Database Operations, Security & Migration Runbook

## 1. Database Architecture & Tenancy Model

WaanOfii employs a **shared database, shared schema** architecture with PostgreSQL Row-Level Security (RLS) enforcing strict multi-tenant boundaries on all 26 tenant-scoped tables.

### 1.1 Dedicated Runtime Roles
1. **`waanofii_app`**:
   - Standard runtime connection role for API operations.
   - Configured with `NOINHERIT NOBYPASSRLS`.
   - Has NO DDL privileges (`REVOKE CREATE ON SCHEMA public FROM waanofii_app`).
   - Tenant visibility strictly governed by `current_setting('app.current_organization_id', true)`.
2. **`waanofii_platform_admin`**:
   - Trusted role utilized for cross-tenant maintenance and global platform administration.
   - Configured with `NOINHERIT NOBYPASSRLS`.
   - Cannot be assumed or set by `waanofii_app`.

---

## 2. Safe Migration Procedures

### 2.1 Absolute Prohibitions
* **NEVER run `npx prisma migrate reset` against a staging or production database**. This completely drops and destroys all tables and tenant data.
* **NEVER run migrations as `waanofii_app`** (migrations require DDL permissions and must be executed by a provisioning role or pipeline with controlled access).

### 2.2 Standard Production Migration Pipeline
1. **Pre-Migration Backup**:
   ```bash
   pg_dump -h <HOST> -p 5432 -U postgres -d waanofii_db -Fc -f "/backups/pre_migrate_$(date +%Y%m%d_%H%M%S).dump"
   ```
2. **Dry-Run & Inspection**:
   ```bash
   npx prisma migrate status
   ```
3. **Migration Execution**:
   ```bash
   npx prisma migrate deploy
   ```
4. **Re-Apply & Verify RLS Policies**:
   ```bash
   psql -h <HOST> -U postgres -d waanofii_db -f prisma/rls_policies.sql
   ```
5. **Post-Migration Verification & Smoke Test**:
   ```bash
   npx tsx tests/run_database_tests.ts
   ```

### 2.3 Rollback & Forward Recovery Strategy
Because database resets are forbidden, if a migration introduces an issue:
1. If data loss has not occurred, deploy a forward-recovery migration via Prisma (`prisma migrate dev --create-only`).
2. If schema inconsistency or corruption occurred, execute a point-in-time restore from the pre-migration dump to a parallel database, verify data integrity, and switch application connection pools.
