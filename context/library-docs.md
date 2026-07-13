# Library Docs

Project-specific usage rules for third-party libraries in this backend.

---

## Order of Authority

Before using any library:

1. Check MCP integrations first.
2. Check installed skills referenced by `AGENTS.md`.
3. Use Context7 for the latest official docs.
4. Read this file for project-specific rules.
5. Fall back to general knowledge only if nothing else exists.

Never rely on memory alone for library APIs.

---

## NestJS

Use official NestJS patterns first.

Project rules:

- config lives in `src/config`
- infrastructure clients live in `src/lib`
- feature logic lives in `src/modules`
- shared guards / decorators / filters live in `src/common`

Use `ConfigModule` early and validate env at bootstrap.

---

## Clerk

Use Clerk for backend token verification only.

Project rules:

- verify incoming bearer tokens on the backend
- derive the user identity from the verified token, never from request body
- map Clerk identity to local `users` table
- keep role resolution server-side from the database

Do not build a parallel auth system.

---

## Prisma

Prisma is the only ORM.

**Version:** **7.x** (`prisma` + `@prisma/client` + `@prisma/adapter-pg` + `pg`).

Project rules:

- generator: `prisma-client` with `output = "../src/generated/prisma"` and `moduleFormat = "cjs"` (NestJS CommonJS build)
- CLI config: `prisma.config.ts` at repo root (`datasource.url` from `DATABASE_URL`)
- runtime: `PrismaPg` adapter in `PrismaService` — import client from `src/generated/prisma/client`, not `@prisma/client`
- one Prisma service singleton in `src/lib/database`
- no direct Prisma client creation in feature modules
- schema is the contract source for relational data
- migrations must stay in sync with context decisions
- prefer explicit selects and relations over overly broad queries

---

## Arcjet

Arcjet is used for abuse protection and request hardening.

Project rules:

- integration wiring lives in `src/lib/arcjet`
- `@Global()` `ArcjetModule` exposes `ArcjetService` and `ArcjetProtectGuard`
- route protection is opt-in via `@ArcjetProtect(profile)` metadata on handlers
- `ArcjetProtectGuard` is a global `APP_GUARD` in `AuthModule`, ordered after `ClerkAuthGuard` and before `RegisteredUserGuard`, `RolesGuard`, and route-level guards (e.g. `DeviceBindingGuard`) so abuse limits apply even when later guards would reject the request
- all SDK rules start in `DRY_RUN`; flip to `LIVE` in `src/lib/arcjet/arcjet.profiles.ts` after dashboard verification
- rate limits key on `userId` (`users.id` when registered, otherwise `clerkUserId`)
- Arcjet errors fail open; explicit `DENY` returns 429 (rate limit) or 403 (bot/shield)
- receipt AI verification stays unguarded in v1 (no HTTP request — defer `@arcjet/guard`)

### Profiles

| Profile              | Rules                     | Window / max |
| -------------------- | ------------------------- | ------------ |
| `receipt-submit`     | sliding window + bot deny | 3 / 1h       |
| `receipt-upload-url` | sliding window + bot deny | 10 / 1h      |
| `support-create`     | sliding window + bot deny | 5 / 24h      |
| `download-authorize` | sliding window + bot deny | 30 / 1h      |
| `user-register`      | sliding window + bot deny | 5 / 1h       |
| `device-bind`        | sliding window + bot deny | 10 / 1h      |
| `upload-url`         | sliding window            | 20 / 1h      |
| `admin-mutation`     | sliding window            | 60 / 1m      |
| `content-search`     | sliding window            | 30 / 1m      |

Base rule on every profile client: `shield` (`DRY_RUN`).

### Route coverage

**Student writes**

| Route                                             | Profile              |
| ------------------------------------------------- | -------------------- |
| `POST /users/register`                            | `user-register`      |
| `POST /subscriptions/receipt-upload-url`          | `receipt-upload-url` |
| `POST /subscriptions`                             | `receipt-submit`     |
| `POST /support`                                   | `support-create`     |
| `POST /devices/bind`                              | `device-bind`        |
| `POST /downloads/videos/:lessonVideoId/authorize` | `download-authorize` |

