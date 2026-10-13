# WaanOfii — Backend API Contract (Phase 4 Specification)

This document specifies the complete REST API contract for the WaanOfii Multi-Tenant Membership SaaS Platform as of Phase 4.

Base URL: `/api/v1`  
Protocol: `HTTPS` (Production) / `HTTP` (Development)  
Data Format: `application/json`

---

## 1. Global Conventions & Architecture

### 1.1 Standard Request Headers
| Header | Type | Description | Required |
|---|---|---|---|
| `Content-Type` | `string` | Must be `application/json` for requests with bodies | Conditional |
| `Authorization` | `string` | `Bearer <JWT_ACCESS_TOKEN>` for authenticated endpoints | Conditional |
| `x-tenant-id` | `UUIDv4` | Explicit tenant organization UUID | Optional (see Tenant Resolution) |
| `x-tenant-slug` | `string` | Organization slug (e.g. `4b-association`) | Optional (see Tenant Resolution) |
| `x-correlation-id`| `string` | Distributed tracing / request correlation UUID | Optional (auto-generated if omitted) |

### 1.2 Tenant Resolution Order
Tenant context is evaluated by `TenantResolutionService` in the following precedence:
1. Header `x-tenant-id` or `x-organization-id`
2. Header `x-tenant-slug` or `x-organization-slug`
3. Subdomain extraction (e.g., `slug.domain.com` when not reserved)
4. Route parameter `:organizationId`, `:tenantId`, or `:slug`

When an endpoint requires tenant context (`@UseGuards(TenantGuard)`):
- If the tenant cannot be resolved, the API returns `400 Bad Request` (`Tenant context is required for this operation`).
- If the tenant does not exist or is inactive, the API returns `404 Not Found` (`Organization not found or inactive`).
- If the authenticated user is not an active member or staff in the tenant, the API returns `403 Forbidden` (`User does not belong to the target organization`), unless marked with `@AllowProspectiveMember()`.

