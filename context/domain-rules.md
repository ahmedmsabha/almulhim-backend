# Domain Rules

## Roles

Supported roles:

- `student`
- `admin`

Role checks happen on the server only.

---

## Registration

Student registration fields:

- full name
- email
- password
- phone number
- Telegram username
- region

Allowed student regions:

- `gaza`
- `west_bank`

---

## Content Hierarchy

```txt
Unit
└── Chapter
    └── Lesson
        ├── Video
        └── PDF
```

---

## Region Targeting

Content region values:

- `gaza`
- `west_bank`
- `both`

Visibility rules:

- student sees content for their exact region
- student also sees content targeted to `both`
- the same logic applies to announcements

---

## Lesson Access

A lesson may be:

- preview
- subscriber-only

Access rules:

- preview content is visible to eligible students by region
- locked content requires an active subscription
- publication state must also be respected

---

## Subscription Lifecycle

Flow:

1. student starts as free
2. student selects a subscription plan
3. student uploads a receipt
4. student enters sender name
5. system stores the receipt
6. system performs AI verification
7. passing receipts move to `pending_approval`
8. admin approves or rejects
9. approved requests become `active`

Statuses:

- `free` — implicit when the student has no open subscription row (not stored in the database)
- `pending_review`
- `pending_approval`
- `active`
- `expired`
- `rejected`
- `suspended`

Archived decisions (admin): non-pending statuses `active` | `rejected` | `suspended` | `expired`.

---

## Student Account Lifecycle

- **Deactivate (soft block):** set `users.deactivated_at`, ban the linked Clerk user. Nest row remains. Student routes return 403.
- **Reactivate:** unban Clerk, clear `deactivated_at`.
- **Delete (hard):** delete Nest student User (Prisma cascades subscriptions, devices, support, downloads, notifications), then delete the Clerk user. Irreversible. Admins cannot be deleted via these routes.
- Every student User has a required unique `clerkId`. Keep Nest ↔ Clerk in sync (fail-closed on deactivate/reactivate).

---

## Receipt Validation

The system must verify:

- recipient matches expected teacher name
- sender name matches entered sender name
- receipt is not duplicated

---

## Device Binding

Each student is limited to:

- one web device binding
- one mobile device binding

Rules:

- store hashed device identifiers only
- validate device binding on the server
- admin can reset bindings manually
- mobile bindings may store an Expo `pushToken` for future push delivery

---

## Notifications

- Publishing a lesson or announcement creates in-app `Notification` rows for matching active students.
- Region targeting: content `gaza`/`west_bank` → students in that region; content `both` → all active students. Deactivated students are excluded.
- Push send is gated by `PUSH_NOTIFICATIONS_ENABLED`. When enabled, Nest sends Expo pushes (chunked via `expo-server-sdk`) to mobile bindings that have a registered token from `POST /notifications/register-token`. Payload `data` includes `{ type, entityId }` for mobile deep links. `DeviceNotRegistered` clears the binding `pushToken`.
- Notification failures must never block publish responses (`notifyRegion` swallows errors).

---

## Video Rules

- mobile download is mobile-only
- downloaded files must remain in private app storage
- paid videos never use public permanent URLs
- signed access is generated server-side only

Playback watermark policy:

- full name
- last 4 digits of phone number
- current timestamp

Watermark is the primary anti-leak mechanism.

---

## Support Rules

There is no in-platform live chat.

Allowed flow:

- student submits support request
- admin reviews it
- follow-up can happen outside the platform if needed

Support statuses:

- `open`
- `reviewed`
- `closed`

## Support Delivery

When a student submits a support request:

- the request is stored in the database
- the teacher receives an email notification
- the request remains visible in the admin dashboard

When admin replies:

- the reply can be sent to the student's email
- the support request status is updated server-side
