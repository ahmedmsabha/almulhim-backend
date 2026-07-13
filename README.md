# Mulhim Backend

NestJS API for the **Mulhim** learning platform. This repository is the single source of truth for authentication, subscriptions, content access, device binding, secure downloads, and admin workflows.

It serves three clients:

| Client             | Purpose                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Student Web App    | Profile, content browsing, subscriptions, announcements, support                                  |
| Admin Web App      | Student management, content publishing, subscription review, support replies, analytics dashboard |
| Student Mobile App | Offline sync, secure video downloads, device binding                                              |

---

## Status

**Build plan complete** — all 17 steps across 6 phases are implemented.

- 210+ unit tests passing
- Postman collection ready for local API testing
- Arcjet protection wired in `DRY_RUN` mode (ready to flip to `LIVE` after dashboard verification)

---

## Tech Stack

| Layer            | Tool                                            |
| ---------------- | ----------------------------------------------- |
| Framework        | NestJS 11 (Express)                             |
| Language         | TypeScript                                      |
| Auth             | Clerk                                           |
| Database         | PostgreSQL via Prisma ORM 7                     |
| Storage          | Cloudflare R2 (S3-compatible)                   |
| Validation       | Zod                                             |
| Abuse protection | Arcjet                                          |
| Analytics        | PostHog                                         |
| AI               | Gemini via Vercel AI SDK (receipt verification) |
| Email            | Nodemailer (support notifications)              |
| Scheduling       | `@nestjs/schedule`                              |

**Node.js:** >= 22

---

## What Was Built

### Phase 1 — Foundation

- NestJS bootstrap with startup env validation (`src/config/env.schema.ts`)
- Infrastructure modules in `src/lib/` (database, Clerk, R2, PostHog, Arcjet, AI, mail, analytics, devices)
- Prisma schema with full domain models and migrations
- Health check with database connectivity (`GET /health`)

### Phase 2 — Auth & Users

- Global `ClerkAuthGuard` with `@Public()` opt-out
- Role resolution from local DB (`student` / `admin`)
- User registration and profile (`POST /users/register`, `GET /users/me`)
- Admin student listing with search, filters, and pagination (`GET /users`)
- Auth-specific guards in `src/modules/auth/guards/` (`RegisteredUserGuard`, `RolesGuard`)

### Phase 3 — Subscriptions

- Subscription plan CRUD and public listing
- Two-step receipt upload (presigned PUT → submit)
- AI receipt verification (Gemini) with duplicate transaction reference detection
- Admin review workflow: approve, reject, suspend
- Hourly expiry cron for active/suspended subscriptions
- Retry scheduler for failed AI verifications

### Phase 4 — Content, Announcements & Support

- Region-filtered content tree (units → chapters → lessons → videos/PDFs)
- Publication cascade and subscription-based lesson locking
- Admin content CRUD with publish/unpublish and media upload (video up to 1 GB, PDF up to 50 MB)
- Announcements feed with signed image URLs and admin publishing
- Support requests with email delivery to teacher and admin reply emails to students

### Phase 5 — Devices & Downloads

- Device binding (one web + one mobile per student, hashed identifiers)
- Device heartbeat and admin reset (single device or all)
- Mobile-only secure video download authorization with revocation tracking
- Short-lived signed URLs for all private media

### Phase 6 — Hardening

- Typed PostHog lifecycle events (10 high-signal events)
- Admin analytics dashboard (`GET /analytics/admin/dashboard`)
- Arcjet rate limiting and bot protection on abuse-prone routes
- Production fail-fast for empty `CORS_ORIGINS` and `CLERK_AUTHORIZED_PARTIES`
- Module boundary cleanup and context documentation sync
- Postman collection (67 requests across 14 feature folders)

---

## Architecture

```
HTTP request
  → Clerk token verification
  → Arcjet protection (@ArcjetProtect)
  → Registration / role / device guards
  → Controller
  → Zod validation
  → Service (business logic)
  → Prisma / R2 / external services
  → Response mapper
```

