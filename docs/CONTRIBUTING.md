# Contributing

## Workflow

- Branch from `main`: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`.
- Commit style: imperative, scoped when useful — `feat(tasks): persist kanban ordering`.
- Before opening a PR, run from the repo root and ensure all pass:

  ```bash
  npm run lint && npm run typecheck && npm run test && npm run build
  ```

## Code conventions

**Backend**

- One folder per domain in `src/features/<domain>/` — `*.routes.ts` (wiring only) and `*.controller.ts` (logic). No business logic in route files.
- Validate every mutating request with Zod via `validate(schema)`.
- Guard routes with `authorize(...permissionKeys)`; **every** query must include `orgScope(req)` — a missing organization filter is a security bug, not a style issue.
- Use `ApiError` helpers for failures and `ok`/`created` for responses; never bypass the envelope.
- Readable identifiers come from `nextIdentifier()` (counters) — never from collection counts.
- Side effects (audit/activity/notification) are fire-and-forget; don't await them into the critical path unless the response depends on them.

**Frontend**

- One folder per domain in `src/features/<domain>/`; pages orchestrate, shared pieces live in `src/components/`.
- Server state through TanStack Query (`get<T>()` etc. from `lib/api`); forms with React Hook Form + Zod; global client state only in the auth store.
- Reuse the UI kit (`components/ui`) — don't hand-roll buttons/inputs/badges; keep permission checks via `useAuthStore().can(...)` for UX, never as the only guard.
- Every page needs loading (skeleton), empty, error (with retry), and permission-denied states.

## Tests

New endpoints need backend coverage (happy path + authorization + org isolation). UI primitives and utilities get colocated Vitest tests.
