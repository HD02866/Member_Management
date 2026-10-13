# WAANOFII DATABASE ARCHITECTURE & SPECIFICATION
## Phase 2: Relational Data Model, Constraints, Indexing & Operations

---

## 1. ARCHITECTURAL OVERVIEW & TECHNOLOGY CHOICES

The WaanOfii database layer is built on:
* **Database Engine:** PostgreSQL 17+ (native relational integrity, native UUIDs, JSONB GIN indexing, and Row-Level Security).
* **ORM & Migration Pipeline:** Prisma ORM 6.19.3 with TypeScript.
* **Multi-Tenancy Pattern:** Shared Database + Shared Schema with `organization_id` Discriminator Column, backed by dual-layer isolation (Application context middleware + PostgreSQL RLS).

---

## 2. PRIMARY KEY STRATEGY EVALUATION & DECISION

| Strategy | Security & URL Exposure | Distributed Systems | Indexing Performance | Prisma / PostgreSQL Support | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Auto-Increment Integer (`SERIAL` / `BIGSERIAL`)** | **Extremely Vulnerable:** Exposes entity volume, allows trivial sequential enumeration (`/members/1`, `/members/2`), leaks business growth to competitors. | Poor: Requires centralized sequence coordination. | High (sequential integer B-Tree). | Supported natively. | **REJECTED (Dangerous for Multi-Tenant SaaS)** |
| **CUID / CUID2** | Good (Collision resistant string). | Good (Client-side generation). | Medium: Variable-length string, larger storage footprint (24 bytes) compared to binary UUID. | Supported via application default. | **REJECTED (Storage & Index Overhead)** |
| **UUIDv7 (Time-Ordered)** | Excellent: 128-bit entropy, unguessable, time-ordered for sequential B-Tree indexing. | Optimal. | Optimal: Mitigates index fragmentation. | Emerging support in Postgres 17; requires custom generator extensions. | **FUTURE PATH** |
| **Native UUID (UUIDv4 compatible)** | **Optimal:** 128-bit cryptographic entropy, unguessable, URL-safe, mitigates sequential enumeration. | Optimal: Independent generation anywhere. | High: Compact native 16-byte binary storage in PostgreSQL. | **Native:** `@default(uuid())` in Prisma and `gen_random_uuid()` in PostgreSQL. | **ADOPTED AS PRIMARY KEY STANDARD** |

### Decision Summary & Security Boundary Principle:
All primary keys use native PostgreSQL **`UUID`** generated via `@default(uuid())`.
> [!IMPORTANT]
> **Correct Security Principle:**
> UUIDs reduce predictable identifier enumeration, but **do NOT replace authorization, tenant isolation, or object-level ownership checks**. If an attacker obtains a valid UUID, access is still strictly governed by backend PBAC guards, `TenantContext` isolation, and PostgreSQL Row-Level Security.

---

## 3. AUTHENTICATION IDENTIFIER STRATEGY & NORMALIZATION

### Challenge:
In Western SaaS, Email is assumed universal. In East Africa (and specifically for Ethiopian community associations like the 4B Association), many active members operate primarily via **Mobile Phone Number** (Telebirr, CBE Mobile Banking) rather than email.

### Database Enforcement:
1. **Dual Identifiers:** The `users` table defines both `email` and `phone_number` as optional and independently unique.
2. **Database CHECK Constraint:** The database strictly prevents phantom accounts via:
   ```sql
   ALTER TABLE "users" ADD CONSTRAINT "check_user_has_auth_identifier" 
     CHECK ("email" IS NOT NULL OR "phone_number" IS NOT NULL);
   ```
3. **Case-Insensitive Email Uniqueness:** To prevent email spoofing or account duplication through mixed-case variations (`Abebe@example.com` vs `abebe@example.com`), a functional unique index is enforced:
   ```sql
   CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" (LOWER("email")) WHERE "email" IS NOT NULL;
   ```
4. **Phone Formatting:** Phone numbers must be normalized to standard E.164 international format (e.g., `+251911000001`) at the application/API layer prior to insertion.

---

