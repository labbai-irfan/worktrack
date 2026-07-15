# Security

## Implemented controls

| Area | Control |
| --- | --- |
| Transport & headers | Helmet, strict CORS allowlist (`CORS_ORIGINS`), compression, `trust proxy` |
| Rate limiting | Global limiter + strict auth limiter (register/login/reset/invite) |
| Input | Zod validation on every mutating route; typed enums; Mongoose `strictQuery`; payload size limits (2 MB JSON) |
| Passwords | bcrypt cost 12; strength policy; uniform login errors (no enumeration) |
| Sessions | Short-lived access JWTs; opaque refresh tokens stored **hashed** (SHA-256) with rotation and replay rejection; `HttpOnly`/`SameSite=Lax`/`Secure`(prod) cookie scoped to the auth path; revoke-one/revoke-all; all sessions revoked on password reset/change and deactivation |
| Multi-tenancy | Server-resolved identity; every query scoped by `organizationId`; foreign tenants get 404 |
| RBAC | Permission-key middleware + object-level rules (author-only edits, no self-approval/self-review) |
| Files | MIME + extension + size validation, signed Cloudinary uploads only, API secret server-side only, asset rollback on failed persistence, authorized deletion |
| Secrets & logs | `.env` git-ignored; env validated at startup; Pino redacts authorization headers, cookies, passwords, tokens; audit logs redact sensitive keys **and** sensitive values embedded in JSON-ish strings (e.g. issue request payloads) |
| Audit | Immutable audit-log collection (schema blocks updates/deletes; read-only API gated by `audit.view`) |
| Errors | Central handler; request IDs; stack traces suppressed in production |
| Real-time | JWT-authenticated socket handshake; org/user-scoped rooms only |

## Never do

- Return or log password hashes, tokens, cookies, or API secrets.
- Trust client-provided `organizationId`, `userId`, role, or permission fields.
- Expose the Cloudinary API secret or database credentials to the frontend or commit them.
- Allow unsigned/unrestricted uploads.
- Serve production errors with stack traces.

## Hardening roadmap

CSRF double-submit token if cookie scope ever widens beyond `/auth`; Redis-backed rate limiting for multi-instance deployments; dependency audit in CI (`npm audit --production`); optional 2FA.