**Shared (student + admin)**

| Route                | Profile          |
| -------------------- | ---------------- |
| `POST /content/search` | `content-search` |

**Admin mutations**

| Route                                                                                           | Profile          |
| ----------------------------------------------------------------------------------------------- | ---------------- |
| `GET /subscriptions/:id/receipt-url`                                                            | `admin-mutation` |
| `PATCH /subscriptions/:id/approve`                                                              | `admin-mutation` |
| `PATCH /subscriptions/:id/reject`                                                               | `admin-mutation` |
| `PATCH /subscriptions/:id/suspend`                                                              | `admin-mutation` |
| `DELETE /devices/admin/users/:userId/bindings/:deviceType`                                      | `admin-mutation` |
| `DELETE /devices/admin/users/:userId/bindings`                                                  | `admin-mutation` |
| `POST /announcements/admin`                                                                     | `admin-mutation` |
| `PATCH /announcements/admin/:id`                                                                | `admin-mutation` |
| `PATCH /announcements/admin/:id/publish`                                                        | `admin-mutation` |
| `PATCH /announcements/admin/:id/unpublish`                                                      | `admin-mutation` |
| `PATCH /announcements/admin/:id/attach-image`                                                   | `admin-mutation` |
| `POST /announcements/admin/:id/image-upload-url`                                                | `upload-url`     |
| `POST /content/admin/units` and all other admin content `POST`/`PATCH` except upload-url routes | `admin-mutation` |
| `POST /content/admin/lessons/:lessonId/videos/upload-url`                                       | `upload-url`     |
| `POST /content/admin/lessons/:lessonId/pdfs/upload-url`                                         | `upload-url`     |
| `PATCH /support/admin/requests/:id/reply`                                                       | `admin-mutation` |
| `PATCH /support/admin/requests/:id/close`                                                       | `admin-mutation` |

**Unprotected (by design)**

- `GET /health`, `GET /plans/public`
- authenticated reads (`GET /content/*`, `GET /announcements`, `GET /subscriptions/me`, etc.)
- admin list/detail reads

Enable locally with `ARCJET_ENABLED=true` and `ARCJET_KEY` in `.env`. Arcjet site: `site_01kwhb0t72frv8nyhaqwd4792t` (team Personal).

---

## Cloudflare R2

R2 is the only file storage provider.

Integration uses the **AWS SDK for JavaScript v3** (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) against the R2 S3-compatible API.

### Client configuration (verified against Cloudflare docs)

```typescript
new S3Client({
  region: 'auto', // required by SDK, unused by R2
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  // Required for R2 + AWS SDK JS v3 ≥ 3.729 — default checksums break presigned PUTs
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});
```

### Presigned URLs

- Generate **server-side only** via `getSignedUrl` + `PutObjectCommand` (upload) or `GetObjectCommand` (download).
- Set `ContentType` on `PutObjectCommand` **and** pass `signableHeaders: new Set(['content-type'])` to `getSignedUrl` — AWS SDK v3 otherwise omits `Content-Type` from the signature. The client **must** send the matching `Content-Type` header or the PUT fails.
- Always set `requestChecksumCalculation: 'WHEN_REQUIRED'` (and `responseChecksumValidation: 'WHEN_REQUIRED'`) on the R2 `S3Client`. Default SDK checksums embed `x-amz-checksum-*` into presigned URLs and commonly produce **403 Access Denied** on client PUTs against R2.
- `expiresIn` is in seconds (receipt uploads: 15 minutes).
- After a presigned PUT, validate the object with `HeadObjectCommand` before persisting the key in the database.

### Browser uploads (receipts)

- Presigned URLs alone are not enough for browser clients — the bucket needs a **CORS policy** allowing the app origin, `PUT`, and `Content-Type`.
- Example CORS rule for Wrangler 4.x / R2 API (`cors.json` uses a top-level `rules` array — not the dashboard PascalCase format):