### Repository Layout

```
src/
├── config/           # Env schema and validation
├── common/           # Shared guards, decorators, filters, pipes, utils
├── lib/              # Infrastructure integrations (no business logic)
│   ├── ai/           # Receipt verification (Gemini)
│   ├── analytics/    # Typed PostHog events
│   ├── arcjet/       # Abuse protection profiles
│   ├── clerk/        # Token verification
│   ├── database/     # Prisma client
│   ├── devices/      # Device hash service
│   ├── mail/         # Nodemailer
│   ├── posthog/      # PostHog client
│   └── storage/      # Cloudflare R2
└── modules/          # Feature modules (business logic)
    ├── auth/
    ├── users/
    ├── subscriptions/
    ├── content/
    ├── announcements/
    ├── support/
    ├── devices/
    ├── downloads/
    ├── notifications/
    ├── analytics/
    └── health/
```

Admin routes are colocated inside feature modules (e.g. `content/admin/*`, `analytics/admin/*`, `subscriptions` admin endpoints) — there is no standalone admin module.

---

## API Overview

### Public

| Method | Path            | Description                       |
| ------ | --------------- | --------------------------------- |
| GET    | `/health`       | Health check (includes DB status) |
| GET    | `/plans/public` | Active plans (name + price only)  |

### Student (authenticated + registered)

| Method | Path                                         | Description                                |
| ------ | -------------------------------------------- | ------------------------------------------ |
| POST   | `/users/register`                            | Create or update local profile             |
| GET    | `/users/me`                                  | Current user profile                       |
| GET    | `/plans`                                     | Active plans (full subscribe fields)       |
| POST   | `/subscriptions/receipt-upload-url`          | Get presigned receipt upload URL           |
| POST   | `/subscriptions`                             | Submit subscription with receipt           |
| GET    | `/subscriptions/me`                          | Current open subscription                  |
| GET    | `/content/tree`                              | Full content tree (mobile sync)            |
| GET    | `/content/units`                             | List units                                 |
| GET    | `/content/units/:id`                         | Unit detail                                |
| GET    | `/content/chapters/:id`                      | Chapter detail                             |
| GET    | `/content/lessons/:id`                       | Lesson detail (locked/unlocked)            |
| POST   | `/content/search`                            | AI search over client-supplied items       |
| GET    | `/announcements`                             | Region-filtered announcement feed          |
| POST   | `/support`                                   | Submit support request                     |
| GET    | `/support/me`                                | Own support requests                       |
| POST   | `/devices/bind`                              | Bind web or mobile device                  |
| GET    | `/devices/me`                                | List own device bindings                   |
| POST   | `/devices/heartbeat`                         | Device heartbeat (requires device headers) |
| POST   | `/downloads/videos/:lessonVideoId/authorize` | Mobile download authorization              |
| GET    | `/downloads/me`                              | Download sync metadata                     |
| GET    | `/notifications`                             | Paginated own notifications (newest first) |
| GET    | `/notifications/unread-count`                | Unread notification count                  |
| PATCH  | `/notifications/:id/read`                    | Mark one notification read                 |
| PATCH  | `/notifications/read-all`                    | Mark all notifications read                |
| POST   | `/notifications/register-token`              | Register Expo push token on mobile binding |

**Shared content search** (`POST /content/search`) — any registered user (`student` or `admin`):

Clients already loaded their authorized tree (`GET /content/tree` or `GET /content/admin/tree`), flatten visible units/chapters/lessons, and POST that list with a query. The server matches intent via Gemini (`CONTENT_SEARCH_MODEL` = `gemini-3.5-flash`) and returns `{ matchingIds }` — a subset of the request item ids only (hard post-filter). Matching is **not** an access-control boundary; the client must only send items it is allowed to show. Requires `CONTENT_SEARCH_AI_ENABLED=true` (reuses `GOOGLE_GENERATIVE_AI_API_KEY`). Arcjet profile: `content-search` (30 requests / minute / user). On AI failure or when disabled → `503` so clients can keep a local substring fallback.

