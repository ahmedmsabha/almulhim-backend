# Progress Tracker

Update this file after every completed backend feature.

---

## Current Status

**Phase:** 6 — Hardening
**Last completed:** Notifications backend foundation (in-app inbox + publish fan-out; Expo push stubbed)
**Next:** Wire Student Web/Mobile to notification endpoints; implement Expo chunked send when tokens exist; flip Arcjet `DRY_RUN` → `LIVE` after dashboard verification

---

## Progress

### Phase 1 — Foundation

- [x] 01 Project Bootstrap
- [x] 02 Infrastructure
- [x] 03 Database Schema

### Phase 2 — Auth and Users

- [x] 04 Auth Module
- [x] 05 Users Module

### Phase 3 — Subscriptions

- [x] 06 Plans
- [x] 07 Receipt Submission
- [x] 08 Receipt Verification
- [x] 09 Admin Review

### Phase 4 — Content

- [x] 10 Content Read APIs
- [x] 11 Content Admin APIs
- [x] 12 Announcements and Support

### Phase 5 — Devices and Downloads

- [x] 13 Device Binding
- [x] 14 Secure Downloads

### Phase 6 — Hardening

- [x] 15 Analytics
- [x] 16 Arcjet Protection
- [x] 17 Final Review
- [x] 18 Notifications foundation (in-app + publish wiring; push stub)

---

## Decisions Made During Build

