# WAANOFII TENANT CONTEXT & RESOLUTION SPECIFICATION
## Phase 3: Request-Scoped Isolation, Resolution Vectors & RLS Integration

---

## 1. MULTI-TENANCY PHILOSOPHY

WaanOfii is an independent, commercial multi-tenant SaaS platform. 
* Organizations such as **4B Association** or the **Ethiopian Medical Association** exist strictly as tenant database rows.
* No tenant identifier, slug, domain, or branding is ever hard-coded in backend application code.
* The system accommodates hundreds of isolated organizations sharing the same database infrastructure while guaranteeing mathematical data isolation.

---

## 2. TENANT RESOLUTION VECTORS

The `TenantResolutionService` resolves an organization through four priority vectors:

### Vector 1: Subdomain Routing (Primary)
* Request Host: `4b.waanofii.com` or `4b.waanofii.local`
* Algorithm: Strips base domain suffix -> matches subdomain part against `organizations.slug`.

### Vector 2: Custom Verified Domains (Enterprise)
* Request Host: `members.4bassociation.org`
* Algorithm: Queries `organization_domains` table where `domain = cleanHost AND is_verified = true` -> returns parent organization.

### Vector 3: Explicit API / Mobile Headers (Testing & Integrations)
* Headers: `x-tenant-slug: 4b` or `x-tenant-id: <uuid>`
* Algorithm: Direct database lookup by slug or UUID.

### Vector 4: URL Path Fallback (Public Portals)
* URL Path: `/api/v1/organizations/:identifier/...`
* Algorithm: Regex match extracts `:identifier` (slug or UUID) -> resolves organization.

---

## 3. REQUEST-SCOPED CONTEXT VIA ASYNCLOCALSTORAGE

To avoid the performance degradation of request-scoped NestJS dependency injection providers while preventing mutable singleton state, WaanOfii utilizes Node.js **`AsyncLocalStorage`**:

```typescript
export interface TenantContext {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  userRole?: string;
  permissions?: string[];
  isPlatformAdmin?: boolean;
}
```

* Initialized by `TenantResolutionMiddleware` upon discovering an organization.
* Accessible anywhere downstream in the asynchronous execution tree via `TenantContextService.getContext()`.
* Automatically garbage collected when the HTTP request completes.

---

## 4. TENANT ACCESS CONTROL & AFFILIATION GUARD (TENANTGUARD)

A core security mandate is that **a user cannot access an organization simply by spoofing or supplying an `organization_id`**.

`TenantGuard` intercepts all tenant-scoped routes and performs 4 mandatory verifications:
1. **Tenant Resolution Assert:** Asserts that `req.tenant.organizationId` exists; rejects with `404 Not Found` if the tenant is unknown.
2. **Platform Super Admin Check:** If `user.isPlatformAdmin === true`, grants access for cross-tenant maintenance.
3. **Staff Membership Affiliation:** Queries `staff_memberships` table for `(organization_id, user_id, is_active: true)`. If present, populates staff role and RBAC permissions in `TenantContext`.
4. **Member Profile Affiliation:** Queries `member_profiles` table for `(organization_id, user_id, deleted_at: null)`. If present, grants active member status.
5. **Fail-Closed Rejection:** If the authenticated user belongs to Organization A, but requests Organization B, `TenantGuard` throws `ForbiddenException('You do not have permission to access this organization')`.

---

## 5. POSTGRESQL RLS TRANSACTION EXECUTION

At the database layer, all tenant queries execute within a PostgreSQL transaction managed by `PrismaService.withTenantContext`:

```typescript
await prisma.withTenantContext(organizationId, async (tx) => {
  return tx.memberProfile.findMany({ where: { organizationId } });
});
```

### Transaction Steps:
```sql
BEGIN;
-- 1. Switch to dedicated non-superuser role (NOBYPASSRLS)
SET LOCAL ROLE waanofii_app;

-- 2. Set transaction-local organization boundary
SET LOCAL app.current_organization_id = '<tenant-uuid>';

-- 3. Execute domain queries (evaluated by PostgreSQL RLS kernel)
SELECT * FROM member_profiles WHERE organization_id = '<tenant-uuid>';

-- 4. Commit transaction (PostgreSQL purges all transaction settings)
COMMIT;
```

### Connection Pool Safety
Because `SET LOCAL` is bound strictly to the active transaction block, when the connection is checked back into the pool (e.g. via PgBouncer or Prisma), PostgreSQL automatically clears the role and GUC setting. **Zero connection bleed is possible between pooled requests.**

---

## 6. FINAL SECURITY ATTACK PROOF (SECTION 37 VERIFICATION)

The automated test suite in `tests/run_backend_tests.ts` explicitly verified the Section 37 attack scenario:

* **Attacker:** `kebede.admin@4bassociation.org` (Active Admin in 4B Association)
* **Target:** Ethiopian Medical Association (`ethio-med`)
* **Attack Parameters:**
  * Attacker supplies valid JWT Bearer authentication.
  * Attacker explicitly targets `/api/v1/organizations/ethio-med/members`.
  * Attacker explicitly injects `x-tenant-id: <ethio-med-uuid>` header.
* **Test Outcome:**
  * `TenantGuard` caught the cross-tenant mismatch.
  * Returned **`HTTP 403 Forbidden`** (`You do not have permission to access this organization`).
  * No queries reached the target tenant's data.
  * **Status: VERIFIED PASS.**
