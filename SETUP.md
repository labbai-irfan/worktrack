# WorkTrack — Complete Setup Guide (Start to Finish)

This single file takes you from a fresh machine to a fully running WorkTrack platform: every command, every environment variable, **where to get each value**, and how to verify it all works.

---

## 1. Prerequisites

| Tool | Version | Where to get it | Verify |
| --- | --- | --- | --- |
| Node.js | 20 or newer | https://nodejs.org (LTS installer) | `node -v` |
| npm | 10+ (ships with Node) | included with Node | `npm -v` |
| Git | any recent | https://git-scm.com/downloads | `git --version` |
| MongoDB | Atlas cloud (free) **or** local | steps below | — |
| Cloudinary account | free plan | steps below (optional at first) | — |

> Windows, macOS, and Linux all work. Commands below run in any terminal (PowerShell, Git Bash, etc.) from the project root folder.

---

## 2. Install the project

```bash
# from the project root (the folder containing package.json, backend/, frontend/)
npm install
```

This one command installs **both** the backend and frontend (npm workspaces). Takes 1–3 minutes.

---

## 3. Create the environment files

```bash
# Windows PowerShell
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env

# macOS / Linux / Git Bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Now fill in `backend/.env`. The next sections tell you exactly how to get every value.

---

## 4. Get your MongoDB connection string (`MONGODB_URI`) — REQUIRED

### Option A — MongoDB Atlas (recommended, free, no install)

1. Go to **https://www.mongodb.com/cloud/atlas/register** and create a free account.
2. Create a **Project** (name it anything, e.g. `WorkTrack`).
3. Click **Build a Database** → choose the **M0 FREE** cluster → pick a region near you → **Create**.
4. **Create a database user** (it usually prompts immediately; otherwise *Security → Database Access → Add New Database User*):
   - Username: e.g. `worktrack`
   - Password: click **Autogenerate** and **copy it somewhere safe**
   - Role: *Read and write to any database*
5. **Allow your computer to connect** (*Security → Network Access → Add IP Address*):
   - Click **Add My Current IP Address** (for quick local dev you can use `0.0.0.0/0` — allow from anywhere — but never do that for production).
6. Get the string: *Database → Connect → Drivers* → copy the URI. It looks like:

   ```
   mongodb+srv://worktrack:<password>@cluster0.ab1cd.mongodb.net/?retryWrites=true&w=majority
   ```

7. Edit it: replace `<password>` with your real password, and **add the database name** `worktrack` after the host:

   ```
   mongodb+srv://worktrack:YOUR_PASSWORD@cluster0.ab1cd.mongodb.net/worktrack?retryWrites=true&w=majority
   ```

   ⚠️ If your password contains `@ : / # ?` characters, URL-encode them (e.g. `@` → `%40`).

8. Paste that full string into `backend/.env` as:

   ```
   MONGODB_URI=mongodb+srv://worktrack:YOUR_PASSWORD@cluster0.ab1cd.mongodb.net/worktrack?retryWrites=true&w=majority
   ```

### Option B — Local MongoDB via Docker (no cloud account)

```bash
docker compose --profile local-db up -d mongo
```

Then in `backend/.env`:

```
MONGODB_URI=mongodb://localhost:27017/worktrack
```

---

## 5. Generate your secrets — REQUIRED

The JWT and cookie secrets are just long random strings **you generate yourself** (nothing to sign up for). Run this **three times** and copy each output:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Put them in `backend/.env`:

```
JWT_ACCESS_SECRET=first_generated_string_here
JWT_REFRESH_SECRET=second_generated_string_here
COOKIE_SECRET=third_generated_string_here
```

Rules: each must be at least 32 characters (the command above gives 96), never reuse them across projects, never commit them.

---

## 6. Get Cloudinary credentials (file/screenshot uploads) — OPTIONAL

You can skip this at first — the app runs fine and shows a clear "uploads not configured" message until you add these.

1. Go to **https://cloudinary.com/users/register_free** and create a free account.
2. After login you land on the **Dashboard** (or *Settings → API Keys*). You'll see three values:
   - **Cloud name** (e.g. `dx1ab2cd3`)
   - **API Key** (a number like `123456789012345`)
   - **API Secret** (click the eye icon / *Reveal* to see it)
3. Put them in `backend/.env`:

   ```
   CLOUDINARY_CLOUD_NAME=dx1ab2cd3
   CLOUDINARY_API_KEY=123456789012345
   CLOUDINARY_API_SECRET=your_revealed_secret
   CLOUDINARY_FOLDER=worktrack
   ```

The API secret stays server-side only. Free plan (~25 credits/month) is plenty for development.

---

## 7. SMTP email — OPTIONAL (skip for local dev)

Without SMTP, invitation and password-reset emails are **printed in the backend console**, and the invite screen gives you a **copyable link** — so everything is testable with no email provider.

If you want real emails later, use any SMTP provider (Gmail App Password, Brevo, Mailgun, SendGrid — all have free tiers) and fill:

```
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
SMTP_FROM_NAME=WorkTrack
SMTP_FROM_EMAIL=noreply@yourdomain.com
```

**Redis** (`REDIS_URL`) is also optional — leave it empty; it's only for multi-server scaling (see `docs/REDIS_SETUP.md`).