- **Bootstrap env validation (step 01):** Validate only `PORT`, `NODE_ENV`, and `LOG_LEVEL` at startup. Full `env-contract.md` validation deferred to step 02 when infra clients are wired.
- **Infrastructure env validation (step 02):** Validate vars for wired integrations only (`DATABASE_URL`, Clerk, R2, PostHog, Arcjet). Mail, AI, and app URL vars deferred to later steps. `POSTHOG_ENABLED` and `ARCJET_ENABLED` default to `false`; keys required only when enabled.
- **Prisma version (step 02):** Upgraded to Prisma 7.x with `@prisma/adapter-pg`, `prisma.config.ts`, generated client at `src/generated/prisma`, `moduleFormat = "cjs"` for NestJS.
- **DB health check (step 03):** `/health` now runs `SELECT 1` via Prisma; returns `database: 'up'` or 503 with `database: 'down'`.
- **Subscription model (step 03):** One row per lifecycle attempt; partial unique index enforces one open state per user (`pending_review`, `pending_approval`, `active`, `suspended`); receipt fields live on the subscription row in v1.
- **Auth module (step 04):** Global `ClerkAuthGuard` with `@Public()` opt-out; `RolesGuard` resolves local `users.role` from DB when `@Roles()` is present; `@ClerkUserId()` and `@CurrentUser()` decorators; admin seed via `prisma db seed`.
- **Users module (step 05):** `POST /users/register` (Zod-validated profile fields, `clerkId` + email from JWT); `GET /users/me` (404 if unregistered); `GET /users` admin-only student directory (search/filter/paginate); `@ClerkEmail()` decorator; email extracted from JWT `email` claim when present.
- **Plans module (step 06):** `GET /plans/public` (`@Public()`, active plans, name + price only); `GET /plans` (authenticated, active plans, full subscribe fields); `GET /plans/all` (admin, all plans); `POST /plans` and `PATCH /plans/:id` (admin create/update/disable via `isActive`); lives in `src/modules/subscriptions/`.
- **Receipt submission (step 07):** two-step presigned PUT flow — `POST /subscriptions/receipt-upload-url` (server-generated key, JPEG/PNG/WebP, 5 MB max, 15 min TTL); client uploads to R2; `POST /subscriptions` (planId, senderName, receiptStorageKey) creates `pending_review` row after HeadObject validation; `GET /subscriptions/me` returns open subscription; PostHog `subscription_submitted` on success; Arcjet deferred to step 16.
- **Receipt verification (step 08):** fire-and-forget after submit via `ReceiptVerificationService`; Gemini (`gemini-3.1-flash-lite`) through Vercel AI SDK in `src/lib/ai/`; structured result in `verification_result` + `verified_at`; passing checks move to `pending_approval`, failures stay `pending_review` for admin override in step 09; duplicate transaction refs enforced by unique `receipt_transaction_reference` column with persist-time re-check and P2002 handling; `RECEIPT_AI_ENABLED=false` auto-promotes to `pending_approval` for local dev.
- **Admin review (step 09):** `AdminSubscriptionsService` + `AdminSubscriptionsController` in `subscriptions` module; `GET /subscriptions/pending` (oldest-first, full student + plan + verificationResult); `GET /subscriptions/:id` (any status, same admin DTO as pending-list row); `GET /subscriptions/:id/receipt-url` (15-min signed GET URL, admin-only); `PATCH /subscriptions/:id/approve` (any pending → active, sets `approvedAt` + `expiresAt`); `PATCH /subscriptions/:id/reject` (any pending → rejected, optional `rejectionReason`); `PATCH /subscriptions/:id/suspend` (active-only → suspended); `SubscriptionExpiryScheduler` runs `@Cron(EVERY_HOUR)` and bulk-updates active rows with `expiresAt <= now` to `expired`; `@nestjs/schedule` + `ScheduleModule.forRoot()` in `AppModule`; PostHog events `subscription_approved`, `subscription_rejected`, `subscription_suspended` with student `userId` as `distinctId`.
- **Content read APIs (step 10):** new `src/modules/content/` module; `GET /content/tree` (full nested units → chapters → lessons for mobile sync); `GET /content/units`, `GET /content/units/:id`, `GET /content/chapters/:id`, `GET /content/lessons/:id` for web navigation; all routes require auth + registered user; region filter on units (`user.region` or `both`); publication cascade (unit/chapter/lesson all `isPublished`); `isLocked` on lessons (`preview` always unlocked, `subscriber_only` requires `active` subscription with `expiresAt > now`); locked lessons included with safe metadata only, empty `videos`/`pdfs`; unlocked lesson detail includes media metadata without `storageKey`; invisible content returns 404.
- **Audit hardening (post step 10):** `RegisteredUserGuard` + `@RequiresRegistration()` populate `@CurrentUser()` on student routes; duplicate transaction refs loaded from column + `verification_result` JSON; receipt re-validated via `headObject` before AI read; `ReceiptVerificationRetryScheduler` every 10 minutes; admin can reject `suspended` subscriptions; expiry cron covers `active` + `suspended`; approve checks duplicate refs; `POST /users/register` upserts profile; CORS + `CLERK_AUTHORIZED_PARTIES` env support; student-only guard on content/subscription routes.
- **Content admin APIs (step 11):** `AdminContentController` + `AdminContentService` under `/content/admin/*`; admin tree + detail reads include drafts and publish metadata; CRUD for units/chapters/lessons; explicit publish/unpublish per entity; two-step media upload (presigned PUT → attach) for MP4 video (1 GB max) and PDF (50 MB max); server-generated keys under `videos/{lessonId}/` and `pdfs/{lessonId}/`; `headObject` validation on attach; media metadata PATCH; `@Roles('admin')` only; Arcjet deferred to step 16.
- **Content media delete:** `DELETE /content/admin/videos/:id` and `DELETE /content/admin/pdfs/:id`; R2 delete best-effort first, then always delete DB row; returns `{ deleted: true, id }`.
- **Announcements and Support (step 12):** new `src/modules/announcements/` and `src/modules/support/` modules; `src/lib/mail/` with Nodemailer + `MAIL_ENABLED` flag; student `GET /announcements` (region-filtered published feed with signed image URLs); admin `/announcements/admin/*` CRUD + publish/unpublish + image upload (`announcements/{announcementId}/{uuid}.{ext}`, JPEG/PNG/WebP, 5 MB max); student `POST /support` + `GET /support/me`; admin `/support/admin/requests/*` list/detail/reply/close; support emails non-blocking on delivery failure; Arcjet deferred to step 16.
- **Device binding (step 13):** new `src/modules/devices/` + `src/lib/devices/` (`DeviceHashService` with `DEVICE_HASH_PEPPER`); student `POST /devices/bind`, `GET /devices/me`, `POST /devices/heartbeat` (`@RequiresDeviceBinding()` guard only on heartbeat); admin `/devices/admin/users/:userId/bindings` list + reset one/all; `deviceIdentifier` validated as 16–128 chars; headers `X-Device-Id` + `X-Device-Type` for guard; `DeviceBindingGuard` exported for step 14; Arcjet deferred to step 16.
- **Secure downloads (step 14):** new `src/modules/downloads/` module; mobile-only `POST /downloads/videos/:lessonVideoId/authorize` (presigned GET URL + `video_downloads` upsert) and device-scoped `GET /downloads/me` sync (`downloadedAt`, `revokedAt`, `isRevoked`, `isAccessValid`); `@RequiresDeviceBinding()` on both routes; reuses content access rules (region, publish cascade, subscription lock); `SIGNED_URL_TTL_SECONDS` env (default 900); admin mobile device reset and reset-all revoke matching `video_downloads`; Arcjet deferred to step 16.
- **Mobile-only download policy (post step 14 security review):** no App Attest / Play Integrity during testing/pre-store phase; enforcement is device binding + short-lived signed URLs + revocation + client watermarking. Platform attestation deferred until store distribution.
- **Analytics (step 15):** global `src/lib/analytics/` (`AnalyticsModule` + typed `AnalyticsService`) wraps `PostHogService`; 10 high-signal lifecycle events instrumented; `subscription_expired` uses guarded per-row `updateMany` (capture only when `count === 1`) to avoid double-fire on cron rerun; operational logging unchanged.
- **Arcjet protection (step 16):** `@Global()` `ArcjetModule` with profile-based `ArcjetService` clients (`withRule` per abuse profile); `@ArcjetProtect(profile)` metadata + global `ArcjetProtectGuard` (`APP_GUARD` after Clerk, before registration/roles/device guards); all rules `DRY_RUN` until dashboard verification; rate limits keyed on `userId`; bot deny on student writes (`CATEGORY:AI`, `CURL`); fail-open on Arcjet errors; route matrix in `library-docs.md`; receipt AI guard deferred.
- **Final review (step 17):** env/permission/storage/module-boundary audits; production fail-fast for empty `CORS_ORIGINS` and `CLERK_AUTHORIZED_PARTIES`; removed unused `AuthModule` imports; moved `RegisteredUserGuard` and `RolesGuard` to `src/modules/auth/guards/`; synced `architecture.md` and `env-contract.md`.
- **Admin analytics dashboard (post step 17):** `src/modules/analytics/` with `GET /analytics/admin/dashboard`; `@Roles('admin')` + global Clerk auth; Prisma aggregates for students/subscriptions/support/region/growth; recent activity from subscriptions + support requests; PostHog remains capture-only (no Mulhim lifecycle events in project yet for read-back).
- **Admin student directory (post step 17):** `GET /users` accepts optional `q` / `region` / `status` / `page` / `pageSize`; Zod-validated; returns `{ students, total, page, pageSize }`; list DTO uses Admin Web names (`phone`, `telegram`) + derived `subscriptionStatus` (latest subscription row, else `free`); non-`free` status filter uses SQL lateral join on latest subscription; `GET /users/:userId` returns the same list-row DTO for deep links (`404` if missing or not a student).
- **Admin subscription detail (post step 17):** `GET /subscriptions/:id` returns the same `AdminSubscriptionResponse` as pending-list rows for any status; documents stored `verificationResult` (`ReceiptVerificationResult` v1) for Admin Web AI panel; receipt viewing stays on `GET /subscriptions/:id/receipt-url`.
- **Admin student lifecycle (post step 17):** `User.deactivatedAt` soft-block; `PATCH /users/:userId/deactivate` (Nest + Clerk ban, fail-closed rollback), `PATCH /users/:userId/reactivate` (Clerk unban then clear Nest), `DELETE /users/:userId` (Nest cascade then Clerk delete; Nest-ok/Clerk-fail → 502); admin student DTO adds `clerkId` + `deactivatedAt`; `GET /users` excludes deactivated by default (`includeDeactivated=true` to include); `RegisteredUserGuard` returns 403 for deactivated students.
- **Admin subscriptions Archived + AI Logs (post step 17):** `GET /subscriptions/archived` (non-pending statuses, `updatedAt` desc); `GET /subscriptions/ai-logs` (`verifiedAt` set, includes failed AI payloads); static paths registered before `:id`.
- **Shared content search (post step 17):** `POST /content/search` for any registered user (method-level `@RequiresRegistration()` clears class `studentOnly`); client sends authorized flattened `items[]`; Gemini matching via `AiProviderService.searchContentItems` (`CONTENT_SEARCH_MODEL` = `gemini-3.1-flash-lite`); hard post-filter so `matchingIds ⊆ request ids`; `CONTENT_SEARCH_AI_ENABLED` separate from receipt AI; Arcjet `content-search` profile (30/min/user); AI disabled/failure → `503` (hard fail for client local fallback).
- **Notifications foundation (post step 17):** `Notification` model + `DeviceBinding.pushToken`; `NotificationsModule` with list/unread/mark-read/register-token; `notifyRegion` fan-out on lesson + announcement publish (region-targeted, excludes deactivated); `PUSH_NOTIFICATIONS_ENABLED` defaults false; Expo push send via `expo-server-sdk` (chunked) when enabled, with `DeviceNotRegistered` token cleanup and `{ type, entityId }` deep-link data.
- **AI model cost switch (post step 17):** Receipt + content search models moved from `gemini-3.5-flash` ($1.50/$9 per 1M) to `gemini-3.1-flash-lite` ($0.25/$1.50 per 1M) to stretch free tier; still multimodal + structured output.

---

## Notes

- Step 02 review fixes applied: `env-contract.md` and `library-docs.md` synced, `.env.example` placeholders, `objectExists` error handling, `@clerk/shared` direct dep, env schema tests, removed dead `BootstrapEnv` alias.
