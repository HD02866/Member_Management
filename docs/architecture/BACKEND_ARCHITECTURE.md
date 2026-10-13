# WAANOFII BACKEND ARCHITECTURE SPECIFICATION
## Phase 3: NestJS Modular Architecture & Request Lifecycle

---

## 1. SYSTEM OVERVIEW & DESIGN PHILOSOPHY

The WaanOfii backend is designed as an enterprise-grade, multi-tenant SaaS architecture powered by **Node.js**, **TypeScript**, and **NestJS**, interfacing with **PostgreSQL 17+** via **Prisma ORM 6.19.3**.

The core design objectives are:
1. **Absolute Tenant Isolation:** No tenant can access, mutate, or enumerate another tenant's data at any architectural layer (middleware, service, ORM, or database kernel).
2. **Decoupled Identity Foundation:** User accounts exist globally and can belong to multiple independent tenant organizations with different roles and permissions.
3. **Defense-in-Depth:** Multiple concentric validation and isolation boundaries ensure that failure or misconfiguration of an upper layer does not result in data breach.
4. **Stateless Scalability:** Pooled database connections behind PgBouncer or Prisma Accelerate are protected by strictly transaction-local session state (`SET LOCAL`).

---

## 2. MODULAR PROJECT STRUCTURE

The backend codebase follows a domain-driven, modular organization:

```text
src/
├── main.ts                        # Application bootstrapper (Helmet, CORS, Pipes, Filters)
├── app.module.ts                  # Root aggregator module configuring middleware pipeline
│
├── config/                        # Centralized configuration & environment validation
│   ├── configuration.ts           # Typed configuration factory
│   └── validation.ts              # Startup fail-fast environment validation
│
├── common/                        # Shared cross-cutting concerns
│   ├── constants/                 # System role definitions
│   ├── decorators/                # @CurrentUser, @CurrentTenant, @RequirePermissions, @Public
│   ├── filters/                   # HttpExceptionFilter (centralized error sanitization)
│   ├── guards/                    # JwtAuthGuard, PermissionsGuard, RolesGuard
│   ├── interceptors/              # LoggingInterceptor, TransformInterceptor
│   ├── middleware/                # CorrelationIdMiddleware, TenantResolutionMiddleware
│   └── types/                     # AuthenticatedUser, TenantContext, PermissionCode
│
├── database/                      # Prisma ORM & PostgreSQL RLS Integration
│   ├── database.module.ts         # Global database module
│   └── prisma.service.ts          # PrismaClient with transaction-scoped RLS helpers
│
├── tenant/                        # Tenant resolution & request-scoped context
│   ├── tenant.module.ts           # Global tenant module
│   ├── tenant-context.service.ts  # Node.js AsyncLocalStorage request context
│   ├── tenant-resolution.service.ts # Subdomain, custom domain, header & path discovery
│   └── tenant.guard.ts            # Affiliation & membership verification guard
│
├── auth/                          # Authentication & Credential Management
│   ├── auth.module.ts             # Auth module with JWT & Passport
│   ├── auth.controller.ts         # /auth/register, /auth/login, /auth/logout, /auth/me
│   ├── auth.service.ts            # Argon2id hashing, session creation & JWT issuance
│   └── dto/                       # RegisterDto, LoginDto, AuthResponseDto
│
├── users/                         # User profile & multi-tenant affiliations
│   ├── users.module.ts
│   └── users.service.ts
│
├── organizations/                 # Public directory & RLS-guarded member rosters
│   ├── organizations.module.ts
│   ├── organizations.controller.ts
│   └── organizations.service.ts
│
├── audit/                         # Append-only immutable compliance auditing
│   ├── audit.module.ts
│   └── audit.service.ts
│
└── health/                        # Liveness & database readiness checks
    ├── health.module.ts
    └── health.controller.ts
```

---

## 3. UNIFIED REQUEST LIFECYCLE

Every incoming HTTP request traverses a strictly ordered execution sequence:

```
Client HTTP Request
    │
    ▼
1. Security Middleware
   ├── Helmet: HTTP security headers (CSP, HSTS, X-Frame-Options)
   ├── CORS: Domain whitelist enforcement
   └── CookieParser: Signed cookie extraction
    │
    ▼
2. CorrelationIdMiddleware
   └── Injects or propagates 'x-correlation-id' UUID header
    │
    ▼
3. TenantResolutionMiddleware
   ├── Resolves tenant from Subdomain, Host, Custom Domain, or Header
   └── Initializes request boundary in TenantContextService (AsyncLocalStorage)
    │
    ▼
4. Rate Limiting (ThrottlerGuard)
   └── Evaluates IP/endpoint rate limit bucket
    │
    ▼
5. Global ValidationPipe
   └── Strips unknown fields (whitelist: true), forbids injections, casts types
    │
    ▼
6. Authentication (JwtAuthGuard)
   ├── Bypasses if @Public() route
   └── Extracts JWT from Authorization Bearer or access_token cookie -> Binds req.user
    │
    ▼
7. Tenant Membership Verification (TenantGuard)
   ├── Verifies resolved tenant exists
   ├── Asserts authenticated user has valid StaffMembership or MemberProfile in tenant
   └── Populates tenant role & permissions in TenantContext
    │
    ▼
8. RBAC / Authorization (PermissionsGuard & RolesGuard)
   └── Validates @RequirePermissions() and @RequireRoles() against active tenant context
    │
    ▼
9. Controller & Service Execution
   └── Invokes domain methods using PrismaService.withTenantContext(organizationId, fn)
    │
    ▼
10. Database Kernel RLS Transaction
    ├── BEGIN Transaction
    ├── SET LOCAL ROLE waanofii_app;
    ├── SET LOCAL app.current_organization_id = '<tenant_uuid>';
    ├── Execute queries (strictly constrained by PostgreSQL RLS)
    └── COMMIT (or ROLLBACK) -> Connection returns to pool cleanly
    │
    ▼
11. TransformInterceptor & LoggingInterceptor
    ├── Wraps payload in standard response envelope { success: true, data, meta }
    └── Emits structured audit log entry (status, latency, correlation ID, tenant ID)
    │
    ▼
12. Client HTTP Response
```

---

## 4. ERROR HANDLING & EXCEPTION SANITIZATION

All uncaught application errors and HTTP exceptions are intercepted by `HttpExceptionFilter`:
* **Development Mode:** Provides descriptive error information for developer velocity.
* **Production Mode:** Redacts internal stack traces, PostgreSQL error codes, file paths, and database credentials, returning a uniform error structure:

```json
{
  "success": false,
  "statusCode": 403,
  "message": "You do not have permission to access this organization",
  "error": "Forbidden",
  "meta": {
    "timestamp": "2026-09-30T04:42:00.000Z",
    "path": "/api/v1/organizations/ethio-med/members",
    "correlationId": "8b846ff9-a1b7-4c8d-b0de-2f5a5c689f2a"
  }
}
```

---

## 5. HEALTH CHECKS & READINESS PROBES

The `/api/v1/health` endpoint serves as both a Kubernetes/Docker liveness probe and a database readiness probe:
* Executes `SELECT 1;` against PostgreSQL.
* Measures database round-trip latency in milliseconds.
* Reports process uptime and heap memory usage.
* Strictly prevents leaking internal credentials or connection strings.
