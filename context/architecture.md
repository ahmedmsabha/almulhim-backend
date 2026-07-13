# Architecture

## Stack

| Layer | Tool | Purpose |
| --- | --- | --- |
| Framework | NestJS | Backend API framework |
| Runtime Adapter | Express | Default NestJS HTTP adapter |
| Auth | Clerk | Session and token verification |
| Abuse Protection | Arcjet | Rate limiting, bot protection, request hardening |
| ORM | Prisma ORM | Type-safe database access |
| Database | Prisma Postgres | Main relational database |
| Storage | Cloudflare R2 | Videos, PDFs, receipts, announcement images |
| Validation | Zod | Input validation before writes |
| Analytics | PostHog | Critical backend event tracking |
| AI | Gemini via Vercel AI SDK | Receipt verification and future AI checks |
| Email | Nodemailer | Support request notifications and admin replies |

---

## Repository Shape

```txt
/
├── AGENTS.md
├── context/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   ├── common/
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── filters/
│   │   ├── pipes/
│   │   ├── types/
│   │   └── utils/
│   ├── lib/
│   │   ├── ai/
│   │   ├── analytics/
│   │   ├── arcjet/
│   │   ├── clerk/
│   │   ├── database/
│   │   ├── devices/
│   │   ├── mail/
│   │   ├── posthog/
│   │   └── storage/
│   └── modules/
│       ├── auth/
│       ├── users/
│       ├── subscriptions/
│       ├── content/
│       ├── announcements/
│       ├── support/
│       ├── devices/
│       ├── downloads/
│       ├── notifications/
│       ├── analytics/
│       └── health/
└── package.json
```

---

## Boundaries

### `src/modules/*`

Own business features only.

Each module may contain:

- controller
- service
- repository
- schemas
- dto types
- mapper functions

### `src/lib/*`

Own infrastructure integrations only.

Examples:

- `src/lib/database` for Prisma
- `src/lib/clerk` for Clerk verification
- `src/lib/storage` for R2
- `src/lib/posthog` for backend analytics
- `src/lib/analytics` for typed lifecycle event capture
- `src/lib/arcjet` for protection wiring
- `src/lib/ai` for receipt verification
- `src/lib/mail` for support email delivery
- `src/lib/devices` for device hash utilities

### `src/common/*`

Own shared cross-cutting utilities only.

Examples:

- generic guards (`ClerkAuthGuard`, `ArcjetProtectGuard`, `DeviceBindingGuard`)
- decorators
- exception filters
- response serializers
- request context helpers

Auth-specific guards (`RegisteredUserGuard`, `RolesGuard`) live in `src/modules/auth/guards/` because they depend on `AuthService`.

---

## Main Modules

### `auth`

- verify Clerk token
- expose authenticated request context
- server-side role checks

### `users`

- current user profile
- upsert local user row from Clerk identity
- admin student listing

### `subscriptions`

- plan listing
- receipt submission
- pending review workflow
- approve / reject / suspend / expire transitions

### `content`

- units
- chapters
- lessons
- lesson videos
- lesson PDFs
- region and access filtering
- shared AI content search (`POST /content/search`) over client-supplied authorized items

### `announcements`

- region-based announcement visibility
- admin publishing actions

### `support`

- create support request
- admin review status updates

### `devices`

- bind web and mobile devices
- enforce one web + one mobile policy
- admin reset actions

### `downloads`

- mobile-only secure download authorization
- download metadata tracking
- revocation checks

### `notifications`

- in-app notification inbox per student
- region-targeted fan-out on lesson/announcement publish (`notifyRegion`)
- optional Expo push token registration on mobile `DeviceBinding` (send path stubbed until Mobile exists)

Admin routes are colocated in feature modules (`AdminContentController`, `AdminSubscriptionsController`, etc.) — there is no standalone `admin` module.

### `analytics`

- global `src/lib/analytics/` wraps PostHog for typed backend lifecycle events
- feature module `src/modules/analytics/` exposes admin dashboard aggregates (`GET /analytics/admin/dashboard`)
- operational logging remains standard NestJS `Logger` usage

### `mail and support`

- create support request
- notify teacher by email
- send admin reply by email
- update support request status

---

## Request Flow

```txt
HTTP request
  -> Clerk verification
  -> Arcjet protection where applicable (@ArcjetProtect metadata)
  -> registration / role / device guards
  -> controller
  -> zod validation
  -> service
  -> repository / prisma
  -> response mapper
```

---

## Design Rules

- Controllers stay thin.
- Services own business rules.
- Prisma access stays in repository or database-facing classes.
- Validation happens before writes.
- Authorization is always re-checked server-side.
- Signed URL generation stays server-side only.
