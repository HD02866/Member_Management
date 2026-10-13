# PHASE 1: PRODUCT REQUIREMENTS & SYSTEM ARCHITECTURE FOUNDATION
## Multi-Tenant Membership SaaS Platform (Codename: WaanOfii)

---

## EXECUTIVE SUMMARY & DOCUMENT PURPOSE

This document defines the definitive product requirements, architectural foundation, tenant isolation model, domain entities, and operational boundaries for the **WaanOfii Multi-Tenant Membership SaaS Platform**.

The platform is a commercial, multi-tenant cloud application engineered to manage the complete lifecycle of membership-based organizations—including associations, professional bodies, non-governmental organizations (NGOs), faith-based institutions, alumni networks, and community societies.

The first production tenant will be the **4B Association**. However, pursuant to core engineering principles, **no organization-specific logic, naming, or business assumptions are hard-coded into the architecture**. Every organization functions as an isolated, independently branded, configurable tenant on a shared, horizontally scalable infrastructure.

---

## 1. PRODUCT VISION

### 1.1 Mission & Value Proposition
Traditional membership organizations frequently struggle with fragmented, vulnerable operational workflows: manual spreadsheet tracking, unverified bank receipts, fraudulent physical membership cards, uncollected membership dues, and siloed communication.

**WaanOfii** delivers a modern, cloud-native **Membership-as-a-Service (MaaS) Operating System** that empowers any membership organization to:
1. **Launch a Dedicated Public Web Presence & Portal:** Instantly generate branded public pages displaying mission, leadership, programs, community benefits, and organizational bylaws.
2. **Automate Member Onboarding & Self-Service:** Provide prospective members with a registration portal, digital application flows, profile management, and self-service dashboards.
3. **Streamline Dues & Hybrid Payments:** Bridge emerging-market digital payments (Telebirr, CBE Birr, Chapa, Awash Birr) with traditional manual bank transfer reconciliation through an audit-backed approval engine.
4. **Issue Tamper-Resistant Digital Credentials:** Generate cryptographic, QR-verifiable digital membership cards downloadable as secure PDFs or mobile wallet passes.
5. **Decentralize Administrative Governance:** Allow organization owners to delegate granular operational roles (e.g., Finance Officer, Membership Approver, Event Verifier) while maintaining immutable audit trails.

### 1.2 Long-Term Strategic Horizon
* **Phase 1 (Current):** Architectural specification, domain modeling, tenant isolation guarantees, and risk elimination.
* **Phase 2:** Database schema design (PostgreSQL/Prisma), migration pipelines, and domain layer modeling.
* **Phase 3:** Core backend services (NestJS), authentication/authorization engine, payment reconciliation, and QR verification service.
* **Phase 4:** Frontend portals (Next.js, Tailwind CSS, shadcn/ui), multilingual UI (Amharic & English), and administrative consoles.
* **Phase 5 (Commercial Horizon):** Automated gateway integrations, self-serve SaaS billing tiers for tenant organizations, mobile verifier apps, and custom domain ingress automation.

---

## 2. TARGET CUSTOMERS & MARKET VERTICALS

The platform is designed to serve a diverse spectrum of membership organizations across developing and global markets:

| Vertical | Primary Pain Points Solved | Typical Size & Volume |
| :--- | :--- | :--- |
| **Professional & Trade Associations** (e.g., Medical, Bar, Engineering Associations) | Member credentialing, annual licensing verification, CPD tracking, formal dues collection. | 500 – 50,000 members; annual dues cycle. |
| **Community & Cultural Associations** (e.g., 4B Association, Regional Development Associations, Iddir/Equb modernizations) | Dispersed diaspora members, manual bank transfer reconciliation, physical ID card distribution logistics. | 1,000 – 100,000 members; monthly/annual contributions. |
| **Alumni Networks & Student Unions** | Member discovery, donation tracking, graduating cohort onboarding, event check-in. | 2,000 – 80,000 members; event-driven or tiered plans. |
| **Faith-Based & Religious Organizations** | Tithes/pledge tracking, branch/chapter member rosters, community welfare disbursement. | 300 – 25,000 members; weekly/monthly recurring dues. |
| **NGOs & Civic Advocacy Coalitions** | Volunteer management, multi-lingual bylaws publication, transparent funding reporting. | 200 – 10,000 members; registration & contribution tiers. |
| **Recreational & Athletic Clubs** | Gate entry verification, facility access control via QR code, seasonal membership renewals. | 100 – 5,000 members; seasonal/monthly passes. |

---

## 3. USER PERSONAS

### 3.1 Persona 1: Platform Super Admin ("Dawit - SaaS Operator")
* **Role:** Platform Operator & System Administrator.
* **Context:** Manages the WaanOfii SaaS infrastructure, tenant lifecycles, and platform monetization.
* **Goals:** Monitor platform health, onboard new tenant organizations, review system-wide audit logs, enforce SaaS plan quotas, configure global payment gateways, and suspend non-compliant tenants.
* **Key Frustrations:** Cross-tenant data leaks, manual infrastructure intervention, untracked tenant abuse.

### 3.2 Persona 2: Organization Owner ("Selam - Association President")
* **Role:** Executive Leader / Board President of a Tenant (e.g., 4B Association).
* **Context:** Accountable for organizational integrity, member growth, and financial viability.
* **Goals:** Configure organization branding (logo, colors, mission), define membership tiers and fees, appoint and delegate duties to staff administrators, inspect executive revenue dashboards, and issue official communications.
* **Key Frustrations:** Lack of financial transparency, slow membership verification, loss of organizational data integrity.

### 3.3 Persona 3: Organization Admin / Finance Officer ("Kebede - Treasury Coordinator")
* **Role:** Day-to-day administrative staff member of a specific tenant.
* **Context:** Reviews membership applications, inspects uploaded bank transfer slips, matches transaction reference codes, and approves/rejects memberships.
* **Goals:** Efficient queue processing, instant fraud detection for duplicate bank transaction numbers, and rapid search/filter of member records.
* **Key Frustrations:** Receiving blurry/forged payment screenshots, duplicate submissions, and having to manually update multiple Excel spreadsheets.

### 3.4 Persona 4: Verifier / Event Gatekeeper ("Tigist - Access Security Officer")
* **Role:** Field staff or event registration officer.
* **Context:** Stationed at association assemblies, annual conferences, or facility gates.
* **Goals:** Quickly scan member QR codes using any standard smartphone camera, immediately view verification status (VALID, EXPIRED, SUSPENDED), verify the member's photo, and grant or deny entry within seconds.
* **Key Frustrations:** Slow network loading, complex logins required for simple scanning, fake/tampered membership cards.

### 3.5 Persona 5: Active Member ("Abebe - Enrolled Member")
* **Role:** Enrolled constituent of an organization.
* **Context:** Wants seamless membership access, simple dues payment, and instant digital proof of active standing.
* **Goals:** Register online in preferred language (Amharic or English), pay dues via mobile wallet or bank transfer, obtain an official digital ID card, display QR code on mobile, and download an official PDF card.
* **Key Frustrations:** Waiting weeks for physical PVC card delivery, opaque payment status, having to travel to an office to verify payment.

### 3.6 Persona 6: Prospective Member / Public Visitor ("Hanna - Applicant")
* **Role:** Public user discovering the organization.
* **Context:** Exploring whether to join the association.
* **Goals:** Read public information about the association's mission, leadership, rules, and benefits on a professional website; choose an appropriate membership plan; submit an application with minimal friction.
* **Key Frustrations:** Broken public websites, outdated leadership information, ambiguous fee requirements.

---

## 4. TENANT MODEL & MULTI-TENANCY ARCHITECTURE

### 4.1 Tenant Definition
A **Tenant** is an independent, legally separate organization operating within the platform. Every tenant operates in total logical isolation from all other tenants.

```
+-----------------------------------------------------------------------------------+
|                           WaanOfii Platform (SaaS Infrastructure)                  |
+-----------------------------------------------------------------------------------+
       |                                      |                                    |
       v                                      v                                    v
+-----------------------+      +-----------------------+      +-----------------------+
|  Tenant: 4B Assoc.    |      |  Tenant: MedAssoc     |      |  Tenant: AlumniOrg    |
|  Slug: 4b             |      |  Slug: ethio-med      |      |  Slug: aau-alumni     |
|  Domain: 4b.waanofii  |      |  Domain: med.org.et   |      |  Domain: alumni.et    |
+-----------------------+      +-----------------------+      +-----------------------+
| - Custom Branding     |      | - Custom Branding     |      | - Custom Branding     |
| - Isolated Members    |      | - Isolated Members    |      | - Isolated Members    |
| - Isolated Payments   |      | - Isolated Payments   |      | - Isolated Payments   |
| - Isolated Staff      |      | - Isolated Staff      |      | - Isolated Staff      |
| - Custom Plans        |      | - Custom Plans        |      | - Custom Plans        |
| - Isolated Audit Logs |      | - Isolated Audit Logs |      | - Isolated Audit Logs |
+-----------------------+      +-----------------------+      +-----------------------+
```

