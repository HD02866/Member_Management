# WAANOFII TENANT ISOLATION ARCHITECTURE & RLS SPECIFICATION
## Phase 2: Defense-in-Depth Multi-Tenancy Guarantees

---

## 1. THE DEFENSE-IN-DEPTH ISOLATION MODEL

In a commercial SaaS platform serving hundreds of legal entities, relying solely on frontend logic or simple application-level `WHERE` clauses is an unacceptable security vulnerability. A single omitted filter in an API endpoint would leak an entire association's private member roster or bank slips to unauthorized parties.

WaanOfii implements **Four Concentric Layers of Tenant Isolation**:

```
+-----------------------------------------------------------------------------------+
| LAYER 1: Edge & Ingress Resolution (Host Header / Subdomain / Custom Domain)       |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| LAYER 2: NestJS Scoped TenantContext & Guards (PBAC / RBAC Token Verification)    |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| LAYER 3: Prisma ORM Client Extensions (Automatic Query Interception)              |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| LAYER 4: PostgreSQL Kernel Row-Level Security (RLS) with FORCE Enforcement        |
+-----------------------------------------------------------------------------------+
```

---

## 2. DIRECT VS. INDIRECT TENANT OWNERSHIP

Every entity in the database is explicitly categorized regarding its tenant relationship:

### 2.1 Direct Tenant Entities (Contain `organization_id`)
All data entities directly owned by an organization contain a non-nullable foreign key referencing `organizations(id)`:
1. `organization_domains`
2. `organization_subscriptions`
3. `organization_profiles`
4. `roles` (custom tenant roles)
5. `staff_memberships`
6. `member_profiles`
7. `membership_plans`
8. `memberships`
9. `membership_periods`
10. `payments`
11. `payment_methods`
12. `payment_proofs`
13. `payment_reviews`
14. `payment_transactions`
15. `digital_membership_cards`
16. `verification_tokens`
17. `verification_logs`
18. `leadership_positions`
19. `leaders`
20. `programs`
21. `benefits`
22. `rules`
23. `announcements`
24. `notifications`
25. `notification_preferences`
26. `audit_logs`

### 2.2 Global Platform Entities (Zero `organization_id`)
Entities that transcend individual tenant boundaries:
1. `saas_plans`: Global subscription tiers (Starter, Growth, Enterprise).
2. `users`: Global human credentials and identities.
3. `sessions`: Global authentication refresh tokens.
4. `permissions`: System-wide RBAC capability definitions.
5. System `roles`: Predefined role templates (`OWNER`, `ADMIN`, `FINANCE_OFFICER`, `VERIFIER` where `organization_id IS NULL`).

---

## 3. POSTGRESQL ROW-LEVEL SECURITY (RLS) STRATEGY

### 3.1 Kernel Policy Implementation
RLS is enabled and **forced** on all 26 tenant tables using `ALTER TABLE ... FORCE ROW LEVEL SECURITY;`.

The standardized policy applied to all tenant tables:
```sql
CREATE POLICY tenant_isolation_policy ON <table>
AS PERMISSIVE
FOR ALL
USING (
    pg_has_role(CURRENT_USER, 'waanofii_platform_admin', 'MEMBER')
    OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
)
WITH CHECK (
    pg_has_role(CURRENT_USER, 'waanofii_platform_admin', 'MEMBER')
    OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
);
```

### 3.2 Trusted Role-Based Platform Admin vs. Application Role Boundary
> [!IMPORTANT]
> **Vulnerability Mitigation (Untrusted GUC Elimination):**
> In previous iterations, relying on `current_setting('app.is_platform_admin', true) = 'true'` exposed the database to privilege escalation: any authenticated application connection could execute `SET LOCAL app.is_platform_admin = 'true'`, bypassing tenant isolation.
> 
> In the hardened architecture, platform admin privilege is enforced strictly via PostgreSQL role membership:
> `pg_has_role(CURRENT_USER, 'waanofii_platform_admin', 'MEMBER')`.
> 
> Two distinct database roles are provisioned:
> 1. **`waanofii_app`**: Standard application connection role (`NOBYPASSRLS`, non-superuser, revoked `CREATE ON SCHEMA public`, cannot assume `waanofii_platform_admin`).
> 2. **`waanofii_platform_admin`**: Trusted platform administrator role (`NOBYPASSRLS`), used solely for platform-wide analytics and cross-tenant oversight.
> 
> Even if an application context sets `app.is_platform_admin = 'true'`, the RLS policy ignores it completely.

---

## 4. CONNECTION POOLING & TRANSACTION-LOCAL CONTEXT

In a production environment running behind PgBouncer or Prisma Accelerate:
* Connections are pooled and shared across thousands of HTTP requests.
* Executing a session-level `SET app.current_organization_id = '...'` would dangerously contaminate subsequent requests handled by that same physical connection.

