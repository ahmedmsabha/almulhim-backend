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
- expose Nest-friendly protection helpers or guards
- protect abuse-prone endpoints first:
  - receipt submission
  - support request creation
  - signed download / signed file issuance
  - admin-sensitive mutation endpoints if externally reachable
- do not blindly wrap every internal route without reason
- protection decisions must remain explicit and reviewable

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
});
```

### Presigned URLs

- Generate **server-side only** via `getSignedUrl` + `PutObjectCommand` (upload) or `GetObjectCommand` (download).
- Set `ContentType` on `PutObjectCommand` to restrict uploads to a specific MIME type; the client **must** send the matching `Content-Type` header or the PUT fails.
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

Backend uses PostHog for critical events only.

Allowed backend events:

- `subscription_submitted`
- `subscription_approved`
- `subscription_rejected`
- `lesson_published`

Do not spam PostHog with low-value internal noise.

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

AI is used on the backend for receipt verification and related checks.

Project rules:

- all AI verification runs in the backend, never in frontend clients
- web and mobile must use the same backend verification flow
- use an internal provider abstraction so the model vendor can change without affecting business logic
- Gemini is the default provider for v1 through the Vercel AI SDK
- prompts stay server-side only
- always persist structured verification output
- admin remains the final decision maker

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
