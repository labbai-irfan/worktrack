# Local Development

## Prerequisites

- Node.js 20+ and npm 10+
- A MongoDB connection — MongoDB Atlas free tier ([setup guide](MONGODB_ATLAS_SETUP.md)) or a local MongoDB via Docker (`docker compose --profile local-db up mongo`)
- Optional: Cloudinary account for file uploads ([setup guide](CLOUDINARY_SETUP.md))

## Steps

```bash
# 1. Clone and install (npm workspaces install both apps)
npm install

# 2. Environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Fill MONGODB_URI and generate secrets:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Seed realistic demo data (WiseTech Demo workspace)
npm run seed

# 4. Start both apps (backend :5000, frontend :5173)
npm run dev
```

Open http://localhost:5173 and sign in with a seeded account — password `WorkTrack@2026` for all:

| Email | Role |
| --- | --- |
| admin@wisetech.dev | Organization Admin |
| manager@wisetech.dev | Project Manager |
| lead@wisetech.dev | Team Lead |
| priya@wisetech.dev, arjun@wisetech.dev | Developers |
| kavya@wisetech.dev | UI/UX Designer |
| vikram@wisetech.dev | QA Engineer |

These are development-only credentials; the seed refuses to run when `NODE_ENV=production`.

## Notes

- **Emails** (invites, password resets) are logged to the backend console until SMTP is configured; the invite API also returns a shareable link.
- **Uploads** are disabled (clear 503) until Cloudinary credentials are set.
- **Redis** is optional and unused by default; see `REDIS_URL` for future rate-limit/socket scaling.

## Script reference

| Command | Scope | Purpose |
| --- | --- | --- |
| `npm run dev` | root | backend (tsx watch) + frontend (Vite) in parallel |
| `npm run build` | root | `tsc` build (backend) + `tsc --noEmit && vite build` (frontend) |
| `npm run test` | root | Vitest suites in both workspaces |
| `npm run lint` / `npm run typecheck` | root | ESLint / TypeScript for both |
| `npm run seed` | root | Idempotent demo data (wipes + re-seeds the demo org only) |
| `npm run format` | root | Prettier over both `src` trees |
