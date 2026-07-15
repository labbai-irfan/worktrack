# WorkTrack — Feature Inventory, Gap Analysis & Expansion Plan

_Phase 1–2 deliverable of the Enterprise Feature Intelligence expansion. Date: 2026-07-11_

## 1. Architecture Snapshot

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript, TanStack Query, Zustand, Tailwind (semantic token theme, light/dark/system), dnd-kit, ECharts, socket.io-client |
| Backend | Express + TypeScript, Mongoose 8, Zod validation, JWT + rotating refresh cookies, Socket.IO rooms (`org:<id>`, `user:<id>`), Pino |
| Database | MongoDB Atlas (org-scoped collections, soft deletes via `deletedAt`, readable IDs via `counters`) |
| Files | Cloudinary (metadata in `Attachment`), employee-name folder structure |
| RBAC | Permission-key roles (`org_admin`, `project_manager`, `team_lead`, `employee`, `viewer`) enforced server-side via `authorize()` |

## 2. Feature Inventory

| Module | Existing | Partially implemented | Missing | Priority gap |
|---|---|---|---|---|
| Tasks | CRUD, filters, bulk update, kanban reorder, checklist, watchers, collaborators, git links, estimates, logged time | **Subtasks** (model + API exist; no create-UI), **Dependencies** (`dependencyIds` stored & populated; zero validation, zero UI), **Blockers** (`blockedReason` field; no capture flow, no notifications) | Dependency graph views, recurrence, custom fields, saved views | **P0** |
| Task views | List, per-project Kanban | Board lacks risk indicators (blocked/unassigned/subtask progress) | Calendar, Timeline/Gantt, WBS, PERT, My Work | **P0** (My Work), P1 (Gantt/Calendar) |
| Projects | Workspace tabs (overview/modules/board/updates/issues/milestones/team/releases/activity), health field | Health is a manual field — no scoring rules | Health scoring engine, project dashboard charts, workload tab | P1 |
| Milestones | Model + API + project tab | No delay warnings, no progress roll-up from tasks | Milestone alerts | P1 |
| Work updates | Full review workflow (draft→submitted→review→approved), screenshots | — | — | — |
| Issues | Full CRUD, severity, resolution codes | — | Risk register (probability × impact) | P2 |
| Time | TimeEntry model, logged minutes on tasks | — | Timesheet views, capacity math | P1 |
| Analytics | Org dashboard KPIs, per-user analytics | — | Burndown/burnup, CFD, velocity (no sprint model exists) | P2 (needs sprints first) |
| Activity | Per-project + per-entity activity stream | — | Org-wide filterable timeline | P2 |
| Search | Global search API + Ctrl-K UI | — | Command palette actions | P2 |
| Notifications | In-app + socket push, badge | — | Grouping/digest, preferences per category | P2 |
| Sprints | — | — | Entire module (model, planning, reports) | P2 — only if workflow needs it |
| Automation | — | — | Trigger/condition/action engine | P3 |

## 3. Dependency Map (verified against models)

```
Organization ─┬─ Department ─ Team ─ User(Employee)
              ├─ Role (permission keys)
              ├─ Project ─┬─ Module
              │           ├─ Milestone
              │           ├─ Task ─┬─ Subtask (parentTaskId)
              │           │        ├─ dependencyIds → Task[]
              │           │        ├─ checklist[], watcherIds[], collaboratorIds[]
              │           │        └─ TimeEntry, Comment, Attachment (entity refs)
              │           ├─ WorkUpdate ─ DailyReport
              │           ├─ Issue
              │           └─ Release
              ├─ Activity / AuditLog / Notification
              └─ Counter (readable IDs)
```

## 4. Key Findings

