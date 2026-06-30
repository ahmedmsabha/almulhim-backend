# Env Contract

All secrets stay server-side only.

Validation is implemented in `src/config/env.schema.ts`. Keep this file in sync with that schema.

---

## Required at startup (Phase 1 — step 02)

Always validated when the app boots:

```env
PORT=
NODE_ENV=

DATABASE_URL=

CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
CLERK_JWT_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
```

---

## Conditionally required

Validated only when the corresponding flag is enabled:

```env
POSTHOG_ENABLED=false   # default false — when true, both below are required
POSTHOG_API_KEY=
POSTHOG_HOST=

ARCJET_ENABLED=false    # default false — when true, ARCJET_KEY is required
ARCJET_KEY=
```

---

## Deferred (later build steps)

Not validated until their owning phase is implemented:

```env
AI_PROVIDER=gemini
GOOGLE_GENERATIVE_AI_API_KEY=
EXPECTED_RECIPIENT_NAMES=
RECEIPT_AI_ENABLED=

MAIL_TRANSPORT=
MAIL_FROM=
TEACHER_SUPPORT_EMAIL=

SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
```

---

## Recommended

```env
CORS_ORIGINS=
APP_URL_STUDENT_WEB=
APP_URL_ADMIN_WEB=
APP_URL_API=
LOG_LEVEL=
SIGNED_URL_TTL_SECONDS=
```

---

## Rules

- Never hardcode env values.
- Never expose secrets to clients.
- Validate env at startup.
- Fail fast on missing required values.
- Keep exact env names in sync with `src/config/env.schema.ts`.
