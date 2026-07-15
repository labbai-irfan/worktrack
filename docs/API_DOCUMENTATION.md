# API Documentation

Base URL: `/api/v1` · All endpoints (except auth entry points) require `Authorization: Bearer <accessToken>`.

**Envelope.** Success: `{ "success": true, "message": "...", "data": ..., "meta": {...} }`. Error: `{ "success": false, "message": "...", "code": "VALIDATION_ERROR", "errors": [{ "field", "message" }], "requestId": "..." }`.

**List conventions.** `page` (1-based), `limit`, `sort` (`-createdAt`, comma-separated, `-` = desc), `q` (search), `status`/`priority`/`severity`/`type` (comma-separated), `from`/`to` (dates). List responses set `meta: { page, limit, total, totalPages }`.

## Auth — `/auth`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/register` | public (rate-limited) | Org onboarding: creates organization, default roles, admin account; sets refresh cookie |
| POST | `/login` | public (rate-limited) | Returns accessToken, user, organization, permissions, roleKey |
| POST | `/refresh` | refresh cookie | Rotates the refresh token; returns fresh session payload |
| POST | `/logout` | refresh cookie | Revokes session, clears cookie |
| POST | `/forgot-password` / `/reset-password` | public (rate-limited) | Uniform responses (no enumeration); reset revokes all sessions |
| GET | `/invitations/:token` | public | Inspect a pending invite |
| POST | `/accept-invitation` | public (rate-limited) | Creates the employee account and signs in |
| GET / PATCH | `/me` | ✓ | Current profile; PATCH updates profile fields |
| POST | `/change-password` | ✓ | Revokes all sessions afterwards |
| GET | `/sessions` · DELETE `/sessions/:id` · DELETE `/sessions` | ✓ | Login activity, revoke one/all |

## Organizations — `/organizations`

| Method | Path | Permission |
| --- | --- | --- |
| GET / PATCH | `/current` | `organization.view` / `organization.manage` |
| GET / POST | `/roles` · PATCH `/roles/:id` | `organization.view` / `organization.manage` (org_admin role immutable) |
| GET | `/permissions` | `organization.view` — full permission-key catalog |

## Employees — `/employees`

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/` (`q`, `status`, `departmentId`, `teamId`) · GET `/:id` | `employee.view` |
| POST | `/invite` | `employee.invite` — returns `inviteUrl` (shareable when SMTP is not configured) |
| GET | `/invitations` · DELETE `/invitations/:id` | `employee.invite` |
| PATCH | `/:id` | `employee.manage` — profile, role, department, team, status |
| POST | `/:id/activate` · `/:id/deactivate` | `employee.deactivate` — deactivation revokes sessions |
| POST | `/:id/reset-password` | `employee.manage` |

## Teams & departments — `/teams`

`GET/POST/PATCH/DELETE /departments[...]` (`department.manage`) and `GET/POST/PATCH/DELETE /` for teams (`team.create`/`team.manage`). DELETE archives (soft).

## Projects — `/projects`

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/` (`q`, `status`, `mine=true`) · GET `/:id` (includes stats) | `project.view` — visibility-filtered |
| POST | `/` | `project.create` — unique org-scoped key |
| PATCH | `/:id` | `project.update` |
| POST | `/:id/archive` | `project.archive` |
| PUT | `/:id/members` | `project.manage_members` |

## Modules — `/modules` · Milestones — `/milestones`

CRUD scoped by `projectId` query. Modules: `module.create`/`module.manage`; unique key per project; GET `/:id` returns stats + recent updates. Milestones: `milestone.manage`.

