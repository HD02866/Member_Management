# WAANOFII AUTHORIZATION & RBAC SPECIFICATION
## Phase 3: Role-Based & Permission-Based Access Control

---

## 1. AUTHORIZATION PRINCIPLES

WaanOfii implements **Role-Based (RBAC)** and **Permission-Based (PBAC)** Access Control designed for multi-tenant organizations:
1. **Tenant-Scoped Authorization:** Roles and permissions are evaluated strictly within the context of the resolved tenant. An Organization Owner in Organization A has zero administrative privilege in Organization B.
2. **Decoupled User Identity:** A user may possess different roles in different organizations (e.g. Staff Admin in 4B Association, and regular Member in the Ethiopian Medical Association).
3. **Platform Administrator Separation:** Platform Super Administrators (`users.is_platform_admin = true`) are strictly separated from tenant administrators. Organization owners cannot administer the platform, and normal tenant requests cannot assume platform-level roles.

---

## 2. PREDEFINED SYSTEM ROLES

Predefined system roles are modeled in the `roles` table with `is_system = true` and `organization_id IS NULL`:

| Role Code | Role Name | Description | Key Permissions |
| :--- | :--- | :--- | :--- |
| `OWNER` | Organization Owner | Full operational and governance ownership over the tenant organization. | All tenant permissions (`*`) |
| `ADMIN` | Organization Admin | Operational manager responsible for membership approvals, roster management, and content. | `members.*`, `cards.*`, `content.*`, `staff.*` |
| `FINANCE_OFFICER` | Finance Officer | Reviews member payment receipts, approves bank transfers, and reconciles transactions. | `payments.read`, `payments.approve`, `audit.view` |
| `VERIFIER` | Verifier / Gatekeeper | Event or office security scanning member digital ID cards and QR codes. | `cards.verify` |
| `MEMBER` | Member | Registered individual enrolled in an organization plan. | `members.self_read` |

---

## 3. PERMISSION TAXONOMY & ALIASES

Permissions are modeled in the `permissions` table using domain-scoped codes. Controllers support both canonical codes and convenient aliases:

| Canonical Permission Code | Alias | Description |
| :--- | :--- | :--- |
| `tenant:members:read` | `members.read` | View the organization's member roster. |
| `tenant:members:approve` | `members.approve` | Approve or reject pending membership applications. |
| `tenant:members:suspend` | `members.suspend` | Suspend or archive member accounts. |
| `tenant:payments:read` | `payments.read` | View ledger payments, receipts, and proofs. |
| `tenant:payments:approve` | `payments.review`, `payments.approve` | Verify bank transfer slips or record manual payments. |
| `tenant:cards:issue` | `digital_ids.manage` | Generate or re-issue digital membership cards. |
| `tenant:cards:revoke` | `digital_ids.manage` | Revoke digital cards upon suspension or termination. |
| `tenant:cards:verify` | `digital_ids.read` | Scan and cryptographically verify member QR tokens. |
| `tenant:content:manage` | `content.manage` | Author programs, bylaws, rules, and announcements. |
| `tenant:staff:manage` | `staff.manage` | Invite, assign, or revoke staff roles within the tenant. |
| `tenant:settings:manage` | `organization.manage` | Configure organization branding, banking, and plans. |
| `tenant:audit:view` | `audit.read`, `reports.read` | Inspect immutable organization audit logs. |

---

## 4. GUARDS & DECORATORS

Authorization is declared cleanly at the controller method level without manual token decoding:

### 4.1 Decorators
* `@RequirePermissions('members.read')`: Attaches required permission metadata to the endpoint.
* `@RequireRoles('OWNER', 'ADMIN')`: Restricts access to specific tenant roles.
* `@CurrentUser()`: Extracts the authenticated user identity (`AuthenticatedUser`).
* `@CurrentTenant()`: Extracts the active tenant context (`TenantContext`).

### 4.2 Guard Pipeline
```typescript
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@RequirePermissions('members.read')
@Get(':identifier/members')
async getMembers(@CurrentTenant() tenant: TenantContext) {
  return this.organizationsService.getMembersRoster(tenant.organizationId);
}
```

1. **`JwtAuthGuard`:** Confirms the request is authenticated with a valid JWT.
2. **`TenantGuard`:** Verifies the user has active staff membership or member standing in the resolved tenant, populating `req.tenantPermissions` and `req.tenantUserRole`.
3. **`PermissionsGuard`:** Verifies that `req.tenantPermissions` contains the required permission codes.

---

## 5. MULTI-ORGANIZATION AFFILIATION VERIFICATION

To verify that one user belonging to Organization A does not receive permissions in Organization B:
* **Test Case:** User `Abebe Bikila` belongs to both **4B Association** and **Ethiopian Medical Association**.
* Calling `/api/v1/auth/me` returns independent membership entries for both organizations.
* When Abebe operates in 4B Association, his permissions are evaluated solely against his 4B profile.
* When Abebe operates in Ethiopian Medical Association, his permissions are evaluated solely against his Ethio-Med profile.
