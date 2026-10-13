# WaanOfii — Production Release Checklist

## 1. Pre-Deployment Infrastructure Checklist

- [x] **PostgreSQL 17 Running**: Database cluster operational with high-availability configuration.
- [x] **Role Separation**: `waanofii_app` configured with `NOBYPASSRLS` and non-superuser status.
- [x] **Prisma Migrations Applied**: 5 migrations applied and verified in sync (`npx prisma migrate status`).
- [x] **Row-Level Security**: Forced on all 26 tenant tables via `prisma/rls_policies.sql`.
- [x] **Backup Verification**: `pg_dump` and logical restoration empirically tested and verified.
- [ ] **External SMTP Configured**: (Required only if live email delivery is chosen over console logging).
- [ ] **External Gateway Keys Configured**: (Required only if Chapa, Telebirr, or CBE Birr are used live).
- [ ] **Public HTTPS / DNS Configured**: (Required for public webhook ingress and production domains).

---

## 2. Application Build & Code Quality Checklist

- [x] **Backend Build**: `npm run build` (`tsc`) compiled with 0 errors.
- [x] **Frontend Build**: `npm run build:web` (`next build`) compiled all 24 routes with 0 errors.
- [x] **Bilingual Key Parity**: 100% key parity between English (`en.json`) and Amharic (`am.json`).
- [x] **Tenant Hardcoding Scan**: Zero occurrences of `4B` or `4b` in production logic (`src/` and `apps/web/src/`).
- [x] **Secrets Scan**: No database URLs, JWT keys, or provider secrets committed or exposed in frontend client bundles.

---

## 3. Test & Verification Gate Checklist

- [x] **Phase 2 (Database & RLS)**: 39 / 39 assertions passing.
- [x] **Phase 3 (Backend & Auth)**: 46 / 46 assertions passing.
- [x] **Phase 4 (Member Experience & Onboarding)**: 58 / 58 assertions passing.
- [x] **Phase 5 (Payments & Digital ID)**: 72 / 72 assertions passing.
- [x] **Phase 6 (External Payments & Ops)**: 98 / 98 assertions passing.
- [x] **Phase 7 (Org Ops, CMS, Notifications, Billing)**: 115 / 115 assertions passing.
- [x] **Phase 8 (Production Readiness, Security, Concurrency, Smoke)**: 93 / 93 assertions passing.
- [x] **Total Master Suite (`tests/run_all_tests.ts`)**: **521 / 521 assertions passing (100%)**.
- [x] **Git Repository State**: 0 commits created, 0 pushes executed, working tree cleanly maintained.