## Tasks — `/tasks`

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/` (`projectId`, `moduleId`, `assigneeId=me`, `status`, `priority`, `overdue=true`, `parentTaskId`, `q`) | `project.view` |
| GET | `/:id` (includes subtasks) | `project.view` |
| POST | `/` | `task.create` — number generated per project key (`WTH-12`) |
| PATCH | `/:id` | `task.update` — status/assignee changes notify watchers |
| PATCH | `/reorder` | `task.update` — persists kanban `{id, status, order}[]` |
| POST | `/bulk` | `task.assign` — bulk status/priority/assignee/module changes |
| DELETE | `/:id` | `task.delete` (soft) |

## Work updates — `/work-updates`

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/` | own updates; `work_update.view_team` sees the team (never others' drafts) |
| GET | `/pending-reviews` | `work_update.review` |
| GET | `/:id` | author or reviewer |
| POST | `/` | `work_update.create` — creates a **draft** (`UPD-n`) |
| PATCH | `/:id` | author only, while `draft`/`changes_requested` |
| POST | `/:id/submit` | author — draft/changes_requested → submitted |
| POST | `/:id/review` | body `{action: start_review \| approve \| request_changes \| reject, comment}` — approve needs `work_update.approve`; self-approval blocked unless the org enables it; request_changes/reject require a comment |
| DELETE | `/:id` | author (drafts) or approver |

## Attachments — `/attachments`

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/upload` | multipart (`file`, optional `projectId`, `moduleId`, `attachmentType`) — validated MIME/size, streamed to Cloudinary, rolls back the asset if metadata persistence fails. 503 `UPLOADS_DISABLED` until Cloudinary is configured |
| POST | `/sign` | Signature for client-direct signed uploads |
| GET | `/` | File library (`projectId`, `entityType`, `resourceType`) |
| PATCH | `/:id` | caption / altText / label (uploader or `file.manage`) |
| DELETE | `/:id` | authorization → soft-delete metadata → Cloudinary destroy |

## Issues — `/issues`

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/` (`open=true`, `severity`, `type`, `assigneeId=me`, `q` incl. error message) · GET `/:id` | `project.view` |
| POST | `/` | `issue.create` — `BUG-n`; sensitive values in error payloads redacted |
| PATCH | `/:id` | `issue.assign`/`issue.manage` — assignment, severity (status changes go through transition) |
| POST | `/:id/transition` | enforced lifecycle; resolving requires a resolution code |
| DELETE | `/:id` | `issue.manage` (soft) |

## Comments — `/comments`

`GET ?entityType&entityId` · `POST /` (mentions notify, replies thread) · `PATCH /:id` (own) · `DELETE /:id` (own or moderator) · `POST /:id/react` · `/:id/resolve` · `/:id/pin`.

## Time entries — `/time-entries`

`GET /` · `GET /active` (restore running timer) · `POST /` (manual) · `POST /start` (server timestamps; one running timer unless org allows more) · `POST /:id/stop` · `PATCH /:id/correct` (audited correction with reason) · `DELETE /:id`. Task `loggedMinutes` stays in sync.

## Reports — `/reports`

`GET /daily/preview?date=` (aggregate before submit) · `POST /daily` (upsert draft; unique per user+date) · `GET /daily` (`all=true` for reviewers) · `GET /daily/:id` · `POST /daily/:id/submit` · `POST /daily/:id/review` (`approve`/`request_changes`/`reviewed`; no self-review) · `GET /summary?period&from&to` (weekly/monthly aggregates: by type, project, status, time).

## Others

- **Notifications** `/notifications`: GET (`unread=true`, meta.unreadCount) · POST `/:id/read` · POST `/read-all`.
- **Activities** `/activities`: GET timeline (`projectId`, `actorId`, `entityType`).
- **Audit logs** `/audit-logs`: GET only, `audit.view` — immutable.
- **Releases** `/releases`: GET/POST/PATCH (`release.create`/`release.deploy`; deploy notifies project members) · GET `/:id/notes` generates markdown release notes from linked records.
- **Analytics** `/analytics`: `/dashboard` (KPIs + project health), `/trends` (daily series), `/workload` (open tasks per employee), `/work-distribution` (by type/project/module).
- **Search** `/search?q=`: permission-aware global search across projects, tasks, issues, work updates (incl. commit hashes and error messages), employees, releases.