### 4.2 Multi-Tenancy Strategy Evaluation & Decision

Three standard database multi-tenancy models were rigorously evaluated:

| Criterion | Model A: Database-per-Tenant | Model B: Schema-per-Tenant | Model C: Shared DB, Shared Schema (Discriminator Column) |
| :--- | :--- | :--- | :--- |
| **Data Isolation** | Physical (Highest) | Namespace (High) | Logical (Enforced via Engine & RLS) |
| **Operational Overhead** | Extremely High (DB pooling, hundreds of connection pools, complex migrations) | High (Prisma migrations must run against N schemas; connection limit saturation) | Low (Single standard Prisma migration pipeline, unified connection pool) |
| **Cost Efficiency** | Low (High baseline resource cost) | Medium | Optimal (Maximizes compute & memory utilization) |
| **Cross-Tenant Queries (SaaS Analytics)** | Very Difficult | Complex (Union across schemas) | Clean & Direct for Super Admin |
| **Recommended Decision** | Rejected | Rejected | **ADOPTED (with Strict Application Context & Row-Level Security)** |

#### Architectural Guarantee:
1. Every tenant-owned entity table contains a non-nullable foreign key: `organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE`.
2. **NestJS Scoped Tenant Context:** A NestJS Execution Context Interceptor extracts the tenant context from the incoming request (subdomain, header, or validated JWT claim) and binds it to a `TenantContext` request-scoped service.
3. **Prisma Client Extensions / Query Middleware:** Automatically injects `where: { organization_id: currentTenantId }` on all `find`, `update`, `delete`, and `count` operations, and automatically populates `data: { organization_id: currentTenantId }` on all `create` operations.
4. **PostgreSQL Row-Level Security (RLS) as Defense-in-Depth:** In addition to application middleware, the database connection executes `SET LOCAL app.current_tenant_id = '...'` for tenant-scoped operations, ensuring direct SQL queries cannot accidentally breach tenant boundaries.

### 4.3 Tenant Identification & Resolution Engine
The platform dynamically resolves tenant identity using a waterfall resolution strategy:

1. **Custom Domain:** If `Host` header is `members.4bassociation.org`, query cached reverse-lookup table for custom domain mapping.
2. **Subdomain:** If `Host` header is `4b.waanofii.com` (or `4b.localhost:3000` in development), extract the subdomain slug `4b`.
3. **Path Prefix (Fallback for APIs/testing):** `/api/v1/tenants/:slug/...`
4. **JWT Claim (Authenticated Requests):** The user's active session token contains the targeted `organization_id`. The backend verifies that the resolved domain matches the user's token tenant scope.

### 4.4 Tenant-Isolated Boundaries
Isolation is strictly enforced across all infrastructure components:
* **Relational Database:** `organization_id` on all tenant entities + RLS.
* **Blob / Object Storage (S3 / MinIO):** Root bucket partitioning: `s3://waanofii-storage/tenants/{organization_id}/{category}/{filename}`. Pre-signed URLs are scoped strictly to the authenticated tenant.
* **Cache & Key-Value (Redis):** Cache key namespacing: `tenant:{organization_id}:{cache_key}`.
* **Job Queues (BullMQ):** Worker jobs payload includes `organization_id`. The queue processor initializes the `TenantContext` before executing job logic.
* **Audit Trail:** Audit logs are permanently partitioned by `organization_id`.

---

## 5. USER IDENTITY VS. TENANT MEMBERSHIP DECOUPLING

A fundamental architectural flaw in naive SaaS systems is conflating **Identity (User Account)** with **Affiliation (Member/Staff)**. 

### 5.1 The Dual-Decoupling Principle
In the real world:
* A person ("Abebe") is an individual human with credentials (email, phone, password).
* Abebe may be an **active member** of the *4B Association*.
* Abebe may also be an **Organization Admin** of the *Ethiopian Engineering Society*.
* Abebe may later join a *University Alumni Association* as an **applicant**.

Therefore, the system decouples:
1. **`User` (Global Identity):** Contains authentication credentials, global profile, primary phone/email, password hash, and system-wide state.
2. **`OrganizationUser` / `TenantStaff` (Staff Role):** Associates a `User` with an administrative role (Owner, Admin, Finance) within a specific `Organization`.
3. **`MemberProfile` (Member Entity):** Contains tenant-specific membership demographics, national ID numbers, custom registration fields, and membership status within a specific `Organization`.
4. **`Membership` (Contractual Subscription):** A specific historical or active enrollment term tied to a `MembershipPlan`, start date, expiration date, and payment status.

```
                        +----------------------+
                        |        User          |
                        | (Global Credentials) |
                        +----------------------+
                                   |
         +-------------------------+-------------------------+
         |                                                   |
         v (1:N)                                             v (1:N)
+-----------------------+                           +-----------------------+
|     TenantStaff       |                           |     MemberProfile     |
| (Admin/Finance Roles) |                           | (Constituent Profile) |
+-----------------------+                           +-----------------------+
         |                                                   |
         v (N:1)                                             v (N:1)
+-----------------------+                           +-----------------------+
|     Organization      |                           |     Organization      |
|    (Tenant Entity)    |                           |    (Tenant Entity)    |
+-----------------------+                           +-----------------------+
                                                             |
                                                             v (1:N)
                                                    +-----------------------+
                                                    |      Membership       |
                                                    |  (Contractual Term)   |
                                                    +-----------------------+
                                                             |
                                                             v (N:1)
                                                    +-----------------------+
                                                    |    MembershipPlan     |
                                                    +-----------------------+
```

---

## 6. USER ROLES & PERMISSION MODEL (RBAC)

### 6.1 Role Hierarchy

```
[Platform Super Admin] ── (SaaS Operator, manages all tenants & infrastructure)
         │
         ▼
[Organization Owner] ──── (Tenant Superuser, complete authority over their tenant)
         │
         ├───────────────────────────────┐
         ▼                               ▼
[Organization Admin]           [Organization Finance Admin]
(Operational staff, approvals)  (Payment review, reconciliation, exports)
         │                               │
         ├───────────────────────────────┘
         ▼
[Organization Verifier] ──────── (Field agent, QR scan & credential verification only)
         │
         ▼
[Organization Member] ────────── (Authenticated constituent, self-service dashboard)
         │
         ▼
[Public / Anonymous] ─────────── (Unauthenticated visitor viewing public pages)
```

### 6.2 Predefined Roles & Responsibilities

| Role | Scope | Primary Purpose |
| :--- | :--- | :--- |
| **Platform Super Admin** | Platform-Wide | Manages organizations, SaaS plans, global system settings, and reviews platform audit logs. Cannot modify organization-level business data unless explicitly impersonating via logged audit mode. |
| **Organization Owner** | Single Tenant | Primary contact and executive officer. Full administrative rights within their tenant, including billing, appointing staff, configuring plans, and editing bylaws. |
| **Organization Admin** | Single Tenant | Operational manager. Reviews member registrations, publishes programs and announcements, manages committee lists, issues digital IDs. |
| **Organization Finance Officer** | Single Tenant | Treasury specialist. Reviews manual payment proofs, approves/rejects payment records, exports financial summaries. |
| **Organization Verifier** | Single Tenant | Gatekeeper/Receptionist. Restricted permission to access the mobile QR scanner verification endpoint and validate active status. |
| **Member** | Single Tenant | Regular participant. Accesses own profile, pays dues, submits transfer slips, downloads digital ID, views private member notices. |
| **Public User** | Public Web | Browses public organization portal, views mission, leadership, published rules, and initiates registration. |

### 6.3 Granular Permission Matrix

The platform implements fine-grained Permission-Based Access Control (PBAC) grouped into functional capabilities:

| Permission String | Super Admin | Org Owner | Org Admin | Finance Officer | Verifier | Member |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `platform:tenants:manage` | **X** | - | - | - | - | - |
| `platform:plans:manage` | **X** | - | - | - | - | - |
| `platform:audit:view` | **X** | - | - | - | - | - |
| `tenant:profile:update` | - | **X** | - | - | - | - |
| `tenant:staff:manage` | - | **X** | - | - | - | - |
| `tenant:plans:manage` | - | **X** | **X** | - | - | - |
| `tenant:members:read` | - | **X** | **X** | **X** | - | - |
| `tenant:members:approve` | - | **X** | **X** | - | - | - |
| `tenant:members:suspend` | - | **X** | **X** | - | - | - |
| `tenant:payments:read` | - | **X** | **X** | **X** | - | - |
| `tenant:payments:approve` | - | **X** | - | **X** | - | - |
| `tenant:cards:issue` | - | **X** | **X** | - | - | - |
| `tenant:cards:revoke` | - | **X** | **X** | - | - | - |
| `tenant:cards:verify` | - | **X** | **X** | **X** | **X** | - |
| `tenant:content:manage` | - | **X** | **X** | - | - | - |
| `tenant:audit:view` | - | **X** | **X** | - | - | - |
| `member:self:read` | - | - | - | - | - | **X** |
| `member:self:update` | - | - | - | - | - | **X** |
| `member:self:pay` | - | - | - | - | - | **X** |
| `member:self:card` | - | - | - | - | - | **X** |

