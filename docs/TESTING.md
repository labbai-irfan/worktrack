# Testing

## Backend — Vitest + Supertest + mongodb-memory-server

Run: `npm test --workspace backend` (no external database needed — an in-memory MongoDB spins up per suite).

| Suite | Coverage |
| --- | --- |
| `tests/auth.test.ts` | Organization registration, duplicate rejection, password-strength field errors, login with permission payload, uniform invalid-credential message (enumeration prevention), **refresh-token rotation and replay rejection**, protected-route 401s, `/me` |
| `tests/workflow.test.ts` | Two-organization setup; **cross-organization isolation** (foreign tenant gets 404 on reads and writes); invitation → acceptance; **permission enforcement** (employee cannot create projects); project/module/task creation with readable numbers; the **complete work-update review cycle** (draft → submit → self-approval blocked → changes requested → edit → resubmit → approve, with review history); approval notification delivery; **issue lifecycle** with enforced transitions, required resolution code, and payload secret redaction; **daily-report aggregation** and duplicate prevention; **audit-log** recording + access control; org-scoped global search |

## Frontend — Vitest + React Testing Library (jsdom)

Run: `npm test --workspace frontend`.

- `src/lib/utils.test.ts` — formatting helpers (class merge, status humanization, duration/bytes, initials, reference unwrapping).
- `src/components/ui/ui.test.tsx` — Button click/disabled-while-loading, StatusBadge rendering, EmptyState content/action, Field label wiring and `role="alert"` error announcement.

## Adding tests

- Backend: create `backend/tests/*.test.ts`; import `startTestDb`/`stopTestDb` from `tests/setup.ts` and build the app with `createApp()`. Suites run sequentially (`fileParallelism: false`) so each owns its database.
- Frontend: co-locate `*.test.tsx` next to the code; jsdom + jest-dom matchers are preconfigured via `vitest.config.ts`.

## Recommended next steps

Playwright end-to-end coverage for the two critical browser journeys (employee logs and submits an update with screenshots; manager requests changes and approves) — the API-level equivalents are already covered by the backend workflow suite.
