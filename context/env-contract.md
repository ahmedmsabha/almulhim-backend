# Env Contract

All secrets stay server-side only.

Validation is implemented in `src/config/env.schema.ts`. Keep this file in sync with that schema.

---

## Required at startup (Phase 1 — step 02)

Always validated when the app boots:

```env
PORT=
NODE_ENV=
LOG_LEVEL=

DATABASE_URL=

CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
CLERK_JWT_KEY=
# Comma-separated allowed origins for Clerk session tokens (production recommended)
CLERK_AUTHORIZED_PARTIES=
# Registration requires the JWT `email` claim — configure in Clerk session token customization

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=

DEVICE_HASH_PEPPER=
```

---

## Conditionally required

Validated only when the corresponding flag is enabled:

```env
POSTHOG_ENABLED=false   # default false — when true, both below are required
POSTHOG_PROJECT_TOKEN=  # project token (phc_…) from PostHog project settings
POSTHOG_HOST=           # e.g. https://eu.i.posthog.com or https://us.i.posthog.com

ARCJET_ENABLED=false    # default false — when true, ARCJET_KEY is required
ARCJET_KEY=

AI_PROVIDER=gemini      # default gemini — only provider in v1
RECEIPT_AI_ENABLED=false # default false — when true, GOOGLE_GENERATIVE_AI_API_KEY + EXPECTED_RECIPIENT_NAMES required
CONTENT_SEARCH_AI_ENABLED=false # default false — when true, GOOGLE_GENERATIVE_AI_API_KEY required (same Gemini key as receipts; separate flag so search can be enabled without receipt AI)
GOOGLE_GENERATIVE_AI_API_KEY=
EXPECTED_RECIPIENT_NAMES=

MAIL_ENABLED=false    # default false — when true, all mail vars below are required
MAIL_FROM=
TEACHER_SUPPORT_EMAIL=
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
```

---

## Deferred (later build steps)

None currently.

---

## Recommended

```env
CORS_ORIGINS=
APP_URL_STUDENT_WEB=
APP_URL_ADMIN_WEB=
APP_URL_API=
SIGNED_URL_TTL_SECONDS=900
PUSH_NOTIFICATIONS_ENABLED=false
```

`SIGNED_URL_TTL_SECONDS` defaults to `900` when omitted.
`PUSH_NOTIFICATIONS_ENABLED` defaults to `false`. Set `true` to deliver Expo OS pushes on lesson/announcement publish (in-app `Notification` rows are always created). Requires students to have registered a mobile push token.

---

## Production-only (validated when `NODE_ENV=production`)

```env
CORS_ORIGINS=
CLERK_AUTHORIZED_PARTIES=
```

Both must be non-empty comma-separated lists in production. Development and test may leave them empty.

---

## Rules

- Never hardcode env values.
- Never expose secrets to clients.
- Validate env at startup.
- Fail fast on missing required values.
- Keep exact env names in sync with `src/config/env.schema.ts`.
