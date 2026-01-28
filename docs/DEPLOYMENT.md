# Deployment Guide

## Overview

RidersOS is deployed on Railway with:
- PostgreSQL database
- Backend service (Node.js)
- Frontend service (Docker + Nginx)
- Custom domain: ridersos.app (via Cloudflare)

## Railway Setup

### 1. Create Project

1. Go to [Railway](https://railway.app)
2. Create new project
3. Connect GitHub repository

### 2. Add PostgreSQL

1. Click "New" → "Database" → "PostgreSQL"
2. Wait for provisioning
3. Note the `DATABASE_URL` (use public URL for external access)

### 3. Deploy Backend

1. Click "New" → "GitHub Repo"
2. Select the repository
3. Set root directory: `backend`
4. Add environment variables (see ENV.md)
5. Deploy

**Environment Variables:**
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<your-secret>
FRONTEND_URL=https://ridersos.app
NODE_ENV=production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASS=<app-password>
```

### 4. Deploy Frontend

1. Click "New" → "GitHub Repo"
2. Select the repository
3. Set root directory: `frontend`
4. Set builder: Dockerfile
5. Add build arguments:

**Build Arguments (Variables tab):**
```
VITE_API_URL=https://<backend-url>.railway.app/api
VITE_GOOGLE_CLIENT_ID=<your-client-id>
```

### 5. Configure Custom Domain

1. In Frontend service → Settings → Domains
2. Add custom domain: `ridersos.app`
3. Railway provides target CNAME

**Cloudflare DNS Setup:**
1. Add CNAME record:
   - Name: `@` (or `ridersos.app`)
   - Target: `<railway-provided-target>`
   - Proxy: Off (for SSL to work)
2. Wait for SSL certificate provisioning

## Docker Configuration

### Frontend Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf.template
CMD sh -c "envsubst '\$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"
```

### Nginx Configuration

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen $PORT;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

Note: `$PORT` is dynamically set by Railway.

## Database Migrations

After schema changes, update production database:

```bash
cd backend
DATABASE_URL="postgresql://postgres:<password>@nozomi.proxy.rlwy.net:43149/railway" npx prisma db push
```

## Deployment Workflow

### Automatic Deployment

Railway auto-deploys on push to main branch:
1. Push changes to GitHub
2. Railway detects changes
3. Builds and deploys automatically

### Manual Deployment

1. Go to Railway dashboard
2. Select service
3. Click "Deploy" or trigger redeploy

## Monitoring

### Health Check

```bash
# Backend
curl https://ridersos-production.up.railway.app/api/health

# Frontend
curl https://ridersos.app
```

### Logs

1. Go to Railway dashboard
2. Select service
3. Click "Logs" tab

## Rollback

1. Go to Railway dashboard
2. Select service
3. Go to "Deployments"
4. Click on previous deployment
5. Click "Rollback"

## Common Issues

### Frontend 502 Error
- Check Nginx configuration
- Ensure PORT is correctly set via envsubst
- Check build logs for errors

### Database Connection Failed
- Verify DATABASE_URL is correct
- Use public URL (not internal railway.internal)
- Check if database is running

### Google Login Not Working
- Verify VITE_GOOGLE_CLIENT_ID is set as build arg
- Check authorized origins in Google Console
- Rebuild frontend after changing env vars

### Emails Not Sending
- Verify SMTP credentials
- Check Gmail app password (not regular password)
- Verify FRONTEND_URL for email links

## Production URLs

- **Frontend:** https://ridersos.app
- **Backend API:** https://ridersos-production.up.railway.app/api
- **Health Check:** https://ridersos-production.up.railway.app/api/health
