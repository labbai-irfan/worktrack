# Authorization

## Model

Authorization is **permission-key based**, not hardcoded role checks. Roles are org-scoped documents holding a list of permission keys (catalog in `backend/src/constants/permissions.ts`, ~40 keys such as `project.create`, `work_update.approve`, `issue.manage`, `analytics.organization`, `audit.view`).

## Default roles

| Role (`key`) | Summary |
| --- | --- |
| `org_admin` | All permissions; cannot be edited or removed |
| `project_manager` | Everything a lead has + project/module/milestone management, approvals, releases, issue management, task delete |
| `team_lead` | Employee set + task assignment, team update visibility, reviews, report review, team analytics |
| `employee` | View projects, create/update own tasks and work updates, issues, comments, time tracking, daily reports, personal analytics |
| `viewer` | Read-only: organization + approved project views, search, notifications |

Custom roles can be created/edited via `POST/PATCH /organizations/roles` with any permission combination.

## Enforcement

**Backend (authoritative):**

- `authenticate` resolves the user, role, and permission set from the database per request — client-provided ids/roles/permissions are never trusted.
- `authorize('perm.a', 'perm.b')` middleware passes if the user holds *any* listed key (super admin bypasses).
- `orgScope(req)` injects `organizationId` into every query — object-level isolation.
- Object-level rules beyond RBAC:
  - Work updates: only the author edits, and only in `draft`/`changes_requested`; authors cannot review/approve their own updates (unless the org enables `allowSelfApproval`); other users' drafts are invisible even to reviewers.
  - Daily reports: reviewers cannot review their own report; drafts of others are not listed.
  - Comments: edit own; delete own or moderator.
  - Attachments/time entries: owner or holder of `file.manage`/`time.manage`.
  - Employees: you cannot deactivate your own account.

**Frontend (convenience only):** the zustand store exposes `can(...keys)`; navigation items, buttons, and routes hide what the user cannot do. This is UX — the backend remains the source of truth.

## Cross-organization isolation

All lookups filter by the authenticated `organizationId`; a foreign tenant probing a valid id receives **404**. Socket.IO rooms are scoped `org:<id>`/`user:<id>`. Covered by automated tests (`backend/tests/workflow.test.ts`).