---

## 7. MEMBERSHIP LIFECYCLE & STATE MACHINE

Membership status is not a simple boolean flag. It is governed by a strict, deterministic state machine with validated transitions, entry/exit guards, and automated side effects.

### 7.1 State Machine Diagram

```
                 [ Registration Submitted ]
                             │
                             ▼
                     +---------------+
                     |  REGISTERED   |
                     +---------------+
                             │
                  (Select Plan & Invoice)
                             │
                             ▼
                   +-------------------+
                   |  PAYMENT_PENDING  |<─────────────────────┐
                   +-------------------+                      │
                             │                                │
                  (Submit Proof / Slip)                       │
                             │                                │
                             ▼                                │
                  +--------------------+                      │
                  | PAYMENT_SUBMITTED  |                      │
                  +--------------------+                      │
                             │                                │
                  (Staff Initiates Review)                    │
                             │                                │
                             ▼                                │
                    +------------------+                      │
                    |   UNDER_REVIEW   |                      │
                    +------------------+                      │
                       │            │                         │
      (Proof Approved) │            │ (Proof Rejected)        │
                       ▼            ▼                         │
                 +----------+  +----------+                   │
                 | APPROVED |  | REJECTED | ───(Re-upload)────┘
                 +----------+  +----------+
                       │
             (Generate Digital ID)
                       │
                       ▼
                  +----------+
                  |  ACTIVE  |<───────────────────────────────┐
                  +----------+                                │
                   │        │                                 │
     (Term Expired)│        │ (Admin Suspension)              │
                   ▼        ▼                                 │
             +---------+  +-----------+                       │
             | EXPIRED |  | SUSPENDED |                       │
             +---------+  +-----------+                       │
                  │             │                             │
            (Renewal Paid)      └──────(Admin Reinstates)─────┘
                  │                                           │
                  └───────────────────────────────────────────┘
```

### 7.2 State Definitions & Operational Rules

| State | Definition | Member System Capabilities | Can Access Digital ID? |
| :--- | :--- | :--- | :---: |
| `REGISTERED` | Member profile created; no membership plan selected yet. | Can log in, complete profile data, select plan. | NO |
| `PAYMENT_PENDING` | Plan selected; invoice created; awaiting payment proof or automated checkout. | View payment instructions, upload payment receipt. | NO |
| `PAYMENT_SUBMITTED` | Payment receipt uploaded or automated transaction initiated. | View pending status; cannot modify proof unless recalled. | NO |
| `UNDER_REVIEW` | Locked by an admin/finance reviewer to prevent concurrent review. | View review status. | NO |
| `APPROVED` | Payment confirmed valid; background job queuing digital ID generation. | Full access to portal benefits. | Issuing... |
| `ACTIVE` | Official member in good standing; valid digital card issued. | Complete member portal access; digital ID active and scanning VALID. | **YES (VALID)** |
| `EXPIRED` | Membership term exceeded end date without renewal payment. | Dashboard shows renewal banner; card scans EXPIRED. | **YES (EXPIRED)** |
| `SUSPENDED` | Sanctioned by organization leadership for policy violation. | Blocked from benefits; card scans SUSPENDED. | **NO (REVOKED)** |
| `REJECTED` | Submitted payment proof was invalid, illegible, or fraudulent. | Prompted with rejection reason; allowed to re-submit proof. | NO |
| `CANCELLED` | Voluntary resignation or termination. | Read-only profile access. | NO |
| `ARCHIVED` | Soft-deleted / historical record. | Inactive. | NO |

### 7.3 Guard Conditions & Automated Side Effects
* **Trigger `PAYMENT_SUBMITTED -> APPROVED`:**
  * Guard: Payment must have state `VERIFIED` and confirmed amount $\ge$ plan price.
  * Side Effect 1: Transition `Membership` to `ACTIVE`.
  * Side Effect 2: Compute `start_date` (current timestamp) and `end_date` (calculated from Plan billing period, e.g., $+1\text{ year}$).
  * Side Effect 3: Dispatch asynchronous worker job to render official PDF and generate signed digital ID token.
  * Side Effect 4: Dispatch in-app and email notification to member with welcome packet.
* **Trigger `ACTIVE -> EXPIRED`:**
  * Guard: Cron execution where `current_timestamp > end_date` and `grace_period` has lapsed.
  * Side Effect 1: Digital ID verification endpoint immediately reflects `EXPIRED`.
  * Side Effect 2: Dispatch automated renewal reminder notification.

---

## 8. PAYMENT LIFECYCLE & HYBRID RECONCILIATION

In emerging markets and association contexts, payments operate on a **hybrid model**:
1. **Automated Gateways:** Telebirr SuperApp/H5, CBE Birr API, Chapa, Awash Birr, or Stripe (instant webhook confirmation).
2. **Manual Bank Transfer & Deposit Reconciliation:** Member executes a mobile banking transfer (e.g., CBE Mobile Banking, Telebirr P2P, Awash, Bank of Abyssinia) to the association's bank account, then manually uploads the transaction reference and receipt slip.

### 8.1 Dual-Path Payment Architecture

```
                                  [ Member Initiates Payment ]
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
           [ Path A: Automated Gateway ]                       [ Path B: Manual Reconciliation ]
                     │                                                     │
         (Redirect to Gateway / USSD)                         (Member Transfers via Bank App)
                     │                                                     │
       +----------------------------+                         +----------------------------+
       | Status: PROCESSING         |                         | Status: SUBMITTED          |
       | Gateway TxID logged        |                         | Ref Code / Bank Slip Req.  |
       +----------------------------+                         +----------------------------+
                     │                                                     │
        (Async Webhook Received)                                (Admin Verification Queue)
                     │                                                     │
            ┌────────┴────────┐                                   ┌────────┴────────┐
            ▼                 ▼                                   ▼                 ▼
      [Signature OK]    [Signature Fail]                     [Valid Proof]     [Invalid / Duplicate]
            │                 │                                   │                 │
            ▼                 ▼                                   ▼                 ▼
       +----------+      +----------+                        +----------+      +----------+
       | VERIFIED |      |  FAILED  |                        | VERIFIED |      | REJECTED |
       +----------+      +----------+                        +----------+      +----------+
```

### 8.2 Payment States & Definitions

| State | Description | Next Permitted States |
| :--- | :--- | :--- |
| `PENDING` | Payment intent/invoice created; waiting for user action. | `SUBMITTED`, `PROCESSING`, `FAILED` |
| `SUBMITTED` | Member provided manual transfer reference number and/or receipt image. | `UNDER_REVIEW`, `REJECTED` |
| `PROCESSING` | Automated payment gateway is processing the charge. | `VERIFIED`, `FAILED` |
| `UNDER_REVIEW` | Staff reviewer has opened and locked the manual submission. | `VERIFIED`, `REJECTED` |
| `VERIFIED` | Funds confirmed received in organization bank account. | `REFUNDED` |
| `REJECTED` | Reference code invalid, forged slip, or amount mismatch. | `SUBMITTED` (re-attempt) |
| `FAILED` | Gateway declined transaction or session timed out. | `PENDING` |
| `REFUNDED` | Administrative reversal of confirmed payment. | None (Final) |

### 8.3 Anti-Fraud & Idempotency Safeguards for Manual Payments
Manual bank slip submissions carry substantial fraud risk (e.g., photoshopped receipts, reusing a single bank slip across multiple members or multiple months). The platform enforces:

1. **Strict Reference Code Uniqueness (Tenant-Level):**
   * Database composite unique constraint: `UNIQUE (organization_id, transaction_reference)`.
   * A transaction code (e.g., CBE transfer code `FT24...` or Telebirr transaction code `CL...`) can **never** be used more than once in the same organization.
2. **Cross-Tenant Duplicate Warning Flag:**
   * If a transaction code submitted in Tenant A was ever used in Tenant B, flag as `POTENTIAL_FRAUD` for administrative inspection (while preserving tenant privacy by not revealing other tenant details).
3. **Optimistic Locking During Review:**
   * Prevents race conditions where two administrators simultaneously review and approve the same slip.