---

## 8. Your finished `backend/.env` should look like this

```ini
NODE_ENV=development
PORT=5000
API_VERSION=v1
APP_NAME=WorkTrack
APP_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000

# From Step 4
MONGODB_URI=mongodb+srv://worktrack:YOUR_PASSWORD@cluster0.ab1cd.mongodb.net/worktrack?retryWrites=true&w=majority

# From Step 5 (three different random strings)
JWT_ACCESS_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
JWT_REFRESH_EXPIRES_IN=30d
COOKIE_SECRET=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz

CORS_ORIGINS=http://localhost:5173

# From Step 6 (leave empty to disable uploads for now)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=worktrack

MAX_IMAGE_SIZE_MB=10
MAX_VIDEO_SIZE_MB=100
MAX_DOCUMENT_SIZE_MB=25

# Optional (Step 7) — safe to leave empty
REDIS_URL=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_NAME=WorkTrack
SMTP_FROM_EMAIL=

LOG_LEVEL=debug
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=500
AUTH_RATE_LIMIT_MAX_REQUESTS=10
PASSWORD_RESET_EXPIRES_MINUTES=30
EMAIL_VERIFICATION_EXPIRES_HOURS=24
INVITATION_EXPIRES_DAYS=7
```

And `frontend/.env` (the defaults already work for local dev):

```ini
VITE_APP_NAME=WorkTrack
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

> The server validates all of this at startup and prints exactly which variable is missing or invalid — if it won't boot, read the first error message.

---

## 9. Seed demo data

```bash
npm run seed
```

Creates the **WiseTech Demo** workspace: 7 employees, 2 projects (WiseTech HRMS, PPD Store), 15 modules (Leads, Salary, Attendance, …), tasks, two weeks of work updates in every review state, issues, daily reports, and a release. Safe to re-run — it wipes and re-creates only the demo organization. Refuses to run in production.

---

## 10. Run it

```bash
npm run dev
```

| App | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| API | http://localhost:5000 (health check: http://localhost:5000/health) |

**Sign in** (password for every seeded account: `WorkTrack@2026`):

| Email | Role — what to try |
| --- | --- |
| `admin@wisetech.dev` | Org Admin — settings, roles, audit log, team management |
| `manager@wisetech.dev` | Project Manager — pending approvals, review/approve updates, releases |
| `lead@wisetech.dev` | Team Lead — team updates, reviews |
| `priya@wisetech.dev` | Developer — add a work update, kanban, daily report |
| `arjun@wisetech.dev` | Developer — has a "changes requested" update to resubmit |
| `kavya@wisetech.dev` | Designer |
| `vikram@wisetech.dev` | QA |

Or create your **own fresh workspace** at http://localhost:5173/register (these demo credentials are local-dev only).

---

## 11. Verify everything (optional but recommended)

```bash
npm run lint        # 0 errors expected
npm run typecheck   # passes clean
npm run test        # 21 backend + 11 frontend tests, all green (no DB needed — in-memory Mongo)
npm run build       # production builds for both apps
```

---

## 12. All commands cheat-sheet

| Command | What it does |
| --- | --- |
| `npm install` | Install everything (both apps) |
| `npm run dev` | Run backend + frontend together |
| `npm run dev:backend` / `npm run dev:frontend` | Run just one side |
| `npm run seed` | Load/reset demo data |
| `npm run test` / `lint` / `typecheck` / `build` | Quality gates (both apps) |
| `npm run format` | Prettier formatting |
| `docker compose --profile local-db up -d mongo` | Local MongoDB instead of Atlas |
| `docker compose up -d redis` | Optional Redis |

---

## 13. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Server exits with `[env] Invalid environment configuration` | The message lists the exact variable — usually `MONGODB_URI` missing or a JWT secret shorter than 32 chars (Step 4/5) |
| `MongooseServerSelectionError` / connect timeout | Atlas Network Access doesn't include your IP (Step 4.5), or wrong password / un-encoded special characters in the URI |
| `bad auth : authentication failed` | Wrong DB username/password in the URI — reset the database user's password in Atlas |
| Login works but page reloads log you out | Backend restarted is fine (sessions persist); check the browser allows cookies for `localhost` and both apps use the URLs above |
| Uploads show "File uploads are not configured" (503) | Expected until Step 6 — add all three Cloudinary values and restart the backend |
| Invite email "not received" | Local dev has no SMTP — the invite modal shows a **copyable link**, and the backend console prints the email content |
| Port 5000 or 5173 already in use | Change `PORT` in `backend/.env` (and `VITE_API_BASE_URL`/`VITE_SOCKET_URL` in `frontend/.env` to match), or free the port |
| `npm run seed` says it refuses | You have `NODE_ENV=production` set — seeding is development-only |

More depth: [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) · [docs/MONGODB_ATLAS_SETUP.md](docs/MONGODB_ATLAS_SETUP.md) · [docs/CLOUDINARY_SETUP.md](docs/CLOUDINARY_SETUP.md) · [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) · [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

**Golden rules:** never commit `.env` (already git-ignored) · never put the Cloudinary API secret or Mongo URI in frontend code · generate fresh secrets for production.
