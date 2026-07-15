# Environment Variables

Validated at startup by Zod (`backend/src/config/env.ts`) — the server exits with a clear message listing anything missing or invalid.

## Backend (`backend/.env`)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `development` / `test` / `production` |
| `PORT` | no | `5000` | API port |
| `API_VERSION` | no | `v1` | URL version segment |
| `APP_NAME` | no | `WorkTrack` | Display name |
| `APP_URL` | no | `http://localhost:5173` | Frontend origin (email links) |
| `BACKEND_URL` | no | `http://localhost:5000` | Self URL (logs) |
| `MONGODB_URI` | **yes** | — | MongoDB connection string |
| `JWT_ACCESS_SECRET` | **yes** | — | ≥32 chars; signs access tokens |
| `JWT_ACCESS_EXPIRES_IN` | no | `15m` | Access-token lifetime |
| `JWT_REFRESH_SECRET` | **yes** | — | ≥32 chars (reserved; refresh tokens are opaque+hashed) |
| `JWT_REFRESH_EXPIRES_IN` | no | `30d` | Refresh session lifetime |
| `COOKIE_SECRET` | no | dev default | Cookie signing |
| `CORS_ORIGINS` | no | `http://localhost:5173` | Comma-separated allowlist |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | no | empty | Uploads disabled until all three set |
| `CLOUDINARY_FOLDER` | no | `worktrack` | Root asset folder |
| `MAX_IMAGE_SIZE_MB` / `MAX_VIDEO_SIZE_MB` / `MAX_DOCUMENT_SIZE_MB` | no | 10 / 100 / 25 | Upload limits |
| `REDIS_URL` | no | empty | Optional (future rate-limit/socket scaling) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM_NAME` / `SMTP_FROM_EMAIL` | no | empty | When `SMTP_HOST` is empty, emails are logged to the console |
| `LOG_LEVEL` | no | `info` | Pino level |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | no | 900000 / 500 | Global limiter |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | no | `10` | Auth-route limiter |
| `PASSWORD_RESET_EXPIRES_MINUTES` | no | `30` | Reset-link validity |
| `EMAIL_VERIFICATION_EXPIRES_HOURS` | no | `24` | Verification-link validity |
| `INVITATION_EXPIRES_DAYS` | no | `7` | Invite validity |

## Frontend (`frontend/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_APP_NAME` | `WorkTrack` | Display name |
| `VITE_API_BASE_URL` | `http://localhost:5000/api/v1` | API base |
| `VITE_SOCKET_URL` | `http://localhost:5000` | Socket.IO endpoint |

Never commit `.env` files; never place database credentials, JWT secrets, the Cloudinary API secret, or SMTP passwords in frontend code.