4. **Mandatory Audit Logging on Payment Decisions:**
   * The approving/rejecting admin's `user_id`, timestamp, rejection reason note, and client IP are permanently recorded.

---

## 9. DIGITAL MEMBERSHIP CARD & SECURE QR VERIFICATION

### 9.1 The Insecurity of Naive QR Implementations
Many existing systems encode a raw URL or sensitive data directly into the QR code (e.g., `https://example.com/member/123` or a JSON string with national ID and phone number).
* **Vulnerability 1 (PII Leakage):** Anyone scanning the badge with a generic phone camera sees the member's private phone number, email, and home address.
* **Vulnerability 2 (Sequential Enumeration / IDOR):** Attackers change `123` to `124` to discover other members.
* **Vulnerability 3 (Screenshot Duplication):** A member screenshots their valid card and passes it to an unauthorized friend to gain event entry.

### 9.2 WaanOfii Secure Verification Architecture
The platform implements a **Cryptographically Signed Verification Protocol**:

```
[ Member ID Card Generated ]
            │
            ▼
[ Generate Cryptographic Verification Record ]
- Token: UUIDv4 / High-entropy NanoID (256-bit entropy)
- Encrypted / Signed Token Payload: JWS (JSON Web Signature)
- Encoded QR Content: https://waanofii.com/verify?tid={token}
            │
            ▼
[ Verifier Scans QR with Camera ]
            │
            ▼
[ GET /api/v1/credentials/verify?tid={token} ]
            │
            ├─ 1. Rate-limit check (prevent brute-force scanning)
            ├─ 2. Cryptographic signature check
            ├─ 3. Database lookup for active Token Record
            ├─ 4. Check Member & Membership Status (ACTIVE, EXPIRED, SUSPENDED)
            ├─ 5. Log Verification Audit Event (timestamp, verifier_id, location)
            │
            ▼
[ Render Public Mobile-Optimized Verification Result Page ]
- Clean, tamper-evident UI (Green = Valid, Amber = Expired, Red = Invalid/Suspended)
- Displays ONLY non-sensitive verification data:
    * Member Full Name
    * Official Photo (matches person standing in front of gatekeeper)
    * Organization Name & Logo
    * Member Number
    * Membership Tier (e.g., Gold, Standard, Executive)
    * Status Badge (ACTIVE, EXPIRED, SUSPENDED, REVOKED)
    * Validity Expiration Date
    * Dynamic Animated Real-Time Server Clock (anti-screenshot defense)
```

### 9.3 Digital ID Card Attributes (Visual Presentation)
The generated PDF and digital wallet asset includes:
1. Organization Name & Vector Logo
2. Dynamic Tenant Primary Color Branding
3. Member Portrait Photograph
4. Full Legal Name
5. Unique Membership Code (e.g., `4B-2026-00482`)
6. Membership Category / Plan Name
7. Issue Date & Expiry Date
8. High-Density Vector QR Code
9. Official Organization Watermark & Sign-off

### 9.4 Card Revocation & Reissuance Lifecycle
* When a membership is suspended or cancelled, the associated `DigitalIdCard` status transitions to `REVOKED`.
* Any subsequent scan of the existing physical or digital QR instantly displays `CARD REVOKED: CONTACT ASSOCIATION`.
* If a member updates their legal name or photo, the previous token is invalidated, and a new token is generated with an incremented revision counter.

---

## 10. ORGANIZATION (TENANT) LIFECYCLE

```
                 [ Self-Service Registration / Sales Assisted ]
                                        │
                                        ▼
                               +-----------------+
                               |   ONBOARDING    |
                               +-----------------+
                                        │
                         (Complete Organization Profile)
                                        │
                                        ▼
                        +-------------------------------+
                        |   PENDING_PLATFORM_APPROVAL   |
                        +-------------------------------+
                                        │
                       (Platform Super Admin Approves)
                                        │
                                        ▼
                                 +------------+
                                 |   ACTIVE   |<─────────────────────┐
                                 +------------+                      │
                                        │                            │
                          ┌─────────────┴─────────────┐              │
                          ▼                           ▼              │
                  +---------------+           +---------------+      │
                  | GRACE_PERIOD  |           |   SUSPENDED   |      │
                  | (SaaS PastDue)|           | (Admin Hold)  |      │
                  +---------------+           +---------------+      │
                          │                           │              │
                          │                    (Hold Lifted)         │
                          │                           └──────────────┘
                    (Non-Payment)
                          │
                          ▼
                  +---------------+
                  |  DEACTIVATED  |
                  +---------------+
```

### 10.1 Lifecycle Stages
1. **`ONBOARDING`:** Organization record created. Initial Owner invited. Setting up domain, branding, currency, and initial plans.
2. **`PENDING_PLATFORM_APPROVAL`:** Prevents rogue actors from spinning up illicit organizations. Super Admin reviews legality.
3. **`ACTIVE`:** Organization is fully operational. Public site live; member registration open.
4. **`GRACE_PERIOD`:** Platform subscription invoice overdue. Warning banners shown to Org Owner, but member services remain active for a 14-day window.
5. **`SUSPENDED`:** Explicit freeze by Platform Super Admin (e.g., terms violation, fraud complaint). All member logins and public landing pages for that tenant are locked.
6. **`DEACTIVATED`:** Soft-deleted. Retained for 90 days pursuant to data compliance, then eligible for cryptographic scrubbing.

---

## 11. CORE MODULES & ARCHITECTURAL SUBSYSTEMS

The backend is structured as a **Modular Monolith in NestJS**, adhering strictly to Clean Architecture and Domain-Driven Design (DDD).

```
+-----------------------------------------------------------------------------------+
|                            NESTJS MODULAR MONOLITH                                |
+-----------------------------------------------------------------------------------+
|  [ Tenancy Module ]              [ IAM & Auth Module ]       [ SaaS Billing ]     |
|  - Tenant Resolver Interceptor   - Global Credentials        - Plans & Quotas     |
|  - Domain & Subdomain Mapping    - Role & Permission Guards  - Usage Metrics      |
+-----------------------------------------------------------------------------------+
|  [ Member & Profile Module ]     [ Membership Plan Engine ]  [ Payment Module ]   |
|  - Custom Field Engine           - Billing Rules & Tiers     - Hybrid Gateway API |
|  - Member Search & Filters       - Proration & Extensions    - Manual Slip Queue  |
+-----------------------------------------------------------------------------------+
|  [ Credential & Card Module ]    [ Governance & Leaders ]    [ Public CMS Engine ]|
|  - PDF Generation Service        - Executive Committee Roster- Programs & Services|
|  - QR Code Signing & Verify API  - Bio & Contact Directory   - Bylaws & Documents |
+-----------------------------------------------------------------------------------+
|  [ Internationalization (i18n) ] [ Notification Dispatcher ] [ Audit & Security ] |
|  - Ge'ez / Gregorian Calendars   - BullMQ Async Queue        - Immutable Logging  |
|  - Amharic / English Engine      - Email / SMS / In-App      - Anti-Tamper Records|
+-----------------------------------------------------------------------------------+
```

---

## 12. FUNCTIONAL REQUIREMENTS

### Module 1: Tenant & Organization Management
* **FR-1.1:** System shall permit Platform Super Admin to create, approve, configure, suspend, and archive organizations.
* **FR-1.2:** System shall allow Organization Owners to configure public profile data: Name, Slug, Logo, Cover Banner, Primary/Secondary Brand Colors, Mission, Vision, History, Contact Email, Phone, Physical Address, and Social Links.
* **FR-1.3:** System shall isolate all administrative operations strictly to the organization context of the authenticated user.

### Module 2: Identity, Authentication & Permissions
* **FR-2.1:** System shall support user registration and authentication via **Email OR Mobile Phone Number** + Password.
* **FR-2.2:** System shall issue cryptographically signed JWT tokens with short TTL (15 minutes) and HTTP-only, secure, same-site refresh cookies (7 days).
* **FR-2.3:** System shall enforce password complexity requirements (minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, and 1 special symbol).
* **FR-2.4:** System shall provide granular Role-Based Access Control (RBAC) allowing organization owners to invite staff and assign predefined roles (Admin, Finance Officer, Verifier).

### Module 3: Member Onboarding & Profile Management
* **FR-3.1:** System shall provide a public registration page for each tenant allowing applicants to submit personal info, portrait photo, and select a membership plan.
* **FR-3.2:** System shall support organization-configurable custom fields (e.g., "Field of Study", "Sub-City/Woreda", "National ID / Kebele ID Number").
* **FR-3.3:** System shall provide members with a self-service dashboard displaying current membership status, active plan, renewal dates, and payment history.
* **FR-3.4:** System shall allow members to update their profile information and upload a new portrait photo (triggering administrative review if configured).

