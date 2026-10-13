# WAANOFII FRONTEND ARCHITECTURE SPECIFICATION
## Phase 4: Next.js App Router, Design System & Localization Architecture

---

## 1. ARCHITECTURE OVERVIEW

The WaanOfii frontend is architected as a modern, high-performance, and accessible web application located in `apps/web` utilizing:
- **Framework:** Next.js 15+ App Router
- **Language:** TypeScript 5.7+ (Strict Mode)
- **Library:** React 19
- **Styling & Design System:** Tailwind CSS with WCAG-conscious contrast, semantic HTML, and Lucide React icons
- **Package Architecture:** npm workspaces (`"workspaces": ["apps/web"]`) maintaining strict isolation from backend build artifacts
- **State & Context:** React Context providers (`AuthProvider`, `I18nProvider`) with zero global mutable leaks

```text
WaanOfii/
├── src/                  # NestJS API & Domain Services
├── prisma/               # Schema, Migrations, RLS Policies, Seed
├── tests/                # Automated End-to-End Test Suites
├── apps/
│   └── web/              # Next.js App Router Frontend
│       ├── src/
│       │   ├── app/      # App Router Pages & Layouts
│       │   ├── components/ # Design System UI Primitives & Navigation
│       │   ├── lib/      # API Client, Auth State, i18n
│       │   └── locales/  # Translation Dictionaries (EN, AM)
│       ├── tailwind.config.js
│       ├── next.config.mjs
│       └── package.json
└── docs/                 # Architecture & Compliance Specifications
```

---

## 2. ROUTING ARCHITECTURE & PAGE ROSTER

The frontend routes are categorized into three clear operational domains:

### 2.1 Public Platform Pages (WaanOfii SaaS Level)
- `/` — Homepage featuring platform value propositions, real active organizations preview, architecture trust badges, and CTA links.
- `/features` — In-depth architectural feature walkthrough (PostgreSQL RLS, Digital ID, Multi-Tier Plans, Bilingual IAM).
- `/pricing` — SaaS subscription plans for organizations (Starter, Growth, Enterprise) with transparent member limits and storage tiers.
- `/about` — Platform mission, multi-tenant governance philosophy, and data sovereignty guarantees.
- `/organizations` — Public directory of active organizations with live search and filtering.
- `/login` — Authenticated sign-in supporting canonical email or phone number with generic error feedback.
- `/register` — Account registration collecting full name, email/phone, and password.

### 2.2 Public Organization Portal
- `/org/[slug]` — Dynamic, tenant-specific public portal retrieving and displaying organization profile details, mission, vision, purpose, published programs, member benefits, leadership board, bylaws, announcements, and available membership plans with "Apply Now" workflow.

### 2.3 Authenticated Member Area (`/app/*`)
- `/app/dashboard` — Member portal dashboard displaying current active organization context, membership status badge, member number, active plan, next action notices, and digital card status.
- `/app/profile` — Verified member profile form permitting updates to personal fields (`firstName`, `lastName`, `email`, `phoneNumber`, `address`, `city`, `nationalIdNumber`, `gender`, `dateOfBirth`) while strictly protecting server-controlled fields (`memberNumber`, `organizationId`, `status`).
- `/app/membership` — Overview of user's active/registered memberships in the active tenant and plan discovery catalog.
- `/app/organizations` — Multi-tenant organization switcher and overview of all user affiliations (member and staff).
- `/app/settings` — Global account settings, language preferences, and security details.

### 2.4 Platform Administration (`/admin/*`)
- `/admin/onboard` — Secured onboarding workflow accessible exclusively to platform administrators (`isPlatformAdmin === true`) for creating new tenant organizations with validated unique slugs.

---

## 3. WAANOFII DESIGN SYSTEM PRIMITIVES

All UI elements are unified under a cohesive design system located in `apps/web/src/components/ui/`:

| Component | Purpose & Implementation | Accessibility & Behavior |
| :--- | :--- | :--- |
| `Button` | Standardized button with `primary`, `secondary`, `outline`, `ghost`, and `danger` variants. | Loading spinner, disabled state, focus-visible outlines. |
| `Input` | Accessible form field with label, hint, error message, and icon slots. | Auto-generated ID linkage, error ARIA attributes, semantic inputs. |
| `Card` | Modular containers (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`). | Bordered surface cards with dark mode compatibility. |
| `Badge` | Status tags for `REGISTERED`, `ACTIVE`, `PENDING_APPROVAL`, `EXPIRED`, `SUSPENDED`, `UNDER_REVIEW`. | Semantic color mapping complying with WCAG 2.1 contrast ratios. |
| `Modal` | Accessible dialog primitive with backdrop blur and escape key listeners. | `role="dialog"`, `aria-modal="true"`, focus containment, body scroll lock. |
| `LoadingSkeleton` | Animated skeleton placeholders (`CardSkeleton`, `TableSkeleton`, `Skeleton`). | Eliminates blank white screens during data fetching. |
| `EmptyState` | Consistent empty state presentation with icon, title, description, and action CTA. | Explains absent records and presents next steps. |
| `Navbar` | Responsive header with platform navigation, organization switcher, and mobile drawer. | Desktop and mobile accessible navigation with active route highlights. |
| `Footer` | Responsive footer displaying platform links, security attestations, and copyright. | Semantic footer structure. |
| `LanguageToggle` | Quick toggle between English (`EN`) and Amharic (`አማ`). | Instant bilingual interface switching. |
| `OrganizationSwitcher` | Context selector dropdown listing verified user affiliations. | Server-authoritative context switching. |

---

## 4. LOCALIZATION (i18n) ARCHITECTURE

The application implements a structured translation architecture:
- **Supported Languages:** English (`en`) and Amharic (`am`).
- **Dictionary Files:** `apps/web/src/locales/en.json` and `apps/web/src/locales/am.json`.
- **Context Hook:** `useI18n()` providing:
  - `t(path: string, fallback?: string): string` — Dot-notation string translation.
  - `localize(content: any): string` — Extracts localized strings from database JSONB fields (`{ en: "...", am: "..." }`).
  - `setLanguage(lang: Language)` — Updates state and persists user preference in `localStorage.getItem('waanofii_lang')`.
  - Fallback logic: Missing keys in secondary languages cleanly fall back to English without crashing the UI.

---

## 5. CLIENT-SIDE API & AUTHENTICATION INTEGRATION

All backend communications flow through `apps/web/src/lib/api.ts`:
- **Base URL:** Centralized via `process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1'`.
- **Credentials & Cookies:** All requests specify `credentials: 'include'` to pass HTTP-only cookies securely across browser requests.
- **In-Memory Token Fallback:** Access tokens are stored strictly in memory (`inMemoryAccessToken`) and NEVER in `localStorage` or `sessionStorage`.
- **Tenant Context Injection:** Whenever an active organization is selected, `ApiClient` automatically injects `x-tenant-id` and `x-organization-id` headers.
- **Error Normalization:** HTTP error codes (400, 401, 403, 404, 409, 422, 429, 500) are mapped into structured `ApiError` instances with parsed backend validation messages.
