# Environment Setup Guide for WorkTrack

Complete guide to obtain and configure all environment variables for the WorkTrack backend.

---

## Table of Contents
1. [MongoDB Atlas Setup](#mongodb-atlas-setup)
2. [Cloudinary Setup](#cloudinary-setup)
3. [JWT Secrets Generation](#jwt-secrets-generation)
4. [CORS & App URLs](#cors--app-urls)
5. [File Size Limits](#file-size-limits)
6. [Optional: Redis](#optional-redis)
7. [Optional: SMTP Email](#optional-smtp-email)
8. [Complete .env Template](#complete-env-template)

---

## MongoDB Atlas Setup

### Why?
WorkTrack stores all application data (users, projects, tasks, attachments metadata) in MongoDB.

### Step-by-Step:

#### 1. Create MongoDB Cluster
1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up or log in
3. Create a new **Free Tier** cluster (or paid if needed)
4. Choose region close to your server
5. Wait for cluster to deploy (~10 minutes)

#### 2. Create Database User
1. In Atlas dashboard, go to **Database Access** (left sidebar)
2. Click **Add New Database User**
3. Choose **Password** authentication
4. Username: `Irfan` (or your preferred name)
5. Auto-generate secure password (copy it and save securely)
6. Add built-in role: **Atlas admin** (or Atlas Built-in Roles → Read and write to any database)
7. Click **Add User**

#### 3. Get Connection String
1. Go to **Database** (left sidebar)
2. Click **Connect** on your cluster
3. Choose **Drivers** connection method
4. Select **Node.js** driver
5. Copy the connection string
6. Replace `<password>` with your database user password
7. Replace `<database>` with `worktrack`
8. Final format should be:
```
mongodb+srv://Irfan:YOUR_PASSWORD@cluster0.pgm0cpm.mongodb.net/worktrack?retryWrites=true&w=majority
```

#### 4. Whitelist IP Address
1. In Atlas, go to **Network Access**
2. Click **Add IP Address**
3. Choose **Allow Access from Anywhere** (for development)
4. For production, add your server's specific IP

### Environment Variable:
```
MONGODB_URI=mongodb+srv://Irfan:YOUR_SECURE_PASSWORD@cluster0.pgm0cpm.mongodb.net/worktrack?retryWrites=true&w=majority
```

---

## Cloudinary Setup

### Why?
Cloudinary hosts all uploaded images, videos, and documents. Files are automatically organized by employee name:
```
worktrack/organizations/{orgId}/employees/{employee-name}/YYYY/MM/filename
```

### Step-by-Step:

#### 1. Create Cloudinary Account
1. Go to https://cloudinary.com/users/register/free
2. Sign up (free tier supports 25 GB storage)
3. Verify email

#### 2. Get Cloud Name
1. Go to https://cloudinary.com/console/settings/general
2. Your **Cloud Name** is displayed at the top
3. Copy it

#### 3. Generate API Credentials
1. Go to https://cloudinary.com/console/settings/security
2. Your **API Key** is already visible
3. Click **Regenerate** next to **API Secret** to create a new one (only regenerate once for fresh credentials)
4. Copy both:
   - **API Key** (public key)
   - **API Secret** (keep private - NEVER expose in code)

### How Images Are Stored
When an employee uploads a file:
- Employee name is automatically slugified (spaces → dashes, lowercase)
- Organized by year/month
- Example paths:
  - `worktrack/organizations/66f1a2b3c4d5e6f7g8h9i0j1/employees/priya-sharma/2026/07/screenshot.png`
  - `worktrack/organizations/66f1a2b3c4d5e6f7g8h9i0j1/employees/john-doe/2026/07/report.pdf`

### Environment Variables:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_secret_key_here
CLOUDINARY_FOLDER=worktrack
```

---

## JWT Secrets Generation

### Why?
These secure the authentication tokens that keep users logged in.

### How to Generate:

#### Option 1: Using Node.js (Recommended)
Open terminal in your project and run:

```bash
# Generate Access Token Secret
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Generate Refresh Token Secret
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Generate Cookie Secret
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Each command outputs a unique 96-character hexadecimal string. Copy each output.

#### Option 2: Using OpenSSL
```bash
openssl rand -hex 48
```

### Environment Variables:
```
JWT_ACCESS_SECRET=your_96_char_random_string_here
JWT_ACCESS_EXPIRES_IN=15m

JWT_REFRESH_SECRET=your_96_char_random_string_here
JWT_REFRESH_EXPIRES_IN=30d

COOKIE_SECRET=your_96_char_random_string_here
```

### Default Values (Do Not Change Unless Needed):
- `JWT_ACCESS_EXPIRES_IN=15m` — tokens expire after 15 minutes
- `JWT_REFRESH_EXPIRES_IN=30d` — refresh tokens valid for 30 days

---

## CORS & App URLs

These tell the backend which frontend origins are allowed to make requests.

### Environment Variables:
```
# Frontend development URL
APP_URL=http://localhost:5173

# Backend API URL
BACKEND_URL=http://localhost:5000

# Comma-separated allowlist of frontend origins
CORS_ORIGINS=http://localhost:5173
```

### For Production:
Replace with your actual domain:
```
APP_URL=https://worktrack.yourdomain.com
BACKEND_URL=https://api.yourdomain.com
CORS_ORIGINS=https://worktrack.yourdomain.com,https://app.yourdomain.com
```

---

## File Size Limits

These control the maximum file size for different media types.

### Environment Variables:
```
MAX_IMAGE_SIZE_MB=10           # JPEG, PNG, WebP, GIF, SVG
MAX_VIDEO_SIZE_MB=100          # MP4, WebM, QuickTime
MAX_DOCUMENT_SIZE_MB=25        # PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, ZIP
```

### Adjust Based On:
- Your server's available storage
- Cloudinary plan limits
- Your user's typical file sizes

---

## Optional: Redis

For production deployments with high traffic, Redis can:
- Rate limit API requests
- Cache frequently accessed data
- Scale WebSocket connections across multiple servers

### If Not Using:
Leave `REDIS_URL` empty (commented out)

### If Using Redis:
Get your connection URL from your Redis provider (e.g., Redis Cloud, AWS ElastiCache):
```
REDIS_URL=redis://username:password@host:port/0
```

---

## Optional: SMTP Email

Enables sending real emails for password resets, invitations, and notifications.

### Without SMTP:
Emails are logged to the console instead (development mode).

### With SMTP:

#### Using Gmail (Recommended for Testing)
1. Enable 2-Factor Authentication on your Gmail account
2. Go to https://myaccount.google.com/apppasswords
3. Select "Mail" and "Windows Computer"
4. Google generates a 16-character app password
5. Use these settings:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your_16_char_app_password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=WorkTrack
```

#### Using SendGrid
1. Sign up at https://sendgrid.com
2. Create API key with Mail Send permissions
3. Use these settings:

```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your_sendgrid_api_key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=WorkTrack
```

#### Using AWS SES
1. Verify sender email in AWS SES Console
2. Create SMTP credentials
3. Use these settings:

```
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your_ses_smtp_username
SMTP_PASSWORD=your_ses_smtp_password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=WorkTrack
```

---

## Application Settings

### Environment Variables:
```
NODE_ENV=development            # 'development' or 'production'
PORT=5000                       # Backend port
API_VERSION=v1                  # API version prefix
APP_NAME=WorkTrack              # Application name

LOG_LEVEL=debug                 # 'debug', 'info', 'warn', 'error'

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000     # 15 minutes
RATE_LIMIT_MAX_REQUESTS=500     # Max requests per window
AUTH_RATE_LIMIT_MAX_REQUESTS=10 # Login attempts per window

# Password & Email Expiry
PASSWORD_RESET_EXPIRES_MINUTES=30
EMAIL_VERIFICATION_EXPIRES_HOURS=24
INVITATION_EXPIRES_DAYS=7
```

---

## Complete .env Template

Copy this entire template into `backend/.env` and fill in your values:

```env
# ------------------------------------------------------------------
# WorkTrack Backend Environment Variables
# NEVER commit this file to git. It contains sensitive credentials.
# Copy from .env.example and fill in your own values.
# ------------------------------------------------------------------

# Application
NODE_ENV=development
PORT=5000
API_VERSION=v1
APP_NAME=WorkTrack
APP_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000

# ==================== REQUIRED ====================

# MongoDB Atlas - See "MongoDB Atlas Setup" section
# Format: mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
MONGODB_URI=mongodb+srv://Irfan:YOUR_SECURE_PASSWORD@cluster0.pgm0cpm.mongodb.net/worktrack?retryWrites=true&w=majority

# JWT Secrets - Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_ACCESS_SECRET=your_96_character_random_hex_string_here
JWT_ACCESS_EXPIRES_IN=15m

JWT_REFRESH_SECRET=your_96_character_random_hex_string_here
JWT_REFRESH_EXPIRES_IN=30d

COOKIE_SECRET=your_96_character_random_hex_string_here

# Cloudinary - See "Cloudinary Setup" section
# Stores images, videos, documents organized by employee
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_secret_key
CLOUDINARY_FOLDER=worktrack

# CORS
CORS_ORIGINS=http://localhost:5173

# ==================== OPTIONAL BUT RECOMMENDED ====================

# File Sizes (in MB)
MAX_IMAGE_SIZE_MB=10
MAX_VIDEO_SIZE_MB=100
MAX_DOCUMENT_SIZE_MB=25

# Logging
LOG_LEVEL=debug

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=500
AUTH_RATE_LIMIT_MAX_REQUESTS=10

# Auth Expiry
PASSWORD_RESET_EXPIRES_MINUTES=30
EMAIL_VERIFICATION_EXPIRES_HOURS=24
INVITATION_EXPIRES_DAYS=7

# ==================== OPTIONAL ====================

# Redis (for rate limiting, caching, socket scaling)
# Example: redis://username:password@host:port/0
REDIS_URL=

# Email (if empty, emails are logged to console)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_NAME=WorkTrack
SMTP_FROM_EMAIL=
```

---

## Security Checklist

- [ ] MongoDB password is strong (12+ characters, mix of types)
- [ ] Cloudinary API Secret is kept private (never expose in code)
- [ ] JWT secrets are randomly generated (not placeholder text)
- [ ] `.env` file is in `.gitignore` (never commit to git)
- [ ] All sensitive values are stored only in `.env` (not in code)
- [ ] For production: use environment variables or secrets manager instead of `.env` file
- [ ] Cloudinary credentials are for a dedicated app (not your personal account)
- [ ] MongoDB IP whitelist includes only trusted servers

---

## Testing Your Setup

Once you've filled in your `.env` file:

```bash
# Install dependencies
npm install

# Start the backend (from backend directory)
npm run dev

# Check for connection errors in the console
```

You should see:
- ✅ MongoDB connected
- ✅ Cloudinary configured
- ✅ Server running on http://localhost:5000

---

## Troubleshooting

### MongoDB Connection Error
- Check your password (special characters must be URL-encoded: `@` → `%40`)
- Verify IP whitelist in Atlas includes your current IP
- Ensure cluster is running (check Atlas dashboard)

### Cloudinary Upload Error
- Verify API Key and Secret are correct
- Check if they're URL-encoded (unlikely needed)
- Ensure Cloudinary account has storage available

### CORS Error
- Add your frontend URL to `CORS_ORIGINS`
- Separate multiple URLs with commas
- Include protocol (http:// or https://)

### JWT Error
- Ensure secrets are at least 96 characters
- Regenerate if you suspect they were exposed
- Check that `JWT_ACCESS_EXPIRES_IN` format is valid (e.g., "15m", "1h")
