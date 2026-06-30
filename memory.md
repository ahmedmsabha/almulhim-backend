# Memory — Phase 3 Step 07 Receipt Submission

Last updated: 2026-06-30

## What was built

- **Receipt submission (step 07):** `SubscriptionsController`, `SubscriptionsService`, Zod schemas, response types, constants, unit tests in `src/modules/subscriptions/`.
- **Endpoints:** `POST /subscriptions/receipt-upload-url` (presigned PUT + server key); `POST /subscriptions` (planId, senderName, receiptStorageKey → `pending_review`); `GET /subscriptions/me` (open subscription).
- **R2 storage:** `createSignedPutUrl()` and `headObject()` added to `src/lib/storage/r2-storage.service.ts`.
- **Ops:** `cors.json` for R2 bucket `almulhim`; CORS applied via `npx wrangler` for local dev PUT uploads.
- **Context:** `context/progress-tracker.md` step 07 complete; `context/library-docs.md` updated with R2 presigned URL + Wrangler 4.x CORS `rules` format.

## Decisions made

- **Two-step presigned PUT** — client uploads to R2 directly; API receives metadata only.
- **File constraints** — JPEG/PNG/WebP, max 5 MB, 15 min presigned TTL; validated via HeadObject on submit.
- **Key format** — `receipts/{userId}/{uuid}.{ext}`; strict regex validation on submit.
- **No receipt URL in student responses** — admin-only access later (step 09).
- **PostHog** — `subscription_submitted` on successful POST (when enabled).
- **Arcjet on receipt routes** — deferred to step 16.

## Problems solved

- **Wrangler CORS format:** Dashboard PascalCase array rejected by Wrangler 4.x; must use `{ "rules": [{ "allowed": { "origins", "methods", "headers" } }] }` R2 API shape.
- **Wrangler not global:** Use `npx wrangler` (not bare `wrangler`); login once via `npx wrangler login`.
- **Bugbot review fixes:** P2002 mapped by constraint target (open subscription vs duplicate receipt key); pre-check receipt key reuse; block upload URL when open subscription exists; reject zero-byte files; strict key regex.

## Current state

- **Phase 3:** step 07 done; next is step 08 Receipt Verification.
- **Local:** build passes; 71+ tests pass (19 subscription service tests after review fixes).
- **R2 CORS:** Applied on bucket `almulhim` for localhost ports 3000/3001/5173 — verified via `npx wrangler r2 bucket cors list almulhim`.
- **Remote DB:** schema unchanged from step 03; no plan seed data.
- **Clerk:** Session token must include `{"email": "{{user.primary_email_address}}"}` for registration.
- **Compute:** Still crash-looping from prior work (env vars + Arcjet bundling) — unrelated to step 07.

## Next session starts with

1. Run `/remember restore`.
2. `/architect Phase 3, step 08` (Receipt Verification) — AI verification via Gemini, persist structured result, move passing items to `pending_approval`.

## Open questions

- **Production CORS origins:** Add student/admin web URLs to `cors.json` when frontend URLs are known.
- **`authorizedParties` for Clerk:** Still not configured — deferred from step 04.
- **Migration housekeeping:** `_prisma_migrations` may still need init migration resolved after advisory lock clears.
- **Compute redeploy:** Production env vars + Arcjet bundling still pending.
- **Plan seed data:** Table may be empty until admin creates plans.
- **`.env` gap:** `R2_PUBLIC_BASE_URL` required by env schema but not in local `.env` — may block startup if not set.