### 1.3 Standard Response Format
All successful responses are standardized via `TransformInterceptor`:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-10-01T02:00:00.000Z"
}
```

### 1.4 Standard Error Response Format
All exceptions are captured and formatted via `HttpExceptionFilter`:
```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "timestamp": "2026-10-01T02:00:00.000Z",
  "path": "/api/v1/auth/register",
  "correlationId": "4a7f0525-4c07-4228-a400-36a87754eb27"
}
```

---

## 2. Health & Monitoring

### `GET /api/v1/health`
Checks backend and database operational readiness.

- **Auth**: Public
- **Tenant Context**: Not required
- **Success Response (`200 OK`)**:
```json
{
  "status": "healthy",
  "timestamp": "2026-10-01T02:00:00.000Z",
  "uptimeSeconds": 12450,
  "checks": {
    "database": {
      "status": "UP",
      "latencyMs": 2
    },
    "memory": {
      "heapUsedMb": 54,
      "rssMb": 98
    }
  }
}
```
- **Error Response (`503 Service Unavailable`)**:
  Returned if PostgreSQL fails the ping check.

---

## 3. Authentication & Sessions (`/api/v1/auth`)

### `POST /api/v1/auth/register`
Creates a new global user account. Does not bind the user to an organization automatically (affiliation occurs during onboarding or membership application).

- **Auth**: Public
- **Rate Limit**: 10 requests / 60 seconds
- **Request Body**:
```json
{
  "email": "user@example.com",
  "phoneNumber": "+251911000000",
  "firstName": "Abebe",
  "lastName": "Kebede",
  "password": "Password123!"
}
```
*Note: `email` and `phoneNumber` are individually optional, but at least one must be provided.*
*Password requires minimum 8 characters, at least one uppercase letter, one lowercase letter, and one number or symbol.*

- **Success Response (`201 Created`)**:
  Sets HTTP-only `access_token` cookie and returns:
```json
{
  "user": {
    "id": "11111111-1111-1111-1111-111111111111",
    "email": "user@example.com",
    "phoneNumber": "+251911000000",
    "firstName": "Abebe",
    "lastName": "Kebede",
    "isPlatformAdmin": false,
    "status": "ACTIVE"
  },
  "tokens": {
    "accessToken": "eyJhbGciOi...",
    "tokenType": "Bearer",
    "expiresIn": "15m"
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Validation failure or neither email nor phone provided.
  - `409 Conflict`: User with email or phone already exists.

---

### `POST /api/v1/auth/login`
Authenticates a user using email/phone and password, establishing a database-backed session.

- **Auth**: Public
- **Rate Limit**: 10 requests / 60 seconds
- **Request Body**:
```json
{
  "identifier": "user@example.com",
  "password": "Password123!"
}
```
- **Success Response (`200 OK`)**:
  Sets HTTP-only `access_token` cookie and returns:
```json
{
  "user": {
    "id": "11111111-1111-1111-1111-111111111111",
    "email": "user@example.com",
    "firstName": "Abebe",
    "lastName": "Kebede",
    "isPlatformAdmin": false,
    "status": "ACTIVE"
  },
  "tokens": {
    "accessToken": "eyJhbGciOi...",
    "tokenType": "Bearer",
    "expiresIn": "15m"
  }
}
```
- **Error Responses**:
  - `401 Unauthorized`: Invalid credentials or inactive user account.

---

### `POST /api/v1/auth/logout`
Revokes the current database-backed session and clears the auth cookie.

- **Auth**: `JwtAuthGuard`
- **Success Response (`200 OK`)**:
  Clears `access_token` cookie and returns:
```json
{
  "message": "Logged out successfully"
}
```

---

### `GET /api/v1/auth/me`
Retrieves authenticated user profile with affiliations.

- **Auth**: `JwtAuthGuard`
- **Success Response (`200 OK`)**:
```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "email": "user@example.com",
  "firstName": "Abebe",
  "lastName": "Kebede",
  "isPlatformAdmin": false,
  "status": "ACTIVE",
  "memberProfiles": [],
  "staffMemberships": []
}
```

---

## 4. Current User & Affiliations (`/api/v1/me`)

### `GET /api/v1/me`
Retrieves the user's global profile and multi-tenant affiliations.

- **Auth**: `JwtAuthGuard`
- **Success Response (`200 OK`)**:
```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "email": "user@example.com",
  "firstName": "Abebe",
  "lastName": "Kebede",
  "isPlatformAdmin": false,
  "status": "ACTIVE",
  "memberProfiles": [
    {
      "id": "profile-uuid",
      "organizationId": "org-uuid",
      "organizationName": "4B Association",
      "organizationSlug": "4b-association",
      "memberNumber": "MEM-2026-0001",
      "status": "ACTIVE"
    }
  ],
  "staffMemberships": []
}
```

---

### `GET /api/v1/me/organizations`
Returns a flattened list of all organizations the authenticated user is affiliated with as a member or staff member. Powers the Organization Switcher.

- **Auth**: `JwtAuthGuard`
- **Success Response (`200 OK`)**:
```json
[
  {
    "id": "22222222-2222-2222-2222-222222222222",
    "name": "4B Association",
    "slug": "4b-association",
    "isMember": true,
    "memberStatus": "ACTIVE",
    "memberNumber": "4B-0001",
    "isStaff": true,
    "staffRole": "Tenant Admin",
    "permissions": ["members.read", "members.write", "reports.view"]
  }
]
```

---

## 5. Organizations (`/api/v1/organizations`)

### `GET /api/v1/organizations`
Retrieves the public directory of all active organizations on the platform.

- **Auth**: Public
- **Tenant Context**: Not required
- **Success Response (`200 OK`)**:
```json
[
  {
    "id": "22222222-2222-2222-2222-222222222222",
    "name": "4B Association",
    "slug": "4b-association",
    "logoUrl": null,
    "contactEmail": "contact@4b.org",
    "contactPhone": "+251911000000",
    "address": "Addis Ababa, Ethiopia",
    "defaultLanguage": "en",
    "timezone": "Africa/Addis_Ababa",
    "currency": "ETB",
    "profile": {
      "mission": "Empowering youth and community",
      "vision": "A thriving connected community",
      "purpose": "Mutual support and empowerment"
    }
  }
]
```

---

### `GET /api/v1/organizations/:identifier`
Retrieves an organization's public details, CMS content (programs, benefits, leaders, rules, announcements), and active membership plans.

- **Auth**: Public
- **Parameters**: `identifier` (Organization UUID or slug)
- **Success Response (`200 OK`)**:
```json
{
  "id": "22222222-2222-2222-2222-222222222222",
  "name": "4B Association",
  "slug": "4b-association",
  "logoUrl": null,
  "contactEmail": "contact@4b.org",
  "contactPhone": "+251911000000",
  "address": "Addis Ababa, Ethiopia",
  "defaultLanguage": "en",
  "currency": "ETB",
  "profile": {
    "mission": "Empowering youth and community",
    "vision": "A thriving connected community",
    "purpose": "Mutual support and empowerment",
    "history": "Established in 2020",
    "contactDetails": "info@4b.org"
  },
  "programs": [],
  "benefits": [],
  "leaders": [],
  "rules": [],
  "announcements": [],
  "membershipPlans": [
    {
      "id": "33333333-3333-3333-3333-333333333333",
      "name": "Standard Annual Membership",
      "code": "ANNUAL_STD",
      "description": "Standard annual membership plan",
      "membershipType": "INDIVIDUAL",
      "durationMonths": 12,
      "feeAmount": 1200,
      "currency": "ETB",
      "isActive": true
    }
  ]
}
```
- **Error Responses**:
  - `404 Not Found`: Organization does not exist or is inactive.

---

### `POST /api/v1/organizations`
Onboards a new organization on the SaaS platform. Creates the tenant record, public profile, default Tenant Admin role with all permissions, and assigns the creator as initial Tenant Admin.

- **Auth**: `JwtAuthGuard` (Restricted: requires `isPlatformAdmin === true`)
- **Request Body**:
```json
{
  "name": "Oromia Youth Association",
  "slug": "oya-youth",
  "contactEmail": "admin@oya.org",
  "contactPhone": "+251911223344",
  "address": "Bole, Addis Ababa",
  "defaultLanguage": "en",
  "timezone": "Africa/Addis_Ababa",
  "currency": "ETB",
  "profile": {
    "mission": "Youth development and leadership",
    "vision": "Empowered community leaders",
    "purpose": "Leadership training and mentorship"
  }
}
```
- **Slug Validation**:
  - Minimum 2, maximum 50 characters.
  - Lowercase alphanumeric with single hyphens (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
  - Reserved slugs cannot be used (`admin`, `api`, `app`, `login`, `register`, `dashboard`, `settings`, `billing`, `support`, etc.).
- **Success Response (`201 Created`)**:
```json
{
  "organization": {
    "id": "new-org-uuid",
    "name": "Oromia Youth Association",
    "slug": "oya-youth",
    "contactEmail": "admin@oya.org",
    "status": "ACTIVE"
  },
  "initialStaffRole": {
    "id": "role-uuid",
    "name": "Tenant Administrator"
  },
  "staffAssignment": {
    "id": "assignment-uuid",
    "userId": "platform-admin-uuid",
    "status": "ACTIVE"
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Validation failure or reserved slug supplied.
  - `403 Forbidden`: Authenticated user is not a platform administrator.
  - `409 Conflict`: Organization slug already taken.

---

### `GET /api/v1/organizations/:identifier/members`
Retrieves member roster for the tenant. Protected by PostgreSQL Row-Level Security.

- **Auth**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`
- **Required Permission**: `members.read`
- **Tenant Context**: Resolved from `:identifier` or header
- **Success Response (`200 OK`)**: List of members in the organization.
- **Error Responses**:
  - `403 Forbidden`: User lacks `members.read` permission or does not belong to the organization.

---

## 6. Member Profile (`/api/v1/members`)

### `GET /api/v1/members/me`
Retrieves the authenticated user's member profile in the active tenant.

- **Auth**: `JwtAuthGuard`, `TenantGuard`
- **Tenant Context**: Required (`x-tenant-id` or `x-tenant-slug`)
- **Database Security**: Scoped via PostgreSQL RLS `withTenantContext`.
- **Success Response (`200 OK`)**:
```json
{
  "id": "profile-uuid",
  "organizationId": "tenant-uuid",
  "userId": "user-uuid",
  "memberNumber": "MEM-2026-0001",
  "firstName": "Abebe",
  "lastName": "Kebede",
  "email": "user@example.com",
  "phoneNumber": "+251911000000",
  "gender": "MALE",
  "dateOfBirth": "1995-05-15T00:00:00.000Z",
  "nationalIdNumber": "ID-99281",
  "address": "Bole Subcity",
  "city": "Addis Ababa",
  "photoUrl": null,
  "status": "ACTIVE",
  "joinedAt": "2026-01-15T10:00:00.000Z",
  "customFieldsData": {}
}
```
- **Error Responses**:
  - `400 Bad Request`: Tenant context missing.
  - `403 Forbidden`: User does not belong to target organization.
  - `404 Not Found`: Member profile does not exist in target organization.

---

### `PATCH /api/v1/members/me`
Updates permitted profile fields for the member in the active tenant. Server-controlled fields (`organizationId`, `memberNumber`, `status`) cannot be modified through this endpoint.

- **Auth**: `JwtAuthGuard`, `TenantGuard`
- **Tenant Context**: Required (`x-tenant-id` or `x-tenant-slug`)
- **Database Security**: Scoped via PostgreSQL RLS `withTenantContext`. Writes audit log.
- **Request Body**:
```json
{
  "firstName": "Abebe",
  "lastName": "Kebede",
  "email": "updated@example.com",
  "phoneNumber": "+251911999999",
  "gender": "MALE",
  "dateOfBirth": "1995-05-15",
  "nationalIdNumber": "ETH-100293",
  "address": "Kirkos Subcity",
  "city": "Addis Ababa",
  "customFieldsData": {
    "profession": "Software Engineer"
  }
}
```
- **Success Response (`200 OK`)**: Returns updated member profile.
- **Error Responses**:
  - `400 Bad Request`: Validation failure or attempting to submit forbidden fields.
  - `403 Forbidden`: User does not belong to target organization.

---

## 7. Memberships & Applications (`/api/v1/memberships`)

### `GET /api/v1/memberships/plans`
Discovers active membership plans for the target organization.

- **Auth**: Public
- **Tenant Context**: Required (`x-tenant-id` or `x-tenant-slug`)
- **Success Response (`200 OK`)**:
```json
[
  {
    "id": "33333333-3333-3333-3333-333333333333",
    "organizationId": "22222222-2222-2222-2222-222222222222",
    "name": "Standard Annual",
    "code": "ANNUAL_STD",
    "description": "Standard annual membership",
    "membershipType": "INDIVIDUAL",
    "durationMonths": 12,
    "feeAmount": 1200,
    "currency": "ETB",
    "isActive": true
  }
]
```

---

### `POST /api/v1/memberships/apply`
Applies to join an organization under a specific membership plan. Prospective members (authenticated users who do not yet belong to the organization) are permitted to call this endpoint via `@AllowProspectiveMember()`.

Creates or resolves the `MemberProfile` in `REGISTERED` status and creates the `Membership` in `REGISTERED` status.

> [!NOTE]
> In Phase 4, membership applications create a `REGISTERED` record with `nextStep: "COMPLETE_PAYMENT"`. No active membership is granted until payment is completed and verified in Phase 5.

- **Auth**: `JwtAuthGuard`, `TenantGuard`, `@AllowProspectiveMember()`
- **Tenant Context**: Required (`x-tenant-id` or `x-tenant-slug`)
- **Request Body**:
```json
{
  "planId": "33333333-3333-3333-3333-333333333333"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "membership": {
    "id": "membership-uuid",
    "organizationId": "22222222-2222-2222-2222-222222222222",
    "memberProfileId": "profile-uuid",
    "planId": "33333333-3333-3333-3333-333333333333",
    "status": "REGISTERED",
    "startDate": "2026-10-01T02:00:00.000Z",
    "endDate": "2027-10-01T02:00:00.000Z"
  },
  "memberProfile": {
    "id": "profile-uuid",
    "memberNumber": "MEM-2026-0002",
    "status": "REGISTERED"
  },
  "plan": {
    "name": "Standard Annual",
    "feeAmount": 1200,
    "currency": "ETB"
  },
  "nextStep": "COMPLETE_PAYMENT"
}
```
- **Error Responses**:
  - `400 Bad Request`: Invalid plan UUID or user already has an active or pending membership in this tenant.
  - `404 Not Found`: Plan does not exist in target organization (prevents cross-tenant plan attacks).

---

### `GET /api/v1/memberships/me`
Retrieves the authenticated user's memberships in the active tenant.

- **Auth**: `JwtAuthGuard`, `TenantGuard`
- **Tenant Context**: Required (`x-tenant-id` or `x-tenant-slug`)
- **Success Response (`200 OK`)**:
```json
[
  {
    "id": "membership-uuid",
    "organizationId": "22222222-2222-2222-2222-222222222222",
    "status": "REGISTERED",
    "startDate": "2026-10-01T02:00:00.000Z",
    "endDate": "2027-10-01T02:00:00.000Z",
    "plan": {
      "name": "Standard Annual",
      "feeAmount": 1200,
      "currency": "ETB"
    }
  }
]
```
- **Error Responses**:
  - `400 Bad Request`: Tenant context missing.
  - `403 Forbidden`: User does not belong to target organization.

---

## 8. Payments API (`/api/v1/payments`)

### `GET /api/v1/payments/methods`
Retrieves active payment methods configured for the resolved tenant.

- **Auth**: `JwtAuthGuard`, `TenantGuard`
- **Tenant Context**: Required
- **Success Response (`200 OK`)**: Array of active payment method objects.

---

### `POST /api/v1/payments`
Initiates a payment order for membership dues. Authoritative pricing is computed server-side from the active plan.

- **Auth**: `JwtAuthGuard`, `TenantGuard`
- **Tenant Context**: Required
- **Headers**: `Idempotency-Key` (mandatory unique string)
- **Request Body**:
```json
{
  "membershipId": "membership-uuid",
  "paymentMethodId": "payment-method-uuid",
  "paymentType": "MEMBERSHIP_DUES"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "payment": {
    "id": "payment-uuid",
    "transactionReference": "4B-PAY-20261001-ABCD",
    "amount": "1200.00",
    "currency": "ETB",
    "status": "PENDING"
  },
  "membership": {
    "id": "membership-uuid",
    "status": "PAYMENT_PENDING"
  },
  "nextStep": "SUBMIT_PAYMENT_PROOF"
}
```

---

### `POST /api/v1/payments/:id/proof`
Submits manual payment proof (bank deposit slip) for a pending payment.

- **Auth**: `JwtAuthGuard`, `TenantGuard`
- **Tenant Context**: Required
- **Request Body**:
```json
{
  "fileUrl": "https://storage.organization.org/proofs/slip_001.jpg",
  "fileType": "image/jpeg",
  "fileSize": 250000,
  "transactionReference": "FT26090123",
  "notes": "Deposited at branch"
}
```
- **Success Response (`201 Created`)**: Updated payment with status `UNDER_REVIEW`.

---

### `GET /api/v1/payments/me`
Retrieves payment history for the authenticated member in the active tenant.

- **Auth**: `JwtAuthGuard`, `TenantGuard`
- **Tenant Context**: Required
- **Success Response (`200 OK`)**: Array of member payments with proofs and review history.

---

### `GET /api/v1/payments/review`
Retrieves payments pending finance review (`UNDER_REVIEW`).

- **Auth**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard` (`tenant:finance:manage` or `tenant:payments:review`)
- **Tenant Context**: Required
- **Success Response (`200 OK`)**: Array of payments awaiting review.

---

### `POST /api/v1/payments/:id/approve`
Approves payment and atomically activates membership and digital ID. Enforces Segregation of Duties.

- **Auth**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard` (`tenant:finance:manage` or `tenant:payments:review`)
- **Tenant Context**: Required
- **Request Body**: `{ "notes": "Verified against statement" }`
- **Success Response (`201 Created`)**:
```json
{
  "payment": { "status": "VERIFIED" },
  "membership": { "status": "ACTIVE" },
  "card": {
    "cardNumber": "4B-CARD-0001",
    "qrToken": "64_hex_character_token..."
  }
}
```
- **Error Responses**:
  - `403 Forbidden`: Reviewer is attempting to approve their own payment proof (Segregation of Duties).
  - `409 Conflict`: Payment is already verified.

---

### `POST /api/v1/payments/:id/reject`
Rejects payment proof with a mandatory reason.

- **Auth**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`
- **Tenant Context**: Required
- **Request Body**: `{ "rejectionReason": "Illegible receipt", "notes": "Reupload clearly" }`
- **Success Response (`201 Created`)**: Updated payment with status `REJECTED`.

---

## 9. Digital Membership Cards & Verification API

### `GET /api/v1/cards/me`
Retrieves the active digital membership card and current QR token for the member.

- **Auth**: `JwtAuthGuard`, `TenantGuard`
- **Tenant Context**: Required
- **Success Response (`200 OK`)**: Digital card details, version, expiration, and `qrToken`.

---

### `POST /api/v1/cards/rotate`
Rotates the cryptographic token for an active card and increments card version.

- **Auth**: `JwtAuthGuard`, `TenantGuard`
- **Tenant Context**: Required
- **Request Body**: `{ "reason": "Lost device" }`
- **Success Response (`201 Created`)**: Updated card with incremented `cardVersion` and fresh `qrToken`.

---

### `GET /api/v1/verify/:token`
Public cryptographic verification endpoint for digital membership cards.

- **Auth**: None (Public)
- **Tenant Context**: None (Resolved by token)
- **Success Response (`200 OK`)**:
```json
{
  "isValid": true,
  "result": "VALID",
  "message": "Membership credential is authentic and active.",
  "organization": { "name": "4B Association", "slug": "4b" },
  "member": {
    "displayName": "Abebe Bikila",
    "memberNumber": "4B-MEM-0001",
    "membershipPlan": "Annual Voting Member",
    "status": "ACTIVE"
  },
  "card": {
    "cardNumber": "4B-CARD-0001",
    "status": "ACTIVE",
    "cardVersion": 1,
    "expirationDate": "2027-10-01T00:00:00.000Z"
  }
}
```
- **Minimal Disclosure**: Strictly excludes email, phone number, national ID, and address.
- **Verification Outcomes**: `VALID`, `EXPIRED`, `REVOKED`, `INVALID`.

---

## 10. External Payment Operations, Webhooks & Reversals (Phase 6)

### `POST /api/v1/payments/webhooks/:provider`
Public webhook ingress receiving asynchronous notifications from external payment providers (`chapa`, `telebirr`, `cbe_birr`).

- **Auth**: None (Public; authenticated via cryptographic signature)
- **Signature Headers**: `x-chapa-signature`, `x-telebirr-signature`, or `x-cbe-signature`
- **Request Body**: Provider webhook payload
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "paymentId": "payment-uuid",
  "status": "VERIFIED",
  "isPaid": true
}
```
- **Replay Response (`200 OK`)**: `{ "success": true, "isReplay": true, "message": "Payment already verified and processed." }`
- **Error Responses**:
  - `401 Unauthorized`: Missing or invalid signature.
  - `400 Bad Request`: Amount or currency mismatch.

---

### `POST /api/v1/payments/:id/reconcile`
Reconciles an individual payment against the external provider records to detect and resolve discrepancies.

- **Auth**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`
- **Permissions**: `tenant:payments:approve`
- **Tenant Context**: Required
- **Success Response (`201 Created`)**:
```json
{
  "paymentId": "payment-uuid",
  "reference": "TX-12345678",
  "provider": "CHAPA",
  "localStatus": "VERIFIED",
  "providerStatus": "SUCCESS",
  "discrepancyType": "NONE",
  "actionTaken": "No change required; records are consistent.",
  "verifiedAt": "2026-10-01T15:20:00.000Z"
}
```

---

### `POST /api/v1/payments/reconcile/batch`
Scans and reconciles all pending/under-review payments within the active organization against external providers.

- **Auth**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`
- **Permissions**: `tenant:payments:approve`
- **Tenant Context**: Required
- **Success Response (`201 Created`)**:
```json
{
  "scanned": 5,
  "reconciled": 2,
  "results": []
}
```

---

### `POST /api/v1/payments/:id/reverse`
Reverses / refunds a previously verified payment. Atomically transitions the payment to `REFUNDED`, suspends the associated membership, and revokes digital cards and QR tokens.

- **Auth**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`
- **Permissions**: `tenant:payments:approve`
- **Tenant Context**: Required
- **Request Body**: `{ "reason": "Bank chargeback / fraudulent transaction" }`
- **Success Response (`201 Created`)**:
```json
{
  "message": "Payment reversed and refunded successfully.",
  "payment": {
    "id": "payment-uuid",
    "status": "REFUNDED",
    "rejectionReason": "Bank chargeback / fraudulent transaction"
  }
}
```

---

## 13. Phase 7 — Organization Operations, CMS, Notifications & SaaS Billing

### 13.1 Platform Admin Organization Operations (`/api/v1/admin/organizations`)

#### `GET /api/v1/admin/organizations`
Lists all organizations on the platform with counts of members and staff.
- **Auth**: `JwtAuthGuard`, `PlatformSuperAdminGuard`
- **Tenant Context**: Not required (cross-tenant)
- **Response (`200 OK`)**:
```json
{
  "organizations": [
    {
      "id": "org-uuid",
      "name": "Acme Organization",
      "slug": "acme-org",
      "status": "ACTIVE",
      "tier": "STANDARD",
      "createdAt": "2026-10-01T00:00:00.000Z",
      "_count": { "memberships": 150, "roles": 4 }
    }
  ]
}
```

#### `PATCH /api/v1/admin/organizations/:id/status`
Updates lifecycle status of an organization (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`).
- **Auth**: `JwtAuthGuard`, `PlatformSuperAdminGuard`
- **Request Body**: `{ "status": "SUSPENDED", "reason": "Non-payment of subscription" }`
- **Response (`200 OK`)**: Returns updated organization entity and writes to `audit_logs`.

---

### 13.2 Tenant Settings & CMS Management (`/api/v1/cms`)

#### `PATCH /api/v1/organizations/settings`
Updates organization contact and metadata settings.
- **Auth**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard` (`tenant:settings:manage`)
- **Request Body**: `{ "contactPhone": "+251911223344", "contactEmail": "info@example.com" }`

#### `GET /api/v1/cms/profile` | `PATCH /api/v1/cms/profile`
Retrieves or updates the tenant's public CMS profile (mission, vision, bio, social links).
- **Protection**: Subject to `sanitizeContentValue` anti-XSS validation.

#### `GET /api/v1/cms/leadership` | `POST /api/v1/cms/leadership/positions` | `POST /api/v1/cms/leadership/members`
Manages leadership positions and personnel rosters with sort ordering.

#### `GET /api/v1/cms/programs` | `POST /api/v1/cms/programs`
Manages organizational programs and initiatives. Supports lifecycle endpoints:
- `POST /api/v1/cms/programs/:id/publish`
- `POST /api/v1/cms/programs/:id/archive`

#### `GET /api/v1/cms/benefits` | `POST /api/v1/cms/benefits` | `DELETE /api/v1/cms/benefits/:id`
Manages visible membership tier benefits.

#### `GET /api/v1/cms/rules` | `POST /api/v1/cms/rules` | `DELETE /api/v1/cms/rules/:id`
Manages organizational bylaws and governance rules.

#### `GET /api/v1/cms/announcements` | `POST /api/v1/cms/announcements` | `POST /api/v1/cms/announcements/:id/publish`
Manages broadcast news announcements with lifecycle states.

---

### 13.3 Notifications (`/api/v1/notifications`)

#### `GET /api/v1/notifications`
Retrieves the authenticated user's notification feed with unread counter.
- **Auth**: `JwtAuthGuard`, `TenantGuard`
- **Response (`200 OK`)**: `{ "notifications": [...], "unreadCount": 3 }`

#### `PATCH /api/v1/notifications/:id/read`
Marks a specific notification as `READ`.

#### `POST /api/v1/notifications/mark-all-read`
Batch-marks all unread notifications for user in the current tenant as `READ`.

#### `GET /api/v1/notifications/preferences` | `PATCH /api/v1/notifications/preferences`
Retrieves and updates user communication delivery preferences.

#### `POST /api/v1/notifications/broadcast`
Sends a tenant-wide notification to all active members.
- **Auth**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard` (`tenant:members:manage`)
- **Request Body**: `{ "title": "Annual General Meeting", "message": "Notice of AGM...", "type": "BROADCAST" }`
- **Response (`201 Created`)**: `{ "delivered": 142, "targetAudience": "ALL_MEMBERS" }`

---

### 13.4 SaaS Subscriptions & Entitlements (`/api/v1/subscriptions`)

#### `GET /api/v1/subscriptions/plans`
Public listing of available SaaS pricing tiers and features.

#### `POST /api/v1/admin/plans`
Creates or updates a SaaS platform plan tier.
- **Auth**: `JwtAuthGuard`, `PlatformSuperAdminGuard`

#### `POST /api/v1/admin/subscriptions/assign`
Assigns a SaaS plan subscription to a tenant organization.
- **Auth**: `JwtAuthGuard`, `PlatformSuperAdminGuard`

#### `GET /api/v1/subscriptions/me`
Retrieves the active tenant's subscription and plan details.

#### `GET /api/v1/subscriptions/usage`
Retrieves real-time capacity and entitlement usage metrics.
- **Response (`200 OK`)**:
```json
{
  "currentMembers": 85,
  "maxMembers": 1000,
  "memberCapacityPercent": 8.5,
  "currentStaff": 4,
  "maxStaff": 10,
  "planCode": "STANDARD",
  "planName": "Standard Tier",
  "features": { "customBranding": true, "advancedReports": false }
}
```

---

### 13.5 SaaS Billing & Invoices (`/api/v1/admin/invoices` & `/api/v1/invoices`)

#### `POST /api/v1/admin/invoices`
Generates a new SaaS invoice for a tenant organization.
- **Auth**: `JwtAuthGuard`, `PlatformSuperAdminGuard`

#### `GET /api/v1/admin/invoices`
Lists all platform invoices across all tenants.
- **Auth**: `JwtAuthGuard`, `PlatformSuperAdminGuard`

#### `GET /api/v1/invoices/my-invoices`
Lists SaaS invoices scoped exclusively to the authenticated tenant organization.
- **Auth**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard` (`tenant:settings:manage`)

#### `POST /api/v1/admin/invoices/:id/settle`
Marks an invoice as `PAID` with settlement date.
- **Auth**: `JwtAuthGuard`, `PlatformSuperAdminGuard`


