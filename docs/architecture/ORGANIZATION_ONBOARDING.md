# WAANOFII ORGANIZATION ONBOARDING SPECIFICATION
## Phase 4: Tenant Creation, Reserved Slugs, Domain Routing & Security Boundaries

---

## 1. ONBOARDING OVERVIEW & ACCESS BOUNDARY

Onboarding a new tenant onto WaanOfii establishes a dedicated, isolated data boundary within the shared PostgreSQL architecture.

### Access Control Rules:
- **Authorization:** Only verified platform administrators (`isPlatformAdmin === true`) can invoke the onboarding endpoint (`POST /api/v1/organizations`).
- **Standard Users:** Regular authenticated members or staff attempting to onboard an organization receive **HTTP 403 Forbidden**.
- **Anonymous Visitors:** Unauthenticated requests receive **HTTP 401 Unauthorized**.

---

## 2. RESERVED SLUG POLICY & CANONICAL SET

To prevent route hijacking, path traversal, or collision with platform-level resources, organization slugs are strictly checked against `RESERVED_ORGANIZATION_SLUGS`:

```typescript
export const RESERVED_ORGANIZATION_SLUGS = new Set([
  'api', 'admin', 'app', 'login', 'register', 'pricing', 'features',
  'about', 'settings', 'support', 'docs', 'www', 'health', 'auth',
  'me', 'members', 'organizations', 'memberships', 'org', 'dashboard',
  'profile', 'portal', 'system', 'platform', 'billing', 'terms',
  'privacy', 'help', 'status', 'static', 'assets', 'public'
]);
```

### Slug Format Invariants:
1. **Character Set:** Strictly lowercase alphanumeric characters with single hyphens (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
2. **Length Constraints:** Minimum 2 characters, maximum 50 characters.
3. **No Trailing or Leading Hyphens:** Hyphens must be flanked by alphanumeric characters.
4. **Global Uniqueness:** Checked against the `organizations` database table. Duplicate attempts return **HTTP 409 Conflict**.

---

## 3. ONBOARDING TRANSACTION & PROFILE INITIALIZATION

When an organization is created:
1. The `Organization` record is inserted with status `ACTIVE`, specified contact details, default language, timezone, and currency.
2. An associated `OrganizationProfile` is initialized with the organization's initial mission, vision, and purpose statements.
3. An immutable entry is written to `AuditLog`:
   - `action`: `ORGANIZATION_CREATE`
   - `entityType`: `Organization`
   - `entityId`: `<org.id>`
   - `afterDiff`: `{ name, slug, contactEmail }` (sanitized with redacted secrets)

---

## 4. MULTI-TENANT DISCOVERY & DOMAIN ROUTING

Once created, an organization can be resolved via four discovery vectors supported by `TenantResolutionService`:

1. **Path-Based Routing:**
   - Public URLs: `https://waanofii.com/org/:slug`
   - API endpoints: `/api/v1/organizations/:slug/...`
2. **Subdomain Routing:**
   - `https://:slug.waanofii.com` automatically resolves to the matching tenant.
3. **Custom Domain Routing:**
   - Any verified domain in `organization_domains` (e.g. `members.ethio-med.org`) resolves to the organization.
4. **API / Mobile Request Headers:**
   - `x-tenant-id` or `x-organization-id` (UUID format)
   - `x-tenant-slug` or `x-organization-slug`