### Admin (`@Roles('admin')`)

| Method         | Path                                      | Description                                                                                    |
| -------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET            | `/users`                                  | List students (search/filter/paginate); excludes deactivated by default                        |
| GET            | `/users/:userId`                          | Get one student (list-row DTO)                                                                 |
| PATCH          | `/users/:userId/deactivate`               | Soft-block student + ban linked Clerk user                                                     |
| PATCH          | `/users/:userId/reactivate`               | Clear soft-block + unban Clerk user                                                            |
| DELETE         | `/users/:userId`                          | Hard-delete Nest student (cascade) + delete Clerk user                                         |
| GET            | `/plans/all`                              | All plans (including inactive)                                                                 |
| POST           | `/plans`                                  | Create plan                                                                                    |
| PATCH          | `/plans/:id`                              | Update or disable plan                                                                         |
| GET            | `/subscriptions/pending`                  | Pending subscription queue                                                                     |
| GET            | `/subscriptions/archived`                 | Archived decisions (`active` \| `rejected` \| `suspended` \| `expired`)                        |
| GET            | `/subscriptions/ai-logs`                  | Receipt AI verification log rows                                                               |
| GET            | `/subscriptions/:id`                      | Get one subscription (any status; same DTO as pending-list row)                                |
| GET            | `/subscriptions/:id/receipt-url`          | Signed receipt view URL                                                                        |
| PATCH          | `/subscriptions/:id/approve`              | Approve subscription                                                                           |
| PATCH          | `/subscriptions/:id/reject`               | Reject subscription                                                                            |
| PATCH          | `/subscriptions/:id/suspend`              | Suspend active subscription                                                                    |
| GET/PATCH/POST | `/content/admin/*`                        | Content CRUD, publish, media upload                                                            |
| GET/PATCH/POST | `/announcements/admin/*`                  | Announcement CRUD, publish, image upload                                                       |
| GET/PATCH      | `/support/admin/requests/*`               | Support list, reply, close                                                                     |
| GET/DELETE     | `/devices/admin/users/:userId/bindings/*` | View or reset device bindings                                                                  |
| GET            | `/analytics/admin/dashboard`              | Aggregate dashboard stats (students, subscriptions, support, growth, regions, recent activity) |

**Admin student directory** (`GET /users`) query params (all optional):

| Param                | Type                                                                                                   | Behavior                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `q`                  | string                                                                                                 | Case-insensitive search across `fullName`, `email`, `phoneNumber`, `telegramUsername`               |
| `region`             | `gaza` \| `west_bank`                                                                                  | Exact region match                                                                                  |
| `status`             | `free` \| `pending_review` \| `pending_approval` \| `active` \| `expired` \| `rejected` \| `suspended` | Filter by derived subscription status (latest subscription, or `free` when none)                    |
| `includeDeactivated` | `true` \| `false`                                                                                      | Default `false` — hide soft-blocked students (`deactivatedAt != null`). Pass `true` to include them |
| `page`               | int ≥ 1                                                                                                | Default `1`                                                                                         |
| `pageSize`           | int 1–100                                                                                              | Default `10`                                                                                        |

Response: `{ students, total, page, pageSize }`. Each student row (`StudentListItem`):

| Field                | Type                  | Notes                                          |
| -------------------- | --------------------- | ---------------------------------------------- |
| `id`                 | string (UUID)         | Nest user id                                   |
| `clerkId`            | string                | Linked Clerk user id (always present)          |
| `fullName`           | string                |                                                |
| `email`              | string                |                                                |
| `phone`              | string                | Admin Web name for `phoneNumber`               |
| `telegram`           | string                | Admin Web name for `telegramUsername`          |
| `region`             | `gaza` \| `west_bank` |                                                |
| `subscriptionStatus` | derived               | Latest subscription status, or `free`          |
| `deactivatedAt`      | string \| null        | ISO-8601 when soft-blocked; `null` when active |