## 4. DYNAMIC CONTENT LOCALIZATION: JSONB VS. RELATIONAL TRANSLATION TABLES

We conducted a deep architectural evaluation between:
* **Option A: PostgreSQL JSONB Localization Pattern** (`title: { "en": "...", "am": "..." }`)
* **Option B: Relational Translation Tables** (`programs_translations(id, program_id, lang, title, desc)`)

### Evaluation Matrix:

| Criterion | Option A: JSONB Localization | Option B: Relational Translation Tables |
| :--- | :--- | :--- |
| **Prisma Query Complexity** | **Zero Joins:** Single query returns all translations instantly. | High: Requires nested `include: { translations: true }` on every query. |
| **Schema Proliferation** | **Clean:** 0 extra tables. | Bloated: Requires 10+ additional join tables (`program_translations`, `rule_translations`, etc.). |
| **Schema Migrations for New Languages** | **Zero Migrations:** Adding Afaan Oromoo (`om`) or Tigrinya (`ti`) requires no DDL changes. | Rigid: Modifying enums or handling non-standard language codes across foreign keys. |
| **Full-Text & Key Search** | Supported in PostgreSQL 17 via JSONB GIN indexes and `->>` operators. | Supported via relational indexes. |
| **Partial Translation Graceful Fallback** | Trivial: Application can check `field[userLang] ?? field['en'] ?? field['am']`. | Complex: Requires outer joins or multi-step SQL queries. |
| **Decision** | **ADOPTED FOR DYNAMIC TENANT CONTENT** | **REJECTED** |

**Static UI Elements:** Static navigation buttons, form labels, and validation messages continue to live in frontend JSON dictionary files (`next-intl`), giving maximum edge caching speed.

---

## 5. CANONICAL TIMESTAMPS & THE ETHIOPIAN CALENDAR

* **PostgreSQL Storage:** All system timestamps (`created_at`, `updated_at`, `start_date`, `end_date`, `paid_at`, `expires_at`) are strictly stored in **UTC format** using `TIMESTAMP(3)` / `timestamptz`.
* **Zero Database Date Drift:** The database never stores localized Ge'ez calendar dates as canonical timestamps.
* **Presentation Transformation:** The application layer performs deterministic mathematical conversions between Gregorian UTC and the Ethiopian Calendar (12 months of 30 days + *Pagumē* 13th month).
* **Tenant Default Timezone:** Set to `Africa/Addis_Ababa` (UTC+3) on the `organizations` table to guarantee that midnight expiration crons execute correctly according to local time.

---

## 6. SOFT DELETE POLICY MATRIX

Blindly soft-deleting every table degrades database performance, creates phantom unique-constraint collisions, and complicates queries. We enforce an explicit per-entity policy:

| Entity Category | Entity Name | Soft Delete (`deleted_at`)? | Rationale |
| :--- | :--- | :---: | :--- |
| **Tenant Root** | `Organization` | **YES** | Allows 90-day grace period before physical deactivation and data purging. |
| **Global IAM** | `User`, `Session` | **NO** | User accounts transition to `status = DEACTIVATED`. Sessions are hard-deleted upon logout. |
| **Staff Affiliation** | `StaffMembership` | **NO** | Staff roles are revoked via `is_active = false`. Historical access preserved in `audit_logs`. |
| **Constituents** | `MemberProfile` | **YES** | Allows an association to archive a member profile while preserving payment and card history. |
| **Plans & Catalogs** | `MembershipPlan` | **YES** | Archived plans must not be selectable for new members, but historical memberships still reference them. |
| **Financial Records** | `Payment`, `PaymentProof`, `PaymentReview`, `PaymentTransaction` | **STRICTLY NO (NEVER)** | **Financial Integrity:** Financial ledgers and bank deposit slips must never be soft-deleted. They are permanent, immutable accounting records. |
| **Issued Credentials** | `DigitalMembershipCard`, `VerificationToken` | **NO** | Cards are revoked via `status = REVOKED`, not deleted. Preserves historical auditability. |
| **Scan Logs** | `VerificationLog` | **STRICTLY NO** | Append-only gate verification audit record. |
| **CMS & Content** | `Leader`, `Program`, `Benefit`, `Rule`, `Announcement` | **YES** | Standard content archiving and unpublishing. |
| **Audit Logs** | `AuditLog` | **STRICTLY NO** | Append-only regulatory compliance ledger. |

