# Memory — Notifications Backend Foundation

Last updated: 2026-07-13

## What was built

- **Schema:** `Notification` model + `DeviceBinding.pushToken`; migration `20260713091752_add_notifications` applied
- **Module:** `src/modules/notifications/` — service, controller, Zod schemas, response types, unit tests
- **Endpoints (student, registered):**
  - `GET /notifications` (paginated, newest first)
  - `GET /notifications/unread-count`
  - `PATCH /notifications/:id/read`
  - `PATCH /notifications/read-all`
  - `POST /notifications/register-token` (`{ pushToken, deviceType: 'mobile' }` → updates existing mobile `DeviceBinding`)
- **Publish wiring:** `AdminContentService.publishLesson` and `AdminAnnouncementsService.publish` call `notifyRegion` after DB update
- **Env:** `PUSH_NOTIFICATIONS_ENABLED` defaults `false`; `expo-server-sdk` installed but Expo send intentionally stubbed
- **Docs:** README, `architecture.md`, `domain-rules.md`, `env-contract.md`, `progress-tracker.md` updated
- **Review:** Bugbot found no bugs on branch changes

## Decisions made

- Student regions are only `gaza` | `west_bank` (no `both`). Fan-out: content region `gaza`/`west_bank` → matching students; `both` → all active students. Deactivated students excluded.
- Lesson region resolved from `lesson.chapter.unit.region` (lessons have no region column).
- `notifyRegion` swallows all errors so publish never fails due to notifications.
- Push send left as TODO stub until Mobile registers real Expo tokens and can be tested end-to-end.
- `register-token` requires an existing mobile device binding (404 if missing) — does not create a binding from a token alone.
- Followed project schema conventions (`@map` / `@@map` / UUID) rather than the raw sketch shape.

## Problems solved

- Controller unit test needed `jest.mock('./notifications.service')` before importing controller (Prisma generated client path issue under Jest).

## Current state

- Feature complete in code; migration applied on the connected Prisma Postgres DB.
- Push path is a no-op by design (`PUSH_NOTIFICATIONS_ENABLED=false`, zero tokens).
- Large uncommitted working tree remains (this feature + prior admin lifecycle / Arcjet / content work).
- Local `npm run start` may still need a restart to pick up new routes.

## Next session starts with

1. Run `/remember restore`.
2. Restart the API if needed, then verify publish → `Notification` rows (Prisma Studio / query) and student inbox endpoints with a seeded student token.
3. Optionally regenerate Postman collection to include notification routes; wire Student Web/Mobile consumers later; implement Expo chunked send when Mobile exists.

## Open questions

- Commit / PR strategy for the large uncommitted diff
- When to flip Arcjet `DRY_RUN` → `LIVE`
- When Mobile exists: wire `expo-server-sdk` chunked send and set `PUSH_NOTIFICATIONS_ENABLED=true`