### Module 4: Membership Plans & Subscription Rules
* **FR-4.1:** System shall allow Organization Owners to define unlimited membership plans (e.g., Monthly, Annual, Student, Lifetime, Honorary).
* **FR-4.2:** Each plan shall define: Title, Description, Currency (ETB, USD), Recurring Fee, One-Time Registration Fee, Duration Unit (Days, Months, Years), Duration Count, and Active/Archived status.
* **FR-4.3:** System shall automatically calculate expiration dates upon approval based on plan duration rules.

### Module 5: Hybrid Payments & Proof Verification
* **FR-5.1:** System shall provide members with clear organization-specific bank account details (Bank Name, Account Name, Account Number, SWIFT/IBAN) and Telebirr/CBE Birr merchant codes.
* **FR-5.2:** System shall allow members to submit manual payment proof including: Bank Name, Transaction Reference Code, Payment Date, Amount Paid, and an uploaded image of the transfer receipt.
* **FR-5.3:** System shall provide an administrative payment review queue with filters for `SUBMITTED`, `UNDER_REVIEW`, and date ranges.
* **FR-5.4:** System shall enforce uniqueness on transaction reference codes per organization to prevent duplicate slip submissions.
* **FR-5.5:** System shall support rejection of payment proofs with a mandatory rejection reason communicated to the member.
* **FR-5.6:** System architecture shall provide pluggable webhooks and adapter interfaces for automated payment gateways (Telebirr, CBE Birr, Chapa).

### Module 6: Digital Membership Cards & Secure Verification
* **FR-6.1:** System shall generate an official digital membership card immediately upon transition of a membership to `ACTIVE` status.
* **FR-6.2:** System shall render cards in high-resolution vector PDF format downloadable directly from the member dashboard.
* **FR-6.3:** Each card shall embed a 2D QR code containing a secure, non-guessable verification URL with a signed token.
* **FR-6.4:** System shall provide a public verification page accessible via mobile browser upon scanning the QR code, displaying member validity, photo, name, member number, and status without exposing sensitive PII.
* **FR-6.5:** System shall render an animated real-time server-synced clock on the verification screen to counter static screenshot fraud.
* **FR-6.6:** System shall record an audit log entry for every verification scan (timestamp, IP address, user-agent, result).

### Module 7: Organization Governance & Leadership
* **FR-7.1:** System shall allow organizations to manage an executive committee directory: Leader Name, Position/Title (custom string), Photo, Bio, Contact Email, Phone (optional toggle), and Display Order.
* **FR-7.2:** System shall render active leaders on the tenant's public web portal.

### Module 8: Programs, Community Services & Content Management
* **FR-8.1:** System shall allow organizations to publish Programs and Community Services with: Title, Category, Description (rich markdown), Cover Image, Start/End Dates, and Visibility Status (Public or Members-Only).
* **FR-8.2:** System shall allow organizations to publish Membership Benefits and Disclaimers.
* **FR-8.3:** System shall allow organizations to publish and maintain official Rules, Regulations, and Bylaws downloadable as PDF attachments or readable inline.

### Module 9: Multi-Language & Localization
* **FR-9.1:** System shall support complete UI localization in **English** and **Amharic** from day one.
* **FR-9.2:** System shall allow members and administrators to switch language with immediate UI persistence.
* **FR-9.3:** System dynamic content models shall support multi-language storage for organization descriptions, program titles, and announcements.
* **FR-9.4:** System shall format dates with dual-calendar awareness (Gregorian and Ethiopian Calendar where applicable).