1. **The schema is ahead of the product.** `parentTaskId`, `dependencyIds`, `blockedReason`, `watcherIds`, `estimatedHours` all exist and are returned by `GET /tasks/:id`, but the UI never renders dependencies, offers no way to create subtasks, and captures no blocker reason. Highest-value work is *exposing* what exists, not new schema.
2. **No dependency integrity.** `dependencyIds` accepts self-references, cross-project refs, dead IDs, and cycles. Any future Gantt/PERT/critical-path work is blocked until validation exists. (P0, backend)
3. **No personal command center.** The dashboard mixes manager KPIs with personal lists; there is no answer to "what should I do right now?" A `My Work` aggregation (today / overdue / upcoming / blocked / awaiting-my-review) is cheap — all filters already exist server-side. (P0)
4. **Board hides risk.** Kanban cards show only overdue. Blocked, unassigned and subtask-progress indicators are one-line changes with existing data. (P0)
5. **Sprint analytics are premature.** Burndown/velocity require a Sprint model that doesn't exist; the org isn't confirmed to run Scrum. Deferred to Release 3 by design, not omission.

## 5. Release Plan (per spec Phase 36)

- **Release 1 (this iteration):** dependency validation + blocker workflow (backend), My Work API + page, dependencies/subtasks/blocked UI on task detail, Kanban risk indicators.
- **Release 2:** timeline/Gantt (virtualized), workload view (needs estimate coverage report first), project health scoring rules, milestone alerts.
- **Release 3:** sprints + burndown/burnup/velocity/CFD (only after methodology decision).
- **Release 4:** PERT/critical path (depends on Release 1 dependency integrity), risk register.
- **Release 5:** command palette actions, saved views, automation rules, scheduled reports.

## 6. Impact Reports (Release 1)

**Database:** no schema changes required. All fields exist.
**API:** `GET /tasks/my-work` (new), dependency validation inside `POST /tasks` & `PATCH /tasks/:id`, `dependents` added to `GET /tasks/:id` response, blocked-status notifications.
**Permissions:** reuses `project.view`, `task.create`, `task.update` — no new keys needed for Release 1 (dependency editing = `task.update`).
**Risk:** dependency cycle check is O(edges) BFS per write — bounded by 50-dep schema cap; negligible. My Work endpoint = 5 indexed queries; all hit existing compound indexes (`organizationId, assigneeId, status`, `dueDate`).

## 7. Release 2 — Delivered (2026-07-11)

**Project health scoring** ([projectHealth.service.ts](../backend/src/services/projectHealth.service.ts)): replaces the manually-set `health` field with a transparent, rule-based score (`healthy` → `attention` → `at_risk` → `critical`), evaluated most-severe-first from overdue-task ratio, blocked high-priority tasks, overdue/upcoming milestones, and days-since-activity. Every verdict returns `reasons[]` and a `recommendedAction` — no unexplained red/green dots, per Phase 14's explicit requirement. Exposed at `GET /projects/:id/health`; rendered as a card on the project overview tab.

**Milestone alerts** (`GET /milestones/alerts?projectId=`): overdue and upcoming-7-day milestones, project-scoped or org-wide. Rendered as a card alongside project health.

**Workload capacity** (extends `GET /analytics/workload`): sums `estimatedHours` on each employee's open tasks and compares to a configurable weekly capacity (default 40h), classified as available/balanced/near_capacity/over_capacity. Per Phase 18's explicit warning against fabricated utilization: a per-employee `capacityState: 'unknown'` is returned instead of a percentage when fewer than 60% of that employee's open tasks carry an estimate — the UI then shows "X% estimated" instead of a number that would imply false precision.

**Timeline view** ([ProjectTimeline.tsx](../frontend/src/features/projects/ProjectTimeline.tsx)): read-only Gantt-lite — task bars positioned from `startDate`/`dueDate`, milestone diamonds, a "Today" marker, and an explicit "N tasks without dates" callout (data-quality visibility per Phase 29) rather than silently omitting them. Drag/resize, dependency connectors, and critical-path highlighting are deferred to Release 4 — they build on the dependency-cycle validation from Release 1 but are a separate, larger interaction-design effort.

**Verification:** typecheck/lint/tests all pass (32 tests); live smoke test confirmed health scoring reacts correctly to a blocked task + overdue task (`attention` with correct reasons), milestone alerts return the right shape, and workload capacity correctly distinguishes an employee with 0% estimate coverage (`unknown`) from one with full coverage (computed `utilization`).

**Deferred to Release 3+ (per original plan, no scope creep):** sprints, burndown/burnup/velocity/CFD (blocked on a sprint model that doesn't exist and an unconfirmed methodology decision), PERT/critical path, risk register, Gantt drag/resize.
