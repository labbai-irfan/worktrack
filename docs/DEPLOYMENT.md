# Deployment

## Frontend — Vercel (or any static host)

- Root directory: `frontend`
- Build command: `npm run build` · Output: `dist`
- Environment variables: `VITE_API_BASE_URL=https://api.yourdomain.com/api/v1`, `VITE_SOCKET_URL=https://api.yourdomain.com`, `VITE_APP_NAME=WorkTrack`
- SPA rewrite: route all paths to `/index.html`.

## Backend — Render / Railway / EC2 (persistent Node host)

Socket.IO and in-process rate limiting need a long-lived Node process (not serverless).

- Build: `npm install && npm run build --workspace backend`
- Start: `node backend/dist/index.js`
- Health check: `GET /health`
- Required env vars: see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md). At minimum `NODE_ENV=production`, `MONGODB_URI`, both JWT secrets, `COOKIE_SECRET`, `CORS_ORIGINS=https://app.yourdomain.com`, `APP_URL=https://app.yourdomain.com`, Cloudinary credentials.
- The app sets `trust proxy`; behind a TLS-terminating proxy the refresh cookie is issued with `Secure` in production automatically.
- Scaling to multiple instances requires a Socket.IO Redis adapter and a shared rate-limit store (both optional integration points, not wired by default).

## Database & media

- MongoDB Atlas: restrict network access to backend egress IPs; enable backups ([BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md)).
- Cloudinary: production credentials in host env vars only.

## CI/CD

`.github/workflows/ci.yml` runs install → lint → typecheck → test → build on every PR and push to `main`. Deployment is intentionally **not** automatic — connect your host's GitHub integration (Vercel/Render auto-deploy) or add a deploy job gated on environment secrets.

## Docker

`docker-compose.yml` provides a development stack (backend + frontend dev servers, optional local MongoDB profile, optional Redis). For production images, build the backend (`npm run build`) into a slim Node image running `node dist/index.js` and serve `frontend/dist` from a CDN/static host; never bake secrets into images.
