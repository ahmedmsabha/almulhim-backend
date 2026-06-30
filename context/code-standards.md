# Code Standards

## Engineering Mindset

- Read context files before implementing.
- Never guess APIs for fast-moving libraries.
- Build one feature at a time.
- Keep code boring, explicit, and maintainable.
- Every change must be testable immediately.

---

## TypeScript

- Strict mode only.
- Never use `any`.
- Prefer `type` over `interface` unless extension is needed.
- Explicitly type function params and return values.
- Use `unknown` when necessary, then narrow it.
- Do not leave floating promises.
- Use `const` by default.

---

## NestJS Rules

- Use NestJS-first architecture, not generic Express patterns.
- Never instantiate infrastructure clients inside feature files.
- Use constructor injection only.
- Keep controllers thin.
- Keep business logic in services.
- Keep cross-module orchestration explicit.
- Prefer one module per business capability.
- Use `@Global()` only for true infrastructure modules.

---

## Validation Rules

- Validate every write payload with Zod before touching the database.
- Do not trust request body shape from controllers.
- Do not trust role, region, plan, or subscription flags from clients.
- Keep schemas close to the module that owns them.

---

## Error Handling

- Wrap every async operation in `try/catch`.
- No empty catch blocks.
- Log errors with a clear context prefix.
- Return human-readable API errors.
- Never leak raw infrastructure secrets or stack traces to clients.

---

## Database Rules

- No `new PrismaClient()` in modules or controllers.
- Prisma lives in `src/lib/database`.
- Queries should be encapsulated in repository or database-facing classes.
- No database logic inside guards when avoidable.
- Use transactions when state changes span multiple tables.

---

## Auth Rules

- Clerk is the only auth provider.
- Token verification happens on the backend.
- Role checks happen after auth resolution.
- Admin-only routes must be protected twice: authenticated + authorized.

---

## Security Rules

- Arcjet protects abuse-prone and high-cost endpoints.
- Sensitive files use signed URLs only.
- Receipt files are admin-only.
- Device identifiers are hashed before storage.
- Secrets never appear in client code or logs.

---

## Naming

- modules: kebab-case folders
- classes: PascalCase
- functions: camelCase
- constants: SCREAMING_SNAKE_CASE
- database tables: snake_case
- Prisma models: PascalCase
- env keys: SCREAMING_SNAKE_CASE

---

## Controller Conventions

- One controller per module unless a split is justified
- No business logic inside route handlers
- Parse request, call service, map response

---

## Testing Expectation

Every completed feature should be verifiable through at least one of:

- HTTP request
- integration test
- manual API client check
- Prisma DB inspection