```json
{
  "rules": [
    {
      "allowed": {
        "origins": ["https://your-student-app.example.com"],
        "methods": ["PUT"],
        "headers": ["Content-Type"]
      },
      "exposeHeaders": ["ETag"],
      "maxAgeSeconds": 3600
    }
  ]
}
```

- Configure via Cloudflare dashboard or `npx wrangler r2 bucket cors set [BUCKET] --file cors.json`.

### Project rules

- buckets and object keys are server-managed
- generate signed URLs server-side only
- receipt images are never public
- paid video files are never public permanent URLs
- file keys are stored in the database, not public URLs as the main source of truth
- receipt key format: `receipts/{userId}/{uuid}.{ext}`

References: [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)

---

## PostHog

Backend uses PostHog for critical product analytics events only.

Integration lives in `src/lib/posthog/` (client) and `src/lib/analytics/` (typed capture layer). `AnalyticsModule` is global — feature modules inject `AnalyticsService` without importing the module.

Client: `posthog-node` with `POSTHOG_PROJECT_TOKEN` + `POSTHOG_HOST` when `POSTHOG_ENABLED=true`. Use the regional ingest host (EU: `https://eu.i.posthog.com`). See [Node.js docs](https://posthog.com/docs/libraries/node).

Allowed backend events:

- `subscription_submitted`
- `subscription_approved`
- `subscription_rejected`
- `subscription_suspended`
- `subscription_expired`
- `user_registered`
- `lesson_published`
- `announcement_published`
- `device_bound`
- `device_reset`

`distinctId` rules:

- student-affecting events → local student `userId`
- admin-only content publish events → admin `clerkId`
- admin actions on a student → student `userId` with `adminClerkId` in properties

Do not spam PostHog with low-value internal noise (reads, heartbeats, signed URLs, verification pipeline steps).

---

## Zod

Zod is the default validation layer for writes.

Project rules:

- request payload schemas live near their owning module
- parse before service write logic
- return friendly validation messages
- do not mix validation styles without reason

---

## AI Provider

AI is used on the backend for receipt verification and content search matching.

Packages: `ai`, `@ai-sdk/google`.

Project rules:

- all AI verification runs in the backend, never in frontend clients
- web and mobile must use the same backend verification flow
- integration wiring lives in `src/lib/ai`
- business orchestration lives in feature modules (`receipt-verification.service.ts`, `content.service.ts`)
- use an internal provider abstraction so the model vendor can change without affecting business logic
- Gemini is the default provider for v1 through the Vercel AI SDK
  - Receipts: `RECEIPT_VERIFICATION_MODEL` = `gemini-3.5-flash`
  - Content search: `CONTENT_SEARCH_MODEL` = `gemini-3.5-flash`
- prompts stay server-side only
- always persist structured verification output in `subscriptions.verification_result`
- admin remains the final decision maker — failed AI checks stay in `pending_review` until step 09
- `RECEIPT_AI_ENABLED=false` skips Gemini and auto-promotes to `pending_approval` for local dev
- `CONTENT_SEARCH_AI_ENABLED=false` returns `503` on `POST /content/search` (hard fail; clients keep local substring fallback)
- content search is a pure matching layer over client-supplied authorized item ids — never load the Prisma tree for search; always post-filter AI ids to the request set
- receipt images are fetched from R2 with `getObject`, never sent to clients for verification

---

## Context7 Usage

Use Context7 by default for:

- NestJS
- Clerk
- Prisma
- PostHog
- Arcjet
- any library with fast-moving APIs

If this file conflicts with current official docs, update this file after implementation.

## Nodemailer

Nodemailer is used for transactional email in this backend.

Project rules:

- integration wiring lives in `src/lib/mail`
- use it for support request notifications and admin replies
- keep transport configuration in env only
- do not hardcode sender or recipient addresses
- always persist the support request even if email delivery fails
- email sending must not replace admin dashboard visibility
- return a safe response to clients even when notification delivery partially fails