### Module 10: Communications & Notifications
* **FR-10.1:** System shall maintain an internal in-app notification center for members and staff.
* **FR-10.2:** System shall dispatch transactional emails (welcome, payment submitted, payment verified, membership expiring, ID card ready).
* **FR-10.3:** System architecture shall include an abstract SMS provider interface for future integration with local Ethiopian SMS gateways (Ethio Telecom, Africa's Talking).

### Module 11: Audit Trail & Compliance
* **FR-11.1:** System shall maintain an immutable audit log recording all administrative mutations: Actor ID, Target Tenant ID, Action Category, Entity Name, Entity ID, Metadata/Diff, Client IP, and Timestamp.
* **FR-11.2:** Organization administrators shall have read-only access to their tenant's audit trail.
* **FR-11.3:** Audit logs shall be append-only and protected against modification or deletion even by Organization Owners.

---

## 13. NON-FUNCTIONAL REQUIREMENTS (NFRS)

### 13.1 Performance & Latency Targets
* **P95 API Latency:** $\le 200\text{ ms}$ for standard authenticated read/write operations under nominal load.
* **QR Verification Endpoint Latency:** $\le 150\text{ ms}$ P95 globally (optimized for field gatekeeper scans on 3G/4G cellular networks).
* **PDF Digital Card Generation:** Asynchronous background generation completed in $\le 3\text{ seconds}$ from approval trigger.
* **Public Landing Page Core Web Vitals:** Largest Contentful Paint (LCP) $\le 1.8\text{ seconds}$, Cumulative Layout Shift (CLS) $\le 0.05$.

### 13.2 Scalability & Resource Utilization
* **Multi-Tenant Capacity:** Architecture must comfortably scale to 5,000+ active tenant organizations and 2,500,000+ total members on a shared cluster without database re-architecture.
* **Connection Pool Optimization:** Connection pooling via PgBouncer / Prisma Accelerate to ensure concurrent request spikes do not saturate PostgreSQL connections.
* **Stateless Application Tier:** All NestJS and Next.js containers must remain strictly stateless, allowing horizontal autoscaling behind a reverse proxy/load balancer.

### 13.3 Availability & Fault Tolerance
* **Target Availability:** 99.9% uptime for core API and member verification endpoints.
* **Data Recovery:** Automated PostgreSQL continuous archiving (WAL archiving) and daily full snapshots with Recovery Point Objective (RPO) $\le 1\text{ hour}$ and Recovery Time Objective (RTO) $\le 4\text{ hours}$.
* **Graceful Degradation:** If background worker queues experience delays, core member registration and verification endpoints must continue to operate synchronously.

### 13.4 Usability & Accessibility
* **Mobile-First Responsive Design:** All public, member, and verification views must be 100% responsive and tested across mobile viewports (down to 360px width).
* **Low-Bandwidth Optimization:** Images served via Next.js Image Optimization with modern WebP/AVIF formats, lazy-loading, and responsive srcset.
* **Font Compatibility:** Full rendering support for Ethiopic script (Fidel) utilizing high-legibility Unicode fonts (Noto Sans Ethiopic).

---

## 14. SECURITY & DATA PROTECTION ARCHITECTURE

```
+-----------------------------------------------------------------------------------+
|                           SECURITY IN-DEPTH LAYERS                                |
+-----------------------------------------------------------------------------------+
| Layer 1: Edge & Network       | Cloudflare DDoS, WAF, TLS 1.3, Rate-Limiting      |
| Layer 2: Transport & Routing  | Strict Host Header Checking, Tenant Subdomain San |
| Layer 3: Application Auth     | Argon2id Hashes, JWT TTL 15m, HttpOnly Cookies    |
| Layer 4: Authorization        | Scoped TenantContext, Guard-Enforced PBAC         |
| Layer 5: Data & Storage       | S3 Signed URLs, Magic Byte MIME Validation        |
| Layer 6: Database             | Parameterized SQL (Prisma), PostgreSQL RLS        |
| Layer 7: Audit & Verification | Signed JWS QR Tokens, Tamper-Evident Logs         |
+-----------------------------------------------------------------------------------+
```

### 14.1 Authentication Security
* **Password Hashing:** Passwords hashed using **Argon2id** (memory cost: 64MB, time cost: 3 iterations, parallelism: 4).
* **Token Architecture:** Dual-token model:
  * Access Token: Short-lived (15 minutes), signed via asymmetric RS256 or HS256 with strong key, passed via `Authorization: Bearer` or secure cookie.
  * Refresh Token: Long-lived (7 days), stored in database as a hashed string, delivered strictly via `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
* **Brute-Force & Credential Stuffing Defense:** Redis-backed sliding window rate limiter:
  * Login attempts: Maximum 5 failed attempts per IP / identifier per 15 minutes.
  * Public registration: Maximum 3 submissions per IP per 10 minutes.
  * QR Verification endpoint: Maximum 60 requests per minute per IP.

### 14.2 Authorization & Tenant Isolation Safeguards
* **IDOR Prevention:** No database query executes with an arbitrary client-supplied ID without qualifying `WHERE organization_id = :currentTenantId`.
* **Cross-Tenant Attack Prevention:** If an attacker attempts to fetch `/api/v1/members/uuid-belonging-to-tenant-B` while authenticated under `tenant-A`, the system returns `404 Not Found` (never `403 Forbidden`, preventing resource enumeration).

### 14.3 Secure File Upload Pipeline
Receipt uploads and member photos present high vulnerability surfaces (malicious executable uploads, SVG script injections, ZIP bombs).
* **File Type Verification:** Files are inspected for **Magic Bytes** at the binary level. Client-supplied extensions and MIME types are discarded.
* **Allowed Extensions:** Images (`.jpg`, `.jpeg`, `.png`, `.webp`) and Documents (`.pdf`). SVGs are strictly disallowed for user uploads due to XSS attack vectors.
* **Storage Execution Defense:** Uploaded files are streamed directly to private S3-compatible buckets. Buckets prohibit public read access and disable script execution.
* **Delivery via Pre-Signed URLs:** All private receipt images are accessed only via short-lived (5-minute expiration) pre-signed S3 URLs generated for authorized staff.

---

## 15. MULTI-TENANCY TECHNICAL SPECIFICATION

### 15.1 Tenant Resolution Request Pipeline

```
1. Client HTTP Request arrives (e.g., Host: 4b.waanofii.com, Path: /api/v1/members)
       │
2. Reverse Proxy / Ingress terminates TLS, sets X-Forwarded-Host: 4b.waanofii.com
       │
3. NestJS Global TenantMiddleware / Interceptor:
       │
       ├─ Extract Host header -> Parse subdomain "4b"
       ├─ Query Redis cache: GET tenant:slug:4b
       │    ├─ Cache Hit -> Return cached Tenant Metadata (id, status, plan)
       │    └─ Cache Miss -> Query PostgreSQL: SELECT * FROM organizations WHERE slug = '4b'
       │                      Set Redis cache: SET tenant:slug:4b (TTL 10 mins)
       │
       ├─ Check Tenant Status:
       │    ├─ If SUSPENDED -> Throw 403 Forbidden ("Organization Suspended")
       │    └─ If ACTIVE -> Continue
       │
       └─ Bind to Request Context: Request[TENANT_CONTEXT] = { id, slug, name, settings }
       │
4. Controller & Service Execution:
       │
       ├─ Authenticated User's token verified: Token.tenant_id MUST match Request[TENANT_CONTEXT].id
       └─ Prisma Service executes query injected with organization_id: Request[TENANT_CONTEXT].id
```

### 15.2 Cross-Tenant Isolation Enforcement Rules
1. **Rule 1 (Zero Ambient Context):** No service or repository method may assume an ambient or global tenant. The `organization_id` must be explicitly derived from the validated `TenantContext`.
2. **Rule 2 (No Cross-Tenant Joins):** Relational queries must never join across different `organization_id` values.
3. **Rule 3 (Unique Constraints are Tenant-Scoped):** Constraints such as member numbers, plan names, or transaction codes are unique **per tenant**, not globally across the database:
   $$\text{INDEX: } (\text{organization\_id}, \text{member\_number}) \text{ UNIQUE}$$
   $$\text{INDEX: } (\text{organization\_id}, \text{transaction\_reference}) \text{ UNIQUE}$$

---

## 16. INTERNATIONALIZATION (I18N) & LOCALIZATION ENGINE

### 16.1 Target Languages
* **English (en):** Platform default.
* **Amharic (am):** Primary local language for 4B Association and Ethiopian organizations.
* **Extensible Architecture:** Designed to seamlessly introduce Afaan Oromoo (om), Tigrinya (ti), French (fr), or Arabic (ar) in future phases without schema restructuring.

### 16.2 Static UI vs. Dynamic Content Translation Strategy

| Category | Storage & Management Technique | Translation Pipeline |
| :--- | :--- | :--- |
| **Static UI Strings** (Buttons, labels, validation messages, navigation, alerts) | JSON Translation dictionaries (`locales/en.json`, `locales/am.json`) managed via Next.js `next-intl`. | Zero runtime database overhead; pre-compiled and served at edge. |
| **Dynamic Organization Content** (Mission, Vision, History, Rules, Announcement Body) | **PostgreSQL JSONB Localization Pattern**: Entities store translatable strings as localized JSON objects: `{"en": "Our Mission", "am": "ተልእኳችን"}`. | Highly flexible; allows organizations to provide translations in their own time without separate schema joins. |
| **Fixed Categorical Enums** (Membership statuses, Payment states) | Canonical English codes in database (`ACTIVE`, `VERIFIED`); translated at frontend presentation layer via dictionary lookups. | Preserves database integrity and query consistency while presenting fully localized labels. |

### 16.3 Dual-Calendar Awareness (Gregorian & Ethiopian Calendar)
Ethiopia operates on the **Ge'ez / Ethiopian Calendar** (12 months of 30 days plus a 13th month *Pagumē* of 5 or 6 days, approximately 7 to 8 years behind the Gregorian calendar).
* **Storage Standard:** All timestamps, issue dates, and expiry dates are stored in **UTC ISO-8601 Gregorian format** in the PostgreSQL database.
* **Presentation Transformation:** The frontend localization layer provides an Ethiopian Date Formatter (utilizing an algorithmic Gregorian-to-Ethiopic converter):
  * Gregorian: `September 11, 2026`
  * Ethiopic: `መስከረም 1 ቀን 2019 ዓ.ም`
* **Membership Terms:** When an organization configures an "Annual Plan", the system can align expiration with the Ethiopian New Year (*Enkutatash* / *Meskerem 1*) if configured in tenant settings.

---

## 17. NOTIFICATION ARCHITECTURE

### 17.1 Asynchronous Event-Driven Dispatch Pipeline
To prevent third-party network latency (SMTP timeouts, SMS gateway delays) from degrading HTTP response times, all notifications are handled asynchronously via **BullMQ and Redis**:

```
[ Domain Event Emitted ] (e.g., PaymentVerifiedEvent)
            │
            ▼
[ NotificationDispatcherService ]
            │
            ├─ 1. Determine Tenant Notification Settings
            ├─ 2. Determine Member Notification Preferences
            ├─ 3. Construct Notification Payload
            │
            ▼
[ Enqueue to Redis: queue:notifications ]
            │
            ▼
[ Notification Worker Cluster ]
            │
            ├─ Channel A: Database In-App Notification (Written to notifications table)
            ├─ Channel B: Email Transport (Resend / AWS SES / SMTP)
            └─ Channel C: SMS Transport (Abstract Gateway Adapter)
```

### 17.2 Notification Events Matrix

| Event Trigger | Recipient | In-App | Email | SMS (Future) | Priority |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `member.registered` | Member | **X** | **X** | **X** | Normal |
| `payment.proof_submitted` | Org Admin / Finance | **X** | **X** | - | Normal |
| `payment.verified` | Member | **X** | **X** | **X** | High |
| `payment.rejected` | Member | **X** | **X** | **X** | High |
| `card.issued` | Member | **X** | **X** | - | High |
| `membership.expiring_soon` | Member | **X** | **X** | **X** | Normal |
| `membership.expired` | Member | **X** | **X** | - | Normal |
| `staff.invited` | Staff Member | - | **X** | - | High |

---

## 18. AUDIT LOGGING & COMPLIANCE

### 18.1 Immutability & Audit Integrity
All critical business mutations are permanently recorded in an append-only `audit_logs` table.
* The application database user has `INSERT` and `SELECT` privileges on `audit_logs`, but **NO `UPDATE` or `DELETE` privileges**.
* Even if an Organization Owner's account is compromised, the attacker cannot alter or delete past audit logs.

### 18.2 Audit Record Schema Structure (Conceptual)
Each audit record captures:
* `id`: UUIDv4
* `organization_id`: UUID of the tenant
* `actor_user_id`: UUID of the authenticated user performing the action
* `actor_role`: Role at time of action (`ORG_OWNER`, `FINANCE_ADMIN`, etc.)
* `action`: Action string (e.g., `PAYMENT_APPROVED`, `MEMBER_SUSPENDED`, `PLAN_PRICE_MODIFIED`)
* `entity_type`: Target entity (`Payment`, `MemberProfile`, `DigitalIdCard`, `OrganizationSetting`)
* `entity_id`: UUID of the targeted entity
* `changes_diff`: JSONB object recording previous state vs new state (sensitive fields like passwords or tokens are scrubbed)
* `ip_address`: Client IP address
* `user_agent`: Client browser/device signature
* `created_at`: Immutable UTC timestamp

---

## 19. SAAS SUBSCRIPTION CONCEPT & MONETIZATION TIERS

The platform incorporates an integrated SaaS subscription model to monetize organizations using the software.

### 19.1 Subscription Tiers (Tenant Plans)

| Feature / Limit | Free / Pilot | Community (Starter) | Professional (Growth) | Enterprise |
| :--- | :---: | :---: | :---: | :---: |
| **Target Audience** | Early testing, 4B launch pilot | Small local associations | Established professional bodies | Large federations, national NGOs |
| **Active Member Limit** | Up to 100 | Up to 1,000 | Up to 10,000 | Unlimited |
| **Admin / Staff Seats** | 2 | 5 | 15 | Unlimited |
| **Storage Quota (Receipts/Photos)** | 1 GB | 10 GB | 50 GB | 500 GB+ |
| **Custom Subdomain** | Included (`4b.waanofii.com`) | Included | Included | Included |
| **Custom Domain Mapping** | - | - | Included (`members.4b.org`) | Included |
| **Automated Payment Gateways** | - | Optional Add-on | Included | Dedicated Integration |
| **Audit Log Retention** | 30 Days | 90 Days | 1 Year | 7 Years (Compliance) |
| **Support SLA** | Community | Standard Email | Priority (24h) | Dedicated Account Mgr |

### 19.2 Quota Enforcement Mechanism
* Quotas are checked at domain service boundaries (e.g., `CreateMemberService` checks `organization.active_members_count < tenant_plan.max_members`).
* When an organization approaches 90% of its quota, an alert banner is displayed to the Organization Owner.
* If a quota is exceeded, existing members remain active, but new member registrations enter a `QUOTA_EXCEEDED_WAITLIST` state until the organization upgrades.

---

## 20. HIGH-LEVEL SYSTEM ARCHITECTURE & TOPOLOGY

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|  - Next.js 14+ App Router (SSR, SSG, React Server Components)                     |
|  - Tailwind CSS + shadcn/ui Component Library                                     |
|  - Multi-tenant routing via Next.js Middleware (Subdomain & Custom Domain)        |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼ (HTTPS / REST / WebSocket)
+-----------------------------------------------------------------------------------+
|                            INGRESS & REVERSE PROXY                                |
|  - Cloudflare / Traefik / Nginx                                                   |
|  - TLS Termination, DDoS Mitigation, Edge Caching, Host Header Forwarding         |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                        APPLICATION LAYER (NestJS Core)                            |
|  - Modular Monolith Architecture                                                  |
|  - TenantContext Interceptor & Resolution Pipeline                                |
|  - Authentication & Authorization Guards (RBAC / PBAC)                            |
|  - Business Services & Domain Logic                                               |
|  - PDF Generation Engine (Puppeteer / Satori / pdf-lib)                           |
+-----------------------------------------------------------------------------------+
             │                           │                           │
             ▼                           ▼                           ▼
+-------------------------+ +-------------------------+ +-------------------------+
|     DATABASE TIER       | |    CACHE & QUEUE TIER   | |   OBJECT STORAGE TIER   |
|  - PostgreSQL 16+       | |  - Redis 7+             | |  - S3-Compatible        |
|  - Prisma ORM + Client  | |  - Session / Auth Cache | |    (AWS S3 / MinIO)     |
|    Extensions           | |  - BullMQ Task Queues   | |  - Member Photos        |
|  - Row-Level Security   | |  - Rate Limiting Store  | |  - Payment Slips (Priv) |
|  - Strict Foreign Keys  | |  - Pub/Sub Events       | |  - Generated PDF Passes |
+-------------------------+ +-------------------------+ +-------------------------+
```

---

## 21. CORE DOMAIN ENTITIES & RELATIONSHIPS

The domain model contains 16 core entities structured around tenant ownership:

```
                            +-------------------+
                            |   Organization    |
                            |     (Tenant)      |
                            +-------------------+
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         │ 1:N                        │ 1:N                        │ 1:N
         ▼                            ▼                            ▼
+------------------+         +------------------+         +------------------+
|   TenantStaff    |         |  MembershipPlan  |         |  MemberProfile   |
+------------------+         +------------------+         +------------------+
         │                            │                            │
         │ N:1                        │ 1:N                        │ 1:N
         ▼                            ▼                            ▼
+------------------+         +------------------+         +------------------+
|       User       |         |    Membership    |◄────────|     Payment      |
| (Global Identity)|         +------------------+   1:N   +------------------+
+------------------+                  │                            │
                                      │ 1:1                        │ 1:N
                                      ▼                            ▼
                             +------------------+         +------------------+
                             |  DigitalIdCard   |         | PaymentProofAtt. |
                             +------------------+         +------------------+
                                      │
                                      │ 1:N
                                      ▼
                             +------------------+
                             | VerificationLog  |
                             +------------------+
```

### 21.1 Entity Inventory & Cardinality

1. **`Organization` (Tenant Root):**
   * Fields: `id`, `name`, `slug`, `custom_domain`, `status`, `branding_config`, `contact_info`, `created_at`, `updated_at`.
   * Relationships: Owns all tenant data.
2. **`User` (Global Identity):**
   * Fields: `id`, `email`, `phone_number`, `password_hash`, `first_name`, `last_name`, `is_platform_admin`, `status`.
   * Relationships: Has many `TenantStaff`, has many `MemberProfile`.
3. **`TenantStaff` (Staff Role Assignment):**
   * Fields: `id`, `organization_id`, `user_id`, `role` (`OWNER`, `ADMIN`, `FINANCE`, `VERIFIER`), `permissions_override`.
   * Unique: `(organization_id, user_id)`.
4. **`MemberProfile` (Organization Constituent):**
   * Fields: `id`, `organization_id`, `user_id`, `member_number`, `first_name`, `last_name`, `photo_url`, `gender`, `date_of_birth`, `national_id_number`, `custom_fields_data` (JSONB), `status`.
   * Unique: `(organization_id, member_number)`, `(organization_id, user_id)`.
5. **`MembershipPlan` (Product Catalog):**
   * Fields: `id`, `organization_id`, `name`, `description`, `price`, `currency`, `billing_period`, `registration_fee`, `is_active`.
6. **`Membership` (Enrollment Instance):**
   * Fields: `id`, `organization_id`, `member_profile_id`, `membership_plan_id`, `status`, `start_date`, `end_date`, `renewal_count`.
7. **`Payment` (Financial Transaction):**
   * Fields: `id`, `organization_id`, `membership_id`, `member_profile_id`, `amount`, `currency`, `payment_method` (`TELEBIRR`, `CBE_BIRR`, `BANK_TRANSFER`, `CASH`), `status`, `transaction_reference`, `rejection_reason`.
   * Unique: `(organization_id, transaction_reference)`.
8. **`PaymentProofAttachment` (Audit Document):**
   * Fields: `id`, `payment_id`, `file_url`, `file_type`, `file_size`, `uploaded_at`.
9. **`DigitalIdCard` (Issued Credential):**
   * Fields: `id`, `organization_id`, `membership_id`, `member_profile_id`, `card_number`, `verification_token`, `signed_token_hash`, `pdf_url`, `status` (`ACTIVE`, `EXPIRED`, `REVOKED`), `issued_at`, `expires_at`.
   * Unique: `verification_token`.
10. **`VerificationLog` (Scan Audit):**
    * Fields: `id`, `digital_id_card_id`, `organization_id`, `scanned_by_user_id`, `verification_result` (`VALID`, `EXPIRED`, `REVOKED`), `ip_address`, `scanned_at`.
11. **`Leader` (Governance):**
    * Fields: `id`, `organization_id`, `name`, `title`, `photo_url`, `bio`, `display_order`, `is_active`.
12. **`Program` (Community Service / Event):**
    * Fields: `id`, `organization_id`, `title`, `description`, `cover_image_url`, `status`, `start_date`, `end_date`.
13. **`Benefit` (Membership Value Proposition):**
    * Fields: `id`, `organization_id`, `title`, `description`, `icon`, `display_order`.
14. **`RuleDocument` (Bylaws & Governance):**
    * Fields: `id`, `organization_id`, `title`, `content_markdown`, `pdf_attachment_url`, `display_order`.
15. **`AuditLog` (Compliance Log):**
    * Fields: `id`, `organization_id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `diff_payload`, `ip_address`, `created_at`.
16. **`NotificationRecord` (Communication Dispatch):**
    * Fields: `id`, `organization_id`, `recipient_user_id`, `channel`, `title`, `message`, `is_read`, `created_at`.

---

## 22. CRITICAL REAL-WORLD EDGE CASES & HANDLING LOGIC

A resilient enterprise SaaS specification must proactively resolve messy real-world edge cases:

### Case 1: Re-Use of Bank Reference Number Across Multiple Submissions
* **Scenario:** A fraudulent applicant attempts to use the same CBE Mobile Banking confirmation code (`FT24278910`) that another applicant used, or re-submits their own code from last year.
* **Resolution:** Database-level composite unique constraint `(organization_id, transaction_reference)`. The second attempt is rejected immediately with a friendly error: *"This transaction reference code has already been registered in the system."* Additionally, if the code exists in *another* tenant, an administrative security flag is silently added to the review queue.

### Case 2: Concurrent Administrative Review (Race Condition)
* **Scenario:** Two finance officers (Admin A and Admin B) simultaneously open the payment review queue and attempt to approve the same pending payment.
* **Resolution:** **Pessimistic / Optimistic Locking:** When Admin A clicks "Review", the payment state transitions to `UNDER_REVIEW` and sets `reviewed_by_user_id = Admin A` with a 10-minute lock. Admin B receives a toast: *"This payment is currently being reviewed by Admin A."* If an update conflict occurs, database version checking aborts the second write.

### Case 3: Member Upgrades or Switches Plan While Payment is Pending
* **Scenario:** A member selects Plan A (Monthly: 100 ETB), then changes their mind and selects Plan B (Annual: 1,000 ETB) before paying.
* **Resolution:** Transitioning plans automatically cancels or supersedes prior unpaid `PENDING` invoices. If a payment was already submitted (`PAYMENT_SUBMITTED`), plan modification is locked until that submission is resolved.

### Case 4: Organization Deactivated While Members are Active
* **Scenario:** Platform Super Admin suspends Tenant X due to billing default or legal review.
* **Resolution:** Immediate cache invalidation of the tenant in Redis. All API requests for that tenant fail at the `TenantMiddleware` layer with a polite `403 Organization Suspended` landing page. Public verification of digital IDs displays `ORGANIZATION SUSPENDED: CONTACT ISSUER`.

### Case 5: Verification Scanned in Low-Connectivity / Offline Environments
* **Scenario:** An association assembly is held in a remote venue with erratic cellular coverage.
* **Resolution:** The mobile verification web app leverages a Service Worker (PWA) to cache verification shell assets. The public verification page requires minimal network payload (< 10 KB JSON payload) to confirm status even on slow 2G/3G connections.

### Case 6: User Exists Globally Under Another Tenant
* **Scenario:** Dr. Abebe registers at `4b.waanofii.com` using email `abebe@gmail.com`. Later, he registers at `ethio-med.waanofii.com` with the same email.
* **Resolution:** The system detects an existing `User` identity. It prompts for Dr. Abebe's existing password (or sends an OTP) to link his global identity to the new `MemberProfile` in `ethio-med`. His login credentials remain unified while his membership profiles, statuses, and ID cards remain completely isolated.

### Case 7: Plan Price Modified by Admin While Invoices are Outstanding
* **Scenario:** An admin raises the Annual Plan fee from 1,200 ETB to 1,500 ETB. Three members already have pending invoices issued at 1,200 ETB.
* **Resolution:** Invoices snapshot the plan price at the moment of invoice creation. Price changes on `MembershipPlan` apply only to future invoices.

### Case 8: Member Photo Updated After Digital ID Card Issued
* **Scenario:** A member changes their profile photo. The old PDF card still bears the old picture.
* **Resolution:** Photo updates for active members trigger an administrative re-approval workflow. Upon approval, the existing `DigitalIdCard` is updated, the PDF is regenerated in the background, and the verification endpoint immediately serves the new photo.

---

## 23. MAJOR TECHNICAL RISKS & MITIGATION STRATEGIES

| Risk Category | Technical Risk Description | Severity | Concrete Architectural Mitigation |
| :--- | :--- | :---: | :--- |
| **Data Leakage** | A bug in application code omits `organization_id` in a query, leaking Tenant A's members to Tenant B. | **CRITICAL** | 1. Automated Prisma query middleware injecting `organization_id`.<br>2. PostgreSQL Row-Level Security (RLS) as database-layer defense.<br>3. Automated end-to-end multi-tenant regression test suite. |
| **Payment Fraud** | Members submitting fabricated mobile banking screenshots generated via fake receipt generator tools. | **HIGH** | 1. Mandatory transaction reference code entry.<br>2. Unique code index preventing replay attacks.<br>3. Admin reconciliation checklist requiring confirmation in official bank statement.<br>4. Pluggable automated gateway integration. |
| **Credential Forgery** | Malicious users forging physical cards or duplicating QR codes. | **HIGH** | 1. Cryptographically signed JWS tokens.<br>2. No sensitive data in QR code.<br>3. Real-time server-synced animated clock on verification screen.<br>4. Instant card revocation capability. |
| **Storage Abuse** | Unrestricted upload of large raw photos and documents exhausting S3 storage or crashing workers. | **MEDIUM** | 1. Strict client & server file size limits (Max 5MB).<br>2. Binary magic-byte inspection.<br>3. Background image compression converting to WebP.<br>4. Tenant storage quotas enforced by SaaS tier. |
| **External Service Outages** | Local Ethiopian payment gateways or SMS gateways experiencing intermittent downtime. | **MEDIUM** | 1. BullMQ exponential backoff retry queues for SMS/Email.<br>2. Always preserve manual bank transfer reconciliation as primary fallback path. |

---

## 24. CRITICAL DECISIONS REQUIRED BEFORE PHASE 2

Before beginning Phase 2 (Database Schema Design & Prisma Setup), the following technical determinations are officially formalized:

1. **Primary Authentication Identifier:**
   * **Decision:** The system will support **Dual Primary Identifiers (Email OR Phone Number)**. In the Ethiopian market, many association members lack active email addresses or prefer SMS/Phone login.
2. **Tenant Data Partitioning Model:**
   * **Decision:** **Shared Database, Shared Schema with Discriminator Column (`organization_id`) and Row-Level Security (RLS)**. This provides the optimal balance of maintainability, migration velocity, cost, and strict isolation.
3. **Dynamic Content Translation Strategy:**
   * **Decision:** **PostgreSQL JSONB Localization Pattern** for dynamic entity fields (e.g., `title: { "en": "...", "am": "..." }`) combined with static JSON dictionaries for UI chrome.
4. **Calendar System Execution:**
   * **Decision:** Store all timestamps in standard **UTC Gregorian**; implement client-side and reporting-layer transformations to the **Ethiopian Calendar** for display and renewal alignment.
5. **Storage Provider Strategy:**
   * **Decision:** Abstract storage via an S3-compatible SDK (AWS S3 in cloud, MinIO in local Docker development).

---

## 25. RECOMMENDED MVP SCOPE (PHASE-BY-PHASE ROADMAP)

To deliver immediate commercial value to the **4B Association** while preserving long-term SaaS scalability, development is partitioned into distinct phases:

### Phase 1: Product Requirements & Architecture Foundation (Current)
* [x] Complete domain analysis and system specification.
* [x] Multi-tenancy architecture and tenant isolation model.
* [x] Security, RBAC, and lifecycle state machines.
* [x] Edge-case resolutions and architectural sign-off.

### Phase 2: Data Architecture & Schema Design (Next)
* Complete Prisma schema definition with all entities, foreign keys, and indexes.
* Multi-tenant migration strategy and automated test seeds (including a clean seed for 4B Association and a second test tenant).
* RLS policy implementation scripts.

### Phase 3: Backend API & Modular Services (NestJS)
* NestJS modular architecture setup with Docker infrastructure (PostgreSQL, Redis, MinIO).
* Tenant resolution middleware & scoped execution context.
* Auth & IAM module (Argon2id, JWT, RBAC guards).
* Member registration & profile services.
* Membership & Plan state engine.
* Hybrid Payment module with manual slip upload and admin review queue.
* Secure Digital ID card generation service (PDF/QR) and public verification endpoint.
* In-app notification dispatcher and audit log listeners.

### Phase 4: Frontend Development (Next.js & shadcn/ui)
* Next.js 14+ application with multi-tenant subdomain/custom-domain routing.
* Bilingual UI implementation (English & Amharic) with language toggle.
* Organization Public Portal (Home, Mission, Leadership, Programs, Rules, Registration).
* Member Self-Service Dashboard (Profile, Status, Payment Slip Upload, Digital ID Card, PDF Download).
* Organization Admin Console (Member Review Queue, Payment Verification Queue, Plan Manager, Leadership Manager, Content CMS).
* Mobile-optimized Public QR Verification Screen with anti-fraud clock.

### Post-MVP Commercial Expansion (Phase 5+)
* Automated Ethiopian payment gateway integrations (Telebirr Direct Merchant API, CBE Birr API, Chapa).
* Platform Super Admin multi-tenant billing & automated Stripe/subscription billing for tenant organizations.
* Automated SMS gateway integrations (Ethio Telecom SMS).
* Dedicated offline-capable mobile scanner application for verifiers.
* Automated Custom Domain SSL certificate provisioning (via Caddy or Cloudflare for SaaS).

---

## ARCHITECTURAL ACCEPTANCE & CONCLUSION
This specification provides an unambiguous, production-grade foundation. By strictly enforcing tenant isolation, decoupling identity from organizational membership, implementing hybrid payment reconciliation, and engineering cryptographic digital ID verification, **WaanOfii** is poised to become a commercial-grade, multi-tenant SaaS platform ready for the 4B Association and scalable to thousands of global organizations.