---

## 7. INDEXING STRATEGY

Indexes are designed around real-world high-throughput access patterns:

### 7.1 Single-Column Strategic B-Trees
* `organizations(slug)`: Subdomain and domain resolution on every incoming HTTP request.
* `users(email)`, `users(phone_number)`: Sub-millisecond authentication credential lookups.
* `verification_tokens(token)`: Ultra-fast QR code verification scans at gate entry ($\le 10\text{ ms}$).
* `payments(status)`: Review queue filtering for finance officers.
* `memberships(status)`, `memberships(end_date)`: Automated nightly expiration crons.

### 7.2 Critical Composite Indexes
1. `member_profiles(organization_id, member_number) UNIQUE`:
   * Guarantees member numbers (e.g. `4B-2026-00101`) are unique per association without cross-tenant collision.
2. `member_profiles(organization_id, user_id) UNIQUE`:
   * Prevents a single user from being registered twice as a member within the same association.
3. `payments(organization_id, transaction_reference) UNIQUE`:
   * **Core Anti-Fraud Defense:** Prevents reuse of the same bank transfer reference code (e.g., CBE `FT...` or Telebirr transaction code) within an association.
4. `staff_memberships(organization_id, user_id) UNIQUE`:
   * Enforces single authoritative staff role assignment per user per tenant.
5. `digital_membership_cards(organization_id, card_number) UNIQUE`:
   * Guarantees unique card numbering per organization.
6. `audit_logs(organization_id, created_at)`:
   * Supports paginated, chronological audit log queries within a tenant.

---

## 8. DATABASE CONSTRAINTS & REFERENTIAL ACTIONS

### 8.1 Referential Integrity Rules
* **Tenant Cascade:** Deleting or archiving an `Organization` cascades to its tenant-owned metadata (`OrganizationProfile`, `Program`, `Rule`, `Benefit`).
* **Financial Protection (`onDelete: Restrict`):**
  * A `MembershipPlan` cannot be physically deleted if active `Membership` records reference it (`onDelete: Restrict`).
  * A `Role` cannot be deleted if active `StaffMembership` records reference it (`onDelete: Restrict`).
  * A `Payment` cannot be orphaned; it is tied to both `Organization` and `Membership`.
* **Reviewer Audit Preservation (`onDelete: SetNull`):**
  * If a staff reviewer user account is ever deleted, past payment reviews retain the decision and timestamp while setting `reviewedByUserId = NULL`.

---

## 9. OPERATIONS, MIGRATIONS & SEED VERIFICATION

### 9.1 Running Migrations
To apply migrations against `waanofii_db`:
```bash
npx prisma migrate dev
```
To deploy migrations in production environments (CI/CD):
```bash
npx prisma migrate deploy
```

### 9.2 Running Deterministic Seeds
To seed the database with the 4B Association and demo tenants:
```bash
npm run seed
# or
npx prisma db seed
```

### 9.3 Running the Automated Test Suite
To execute the comprehensive 30-assertion database test suite:
```bash
npm test
# or
npx tsx tests/run_database_tests.ts
```

---

## 10. UNRESOLVED / FUTURE ARCHITECTURAL DECISIONS

1. **UUIDv7 Native Migration:** When PostgreSQL 17 native `uuid_generate_v7()` becomes fully standard in Prisma ORM, evaluate migrating from UUIDv4 to UUIDv7 for sequential B-Tree performance at 10M+ rows.
2. **Read-Replicas for Public QR Verification:** In high-volume event check-in scenarios (10,000 members entering a stadium within 1 hour), evaluate routing `GET /verify?tid=...` queries to a PostgreSQL read-replica.
3. **Partitioning for Audit Logs:** When platform audit logs exceed 50,000,000 rows, implement PostgreSQL declarative range partitioning by `created_at` (monthly or quarterly partitions).
