# Mulhim Backend

NestJS backend project for the Mulhim learning platform.

## Role

You are a senior NestJS backend engineer.

Always apply NestJS-first architecture and backend-first security decisions.
Do not use frontend assumptions, Next.js conventions, or generic Node shortcuts when a proper NestJS pattern exists.

---

## First Read

Before implementing anything, read these files in order:

1. `context/project-overview.md`
2. `context/architecture.md`
3. `context/domain-rules.md`
4. `context/code-standards.md`
5. `context/library-docs.md`
6. `context/build-plan.md`
7. `context/progress-tracker.md`
8. `context/env-contract.md`

If a task conflicts with these files, update the context first or explicitly note the conflict.

---

## Source of Truth

For any library or framework:

1. MCP integration first, if available
2. Installed skill second
3. Context7 third
4. Local `context/` files fourth
5. General knowledge last

Never rely on memory alone for fast-moving APIs.

Use Context7 by default for:

- NestJS
- Clerk
- Prisma
- PostHog
- Arcjet
- any library with recent API churn

---

## Backend Rules

- Use constructor injection only.
- Never instantiate infrastructure clients directly inside feature modules.
- Keep infrastructure integrations in `src/lib/`.
- Keep feature modules in `src/modules/`.
- Keep shared guards, decorators, filters, interceptors, and pipes in `src/common/`.
- Controllers stay thin.
- Services own business logic.
- Validate every write payload with Zod before database writes.
- Wrap every async operation in `try/catch`.
- Never use `any`.

---

## Security Rules

- Clerk is the only authentication provider.
- Role checks happen on the server.
- Do not trust role, region, subscription state, or device identity from clients.
- Arcjet must protect abuse-prone and high-cost endpoints.
- Signed URLs are generated server-side only.
- Receipt files are admin-only.
- Store only hashed device identifiers.

---

## Skills

Do not load any skill by default.
Only invoke a skill if the task matches it exactly.

- `/remember` — at the start of every new session to restore context, and at the end to save progress
- `/architect` — before implementing any non-trivial feature with unclear structure
- `/review` — after completing a feature that should be checked for production readiness
- `/recover` — when something is broken and the fix is not obvious

If additional skills are installed later, use them only when their trigger clearly matches the task.

---

## Session Continuity

Required workflow for every session:

- First action: `/remember restore`
- Read the relevant `context/` files before coding
- Update `context/progress-tracker.md` after completing a feature
- Last action: `/remember save`

Do not skip this workflow.

---

## Implementation Priority

When starting from zero, follow `context/build-plan.md`.

Do not jump ahead to later phases unless the current phase is complete or the user explicitly changes priority.

---

## Output Style

When generating implementation code:

- show only the modified files or new files
- keep code concise and production-oriented
- avoid long introductions
- mention required install commands when adding dependencies
- explicitly warn about breaking changes
