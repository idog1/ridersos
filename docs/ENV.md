# Environment Variables

## Backend (`backend/.env`)

### Required

```bash
# Database
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"

# JWT Authentication
JWT_SECRET="your-secure-secret-key"
JWT_EXPIRES_IN="7d"

# Frontend URL (for CORS and email links)
FRONTEND_URL="http://localhost:5173"  # or https://ridersos.app
```

### Optional

```bash
# Server
PORT=3001
HOST="0.0.0.0"
NODE_ENV="development"  # or "production"

# File Uploads
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=10485760  # 10MB in bytes

# Google OAuth (for token verification if needed)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@ridersos.app"
```

## Frontend (`frontend/.env`)

### Required

```bash
# API URL
VITE_API_URL="http://localhost:3001/api"  # or production URL

# Google OAuth Client ID
VITE_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
```

## Railway Environment Variables

### Backend Service

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Railway reference
JWT_SECRET=<generate-secure-key>
FRONTEND_URL=https://ridersos.app
NODE_ENV=production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-email>
SMTP_PASS=<app-password>
```

### Frontend Service

Set as **Build Arguments** (for Vite):

```bash
VITE_API_URL=https://ridersos-production.up.railway.app/api
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>
```

Note: Vite variables must be prefixed with `VITE_` and are embedded at build time.

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable Google+ API
4. Go to Credentials → Create OAuth 2.0 Client ID
5. Add authorized origins:
   - `http://localhost:5173` (development)
   - `https://ridersos.app` (production)
6. Add authorized redirect URIs (if using server-side flow)
7. Copy Client ID to `VITE_GOOGLE_CLIENT_ID`

## Gmail SMTP Setup

1. Enable 2-Factor Authentication on Gmail
2. Go to Google Account → Security → App passwords
3. Create app password for "Mail"
4. Use this password for `SMTP_PASS`

## Local Development Setup

```bash
# Backend
cd backend
cp .env.example .env  # if exists, or create manually
# Edit .env with local values

# Frontend
cd frontend
cp .env.example .env  # if exists, or create manually
# Edit .env with local values
```

## Security Notes

- Never commit `.env` files to git
- Use strong, unique `JWT_SECRET` in production
- Rotate secrets periodically
- Use environment-specific values (don't use production DB locally)