**Admin student detail** (`GET /users/:userId`): same list-row DTO for deep links; `404` if missing or not a student. Invalid UUID → Nest `ParseUUIDPipe` `400`.

**Student deactivate / reactivate / delete** (admin-only; students only — admins return `404`):

| Action     | Route                             | Nest                                                                                                 | Clerk              | Response                    |
| ---------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------ | --------------------------- |
| Deactivate | `PATCH /users/:userId/deactivate` | Sets `deactivatedAt` (idempotent if already set)                                                     | `users.banUser`    | Updated `StudentListItem`   |
| Reactivate | `PATCH /users/:userId/reactivate` | Clears `deactivatedAt`                                                                               | `users.unbanUser`  | Updated `StudentListItem`   |
| Delete     | `DELETE /users/:userId`           | Hard-deletes User; Prisma cascades subscriptions, device bindings, support requests, video downloads | `users.deleteUser` | `{ deleted: true, userId }` |

Clerk sync is fail-closed for deactivate/reactivate (Nest rolled back / left unchanged if Clerk fails). If Nest delete succeeds and Clerk delete fails → `502` with `clerkId` logged for manual cleanup (Nest row is **not** recreated). Deactivated students get `403 Student account is deactivated` on registration-required student routes (and on `/users/me` / register upsert). Requires `CLERK_SECRET_KEY` (already required).

**Admin archived decisions** (`GET /subscriptions/archived`): same `AdminSubscriptionListResponse` as pending. Filter: `active` \| `rejected` \| `suspended` \| `expired` (excludes `pending_review` and `pending_approval`). Sort: `updatedAt` desc. Full list (no pagination in v1). Static path registered before `GET /subscriptions/:id`.

**Admin AI logs** (`GET /subscriptions/ai-logs`): `{ logs: AiVerificationLogItem[] }` where each item has `subscriptionId`, `student` (`AdminStudentSummary`), `plan`, `status`, `verificationResult` (`ReceiptVerificationResult` v1 or `null`), `verifiedAt`, `createdAt`, `updatedAt`. Includes any subscription with `verifiedAt` set (failed AI with `error` included). Sort: `verifiedAt` desc, then `updatedAt` desc. Static path registered before `GET /subscriptions/:id`.

**Admin subscription detail** (`GET /subscriptions/:id`): same DTO as a `GET /subscriptions/pending` row (`AdminSubscriptionResponse`) for any status (`pending_review`, `pending_approval`, `active`, `rejected`, `suspended`, `expired`, etc.). `404` if missing. Invalid UUID → Nest `ParseUUIDPipe` `400`. Does **not** return receipt binary or a permanent R2 URL — use `GET /subscriptions/:id/receipt-url` for signed viewing.

**`verificationResult` JSON** (written by `ReceiptVerificationService` into `subscriptions.verification_result`; `null` until verification runs). Canonical TypeScript type: `ReceiptVerificationResult` in `src/modules/subscriptions/types/receipt-verification-result.types.ts`.

| Field                   | Meaning                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| `version`               | Always `1` for the current schema                                              |
| `passed`                | Overall pass when recipient, sender, and not-duplicate checks all pass         |
| `verifiedAt`            | ISO-8601 timestamp when verification ran                                       |
| `aiEnabled`             | `false` when `RECEIPT_AI_ENABLED=false` (skip path); `true` when Gemini ran    |
| `model`                 | e.g. `gemini-3.5-flash` when AI ran; `null` when skipped                       |
| `error`                 | Pipeline/Gemini failure message; `null` on success                             |
| `checks.recipientMatch` | `{ passed, detected, reason }` — payee vs expected teacher names               |
| `checks.senderMatch`    | `{ passed, detected, expected?, reason }` — payer vs student-entered sender    |
| `checks.notDuplicate`   | `{ passed, detected, transactionReference, reason }` — txn id + duplicate flag |
| `notes`                 | Gemini free-text notes, or skip-mode explanation                               |

Example (passing AI run):

