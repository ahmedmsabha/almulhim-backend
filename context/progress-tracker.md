# Progress Tracker

Update this file after every completed backend feature.

---

## Current Status

**Phase:** 3 — Subscriptions
**Last completed:** 07 Receipt Submission
**Next:** 08 Receipt Verification

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
- [ ] 08 Receipt Verification
- [ ] 09 Admin Review

### Phase 4 — Content

- [ ] 10 Content Read APIs
- [ ] 11 Content Admin APIs
- [ ] 12 Announcements and Support

### Phase 5 — Devices and Downloads

- [ ] 13 Device Binding
- [ ] 14 Secure Downloads

### Phase 6 — Hardening

- [ ] 15 Analytics
- [ ] 16 Arcjet Protection
- [ ] 17 Final Review

---

## Decisions Made During Build

- **Bootstrap env validation (step 01):** Validate only `PORT`, `NODE_ENV`, and `LOG_LEVEL` at startup. Full `env-contract.md` validation deferred to step 02 when infra clients are wired.
- **Infrastructure env validation (step 02):** Validate vars for wired integrations only (`DATABASE_URL`, Clerk, R2, PostHog, Arcjet). Mail, AI, and app URL vars deferred to later steps. `POSTHOG_ENABLED` and `ARCJET_ENABLED` default to `false`; keys required only when enabled.
- **Prisma version (step 02):** Upgraded to Prisma 7.x with `@prisma/adapter-pg`, `prisma.config.ts`, generated client at `src/generated/prisma`, `moduleFormat = "cjs"` for NestJS.
- **DB health check (step 03):** `/health` now runs `SELECT 1` via Prisma; returns `database: 'up'` or 503 with `database: 'down'`.
- **Subscription model (step 03):** One row per lifecycle attempt; partial unique index enforces one open state per user (`pending_review`, `pending_approval`, `active`, `suspended`); receipt fields live on the subscription row in v1.
- **Auth module (step 04):** Global `ClerkAuthGuard` with `@Public()` opt-out; `RolesGuard` resolves local `users.role` from DB when `@Roles()` is present; `@ClerkUserId()` and `@CurrentUser()` decorators; admin seed via `prisma db seed`.
- **Users module (step 05):** `POST /users/register` (Zod-validated profile fields, `clerkId` + email from JWT); `GET /users/me` (404 if unregistered); `GET /users` admin-only student list; `@ClerkEmail()` decorator; email extracted from JWT `email` claim when present.
- **Plans module (step 06):** `GET /plans/public` (`@Public()`, active plans, name + price only); `GET /plans` (authenticated, active plans, full subscribe fields); `GET /plans/all` (admin, all plans); `POST /plans` and `PATCH /plans/:id` (admin create/update/disable via `isActive`); lives in `src/modules/subscriptions/`.
- **Receipt submission (step 07):** two-step presigned PUT flow — `POST /subscriptions/receipt-upload-url` (server-generated key, JPEG/PNG/WebP, 5 MB max, 15 min TTL); client uploads to R2; `POST /subscriptions` (planId, senderName, receiptStorageKey) creates `pending_review` row after HeadObject validation; `GET /subscriptions/me` returns open subscription; PostHog `subscription_submitted` on success; Arcjet deferred to step 16.

---

## Notes

- Step 02 review fixes applied: `env-contract.md` and `library-docs.md` synced, `.env.example` placeholders, `objectExists` error handling, `@clerk/shared` direct dep, env schema tests, removed dead `BootstrapEnv` alias.