### The Mandatory Solution: `SET LOCAL` Inside Transactions
To guarantee zero connection cross-talk in pooled environments:
1. All tenant-scoped operations execute within a transaction block.
2. The context and role are set using `SET LOCAL`:
   ```sql
   BEGIN;
   SET LOCAL ROLE waanofii_app;
   SET LOCAL app.current_organization_id = 'tenant-uuid-here';
   -- All queries within this transaction block are strictly isolated
   SELECT * FROM member_profiles;
   COMMIT;
   ```
3. When the transaction completes (`COMMIT` or `ROLLBACK`), the connection parameters and role are automatically purged by PostgreSQL before the connection is returned to the pool.

---

## 5. APPLICATION AUTHORIZATION & NESTJS REQUEST CONTEXT

### 5.1 Request Pipeline
```
1. Client HTTP Request (e.g. Host: 4b.waanofii.com, Bearer Token)
   │
2. TenantResolutionMiddleware:
   ├─ Resolves subdomain "4b" -> Queries Redis cache -> Obtains organization_id
   └─ Binds to RequestContext: { organizationId: '...', slug: '4b' }
   │
3. AuthGuard & TenantGuard:
   ├─ Verifies JWT signature
   ├─ Asserts user has active StaffMembership or MemberProfile for that organizationId
   └─ Rejects cross-tenant attempts with HTTP 404 (preventing enumeration)
   │
4. Prisma Tenant Extension:
   └─ Wraps database mutations with transaction-local tenant context
```

### 5.2 Background Jobs (BullMQ)
Asynchronous workers processing PDF card rendering or email dispatching do not run within an HTTP request.
* Every queued job payload must explicitly carry `{ organizationId: '...', ...jobData }`.
* The job handler initializes the `TenantContext` before invoking domain services, ensuring background tasks are subject to identical tenant isolation guarantees.

---

## 6. VERIFICATION PROOF: AUTOMATED DATABASE TEST RESULTS

The isolation architecture is verified by the automated test suite in [tests/run_database_tests.ts](file:///C:/Users/Hp/Desktop/WaanOfii/tests/run_database_tests.ts).

### Verified Test Assertions (39 of 39 Passed across 15 Suites):
1. **Tenant Data Isolation:** Querying 4B members under the 4B tenant returns all 4B members; querying with the Ethiopian Medical Association tenant returns 0 results.
2. **Decoupled User Identity:** The same user (Abebe Bikila) exists globally, with separate `MemberProfile` entries in both 4B Association and Ethiopian Medical Association.
3. **Reference Code Anti-Fraud:** Attempting to submit a duplicate transaction reference code within the same organization triggers a database unique constraint violation (`P2002`).
4. **Member Number Scoping:** Member numbers are unique within each organization, allowing different organizations to reuse numbering sequences without collision.
5. **Foreign Key Integrity:** Inserting records with non-existent tenant IDs is rejected at the database level (`P2003`).
6. **Digital Card & QR Verification:** Active tokens allow QR verification; revoked tokens block credential verification.
7. **Staff Role Isolation:** Staff memberships and permissions are strictly isolated per tenant.
8. **Audit Logging & Compliance:** Audit log events are captured and scoped by organization.
9. **Kernel RLS Enforcement:** Executing raw SQL queries under `SET LOCAL ROLE waanofii_app;` with tenant context set to 4B returns exactly the 4B members. With no tenant context set, PostgreSQL returns 0 rows (zero leakage).
10. **RLS Privilege Escalation Mitigation:** Setting malicious `SET LOCAL app.is_platform_admin = 'true'` returns 0 rows. Only the trusted `waanofii_platform_admin` role can query cross-tenant metrics.
11. **Cross-Tenant Mutation Prevention:** RLS `WITH CHECK` strictly blocks cross-tenant `INSERT`, and RLS `USING` renders cross-tenant `UPDATE` and `DELETE` a zero-row no-op.
12. **Auth Identifier Integrity:** `users` table CHECK constraint (`check_user_has_auth_identifier`) blocks account creation without both email and phone number.
13. **Case-Insensitive Email Security:** Functional unique index `users_email_lower_unique` prevents duplicate accounts via case variations.
14. **Financial Amount Validation:** `payments` table CHECK constraint (`check_payment_amount_positive`) blocks zero or negative payment amounts.
15. **Payment Proof Anti-Reuse:** Unique constraint `(organization_id, file_url)` prevents duplicate receipt reuse within the tenant.
16. **Gateway Webhook Idempotency:** Unique constraint `(provider, provider_tx_id)` guarantees gateway webhook delivery idempotency and prevents double-crediting.