```json
{
  "version": 1,
  "passed": true,
  "verifiedAt": "2026-07-01T10:00:00.000Z",
  "aiEnabled": true,
  "model": "gemini-3.5-flash",
  "error": null,
  "checks": {
    "recipientMatch": {
      "passed": true,
      "detected": "Teacher Name",
      "reason": null
    },
    "senderMatch": {
      "passed": true,
      "detected": "Sender Name",
      "expected": "Sender Name",
      "reason": null
    },
    "notDuplicate": {
      "passed": true,
      "detected": "TX-123",
      "transactionReference": "TX-123",
      "reason": null
    }
  },
  "notes": null
}
```

**Device headers** (required on device-bound routes):

```
X-Device-Id: <16–128 char identifier>
X-Device-Type: web | mobile
```

---

## Domain Rules

- **Roles:** `student` and `admin` only — resolved server-side from the database
- **Regions:** `gaza`, `west_bank` (students); content/announcements also support `both`
- **Registration:** Students register as free users first; paid access requires an approved active subscription
- **Student lifecycle:** Deactivate = soft block (`deactivatedAt` + Clerk ban); Delete = hard remove Nest user (cascade student-owned rows) + Clerk user delete. Nest `clerkId` is always required and kept in sync with Clerk
- **Content access:** Preview lessons are free by region; subscriber-only lessons require an active non-expired subscription
- **Devices:** One web + one mobile device per student; identifiers stored as hashes only
- **Notifications:** In-app rows on lesson/announcement publish (region-targeted); Expo push stubbed until Mobile registers tokens (`PUSH_NOTIFICATIONS_ENABLED=false`)
- **Downloads:** Mobile-only; short-lived signed URLs; revocable on admin device reset
- **Receipts:** Admin-only access; AI verification with duplicate transaction reference enforcement
- **Files:** All private media served via server-generated signed URLs — never public permanent URLs

---

## Database Models

| Model                         | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `User`                        | Local user profile linked to Clerk               |
| `SubscriptionPlan`            | Pricing and duration plans                       |
| `Subscription`                | Subscription lifecycle (one open state per user) |
| `Unit` / `Chapter` / `Lesson` | Content hierarchy                                |
| `LessonVideo` / `LessonPdf`   | Lesson media attachments                         |
| `Announcement`                | Region-targeted announcements                    |
| `SupportRequest`              | Student support tickets                          |
| `DeviceBinding`               | Web/mobile device registrations (+ optional push token) |
| `Notification`                | In-app notification inbox per student                   |
| `VideoDownload`               | Mobile download authorization records                   |

Prisma client is generated to `src/generated/prisma`.

---

## Background Jobs

| Scheduler                           | Interval         | Action                                                 |
| ----------------------------------- | ---------------- | ------------------------------------------------------ |
| `SubscriptionExpiryScheduler`       | Every hour       | Expire active/suspended subscriptions past `expiresAt` |
| `ReceiptVerificationRetryScheduler` | Every 10 minutes | Retry failed AI receipt verifications                  |

---

## Getting Started

### Prerequisites

- Node.js >= 22
- PostgreSQL database
- Clerk application (secret key, publishable key, JWT key)
- Cloudflare R2 bucket (or S3-compatible storage)

### Install

```bash
npm install
cp .env.example .env
# Fill in .env values — see context/env-contract.md for full reference
```

### Database

```bash
npx prisma migrate dev
npx prisma db seed   # optional: seed admin user

# Upsert a student from a Clerk user id (fetches email/name from Clerk)
npm run seed:student -- --clerkId user_xxx --region gaza
```

### Run

```bash
# Development (watch mode)
npm run start:dev

# Production build
npm run build
npm run start:prod
```

The API listens on `PORT` (default `3000`).

### Test

```bash
npm test           # unit tests
npm run test:cov   # with coverage
npm run test:e2e   # end-to-end
```

---

## Environment Variables

Copy `.env.example` and configure. Key groups:

| Group    | Variables                                         | Notes                                                                |
| -------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| Core     | `PORT`, `NODE_ENV`, `LOG_LEVEL`, `DATABASE_URL`   | Always required                                                      |
| Auth     | `CLERK_*`, `CORS_ORIGINS`                         | `CORS_ORIGINS` and `CLERK_AUTHORIZED_PARTIES` required in production |
| Storage  | `R2_*`                                            | Cloudflare R2 credentials and bucket                                 |
| Security | `DEVICE_HASH_PEPPER`, `SIGNED_URL_TTL_SECONDS`    | Device hashing and signed URL TTL                                    |
| Optional | `POSTHOG_*`, `ARCJET_*`, `RECEIPT_AI_*`, `CONTENT_SEARCH_AI_ENABLED`, `MAIL_*`, `PUSH_NOTIFICATIONS_ENABLED` | Feature-flagged via `*_ENABLED` vars |

Full contract: [`context/env-contract.md`](context/env-contract.md)

---

## Postman

A ready-made collection is in `postman/`:

```
postman/
├── Mulhim Backend.postman_collection.json
├── Mulhim Backend Local.postman_environment.json
└── generate-collection.mjs   # Regenerator script
```

Import the collection and environment into Postman. Paste Clerk JWTs into `{{studentBearerToken}}` and `{{adminBearerToken}}`. Device-bound routes use `{{deviceId}}` and `{{deviceType}}`.

---

## Security

- **Clerk** is the only authentication provider — every protected route verifies the session token
- **Arcjet** protects abuse-prone endpoints (rate limits, bot detection) — currently `DRY_RUN`, flip to `LIVE` after dashboard verification. Content search uses the `content-search` profile (30 req/min/user), separate from `admin-mutation`.
- **Role, region, subscription, and device state** are never trusted from client payloads
- **Receipt files** are admin-only via signed URLs
- **Device identifiers** are hashed with a server-side pepper before storage
- **Production startup** fails fast if `CORS_ORIGINS` or `CLERK_AUTHORIZED_PARTIES` are empty

---

## Analytics Events

PostHog lifecycle events (when `POSTHOG_ENABLED=true`):

`subscription_submitted`, `subscription_approved`, `subscription_rejected`, `subscription_suspended`, `subscription_expired`, and others across auth, content, and support flows.

---

## Deployment Checklist

1. Apply all Prisma migrations (including `20250701130000_add_receipt_transaction_reference` and `20260712150000_add_user_deactivated_at`)
2. Set production env vars — especially `DEVICE_HASH_PEPPER`, `CORS_ORIGINS`, `CLERK_AUTHORIZED_PARTIES`, `CLERK_SECRET_KEY`
3. Configure Clerk session token to include the `email` claim (required for registration)
4. Enable and verify Arcjet in dashboard, then switch profiles from `DRY_RUN` to `LIVE` in `src/lib/arcjet/arcjet.profiles.ts`
5. Enable PostHog, mail, and receipt AI as needed via feature flags
6. Build and deploy: `npm run build && npm run start:prod`

---

## Documentation

Detailed project docs live in `context/`:

| File                                                         | Contents                               |
| ------------------------------------------------------------ | -------------------------------------- |
| [`context/project-overview.md`](context/project-overview.md) | Product scope and client dependencies  |
| [`context/architecture.md`](context/architecture.md)         | Stack, module boundaries, request flow |
| [`context/domain-rules.md`](context/domain-rules.md)         | Business rules and lifecycle flows     |
| [`context/env-contract.md`](context/env-contract.md)         | Environment variable reference         |
| [`context/build-plan.md`](context/build-plan.md)             | Original 17-step build plan            |
| [`context/progress-tracker.md`](context/progress-tracker.md) | Completed steps and decisions          |
| [`context/code-standards.md`](context/code-standards.md)     | Coding conventions                     |
| [`AGENTS.md`](AGENTS.md)                                     | AI agent instructions for this repo    |

---

## License

UNLICENSED — private project.
