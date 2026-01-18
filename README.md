# RidersOS.app - Base44 Migration

This project migrates the RidersOS.app equestrian management application from Base44 platform to an independent, self-hosted stack using Docker and Kubernetes.

## Overview

RidersOS.app is a comprehensive equestrian management platform supporting:
- **Riders**: Track sessions, manage horses, view schedules
- **Trainers**: Schedule sessions, manage billing, track students
- **Guardians/Parents**: Monitor minor riders' activities, handle payments
- **Stable Managers**: Manage stable listings, events, trainers
- **Administrators**: Approve stables, manage platform

### Special Features
- **Minor Protection**: Riders under 18 have guardians who handle all financial matters
- **Session Verification**: Riders verify completed sessions before billing
- **Multi-language**: English (primary) and Hebrew support
- **Horse Health Tracking**: Farrier, vet, vaccination scheduling with reminders

## Architecture

### Previous (Base44)
- React frontend on Base44 infrastructure
- Base44 SDK for data/auth/file storage
- Vendor lock-in with limited portability

### New (Independent)
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│   PostgreSQL    │
│  React + Vite   │     │  Node/Fastify   │     │   Database      │
│   (nginx)       │     │   + Prisma      │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  File Storage   │
                        │  (Local/S3)     │
                        └─────────────────┘
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- PostgreSQL 16+ (if running locally)

### Development with Docker Compose

1. **Clone and setup**:
   ```bash
   cd ridersos-migration
   cp backend/.env.example backend/.env
   # Edit backend/.env with your settings
   ```

2. **Start all services**:
   ```bash
   docker-compose up -d
   ```

3. **Run database migrations**:
   ```bash
   docker-compose exec backend npx prisma migrate dev
   ```

4. **Access the app**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - API Health: http://localhost:3001/api/health

### Local Development (without Docker)

1. **Backend setup**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your PostgreSQL connection
   
   npm install
   npx prisma generate
   npx prisma migrate dev
   npm run dev
   ```

2. **Frontend setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Migration Steps

### Step 1: Update Frontend API Client

Replace the Base44 SDK import in all files:

```javascript
// OLD (Base44)
import { base44 } from '@/api/base44Client';

// NEW (Independent)
import { base44 } from '@/api/client';
```

The new client (`frontend/src/api/client.js`) provides the same interface:
- `base44.auth.me()` → Get current user
- `base44.auth.updateMe(data)` → Update user profile
- `base44.entities.User.list()` → List users
- `base44.entities.User.filter({ email })` → Filter users
- `base44.integrations.Core.UploadFile({ file })` → Upload file

### Step 2: Update Authentication

Replace Base44 auth with JWT-based auth:

1. Update `AuthContext.jsx` to use the new client
2. Add login/register pages (Base44 handled this externally)
3. Store JWT token in localStorage

### Step 3: Remove Base44 Dependencies

Update `package.json`:
```json
// Remove these:
"@base44/sdk": "^0.8.3",
"@base44/vite-plugin": "^0.2.14",
```

Update `vite.config.js` to remove Base44 plugin.

### Step 4: Database Migration

If you have existing data in Base44:
1. Export data via Base44 dashboard (if available)
2. Transform to match Prisma schema
3. Import using Prisma seed scripts

## Project Structure

```
ridersos-migration/
├── backend/
│   ├── src/
│   │   ├── index.js           # Main entry point
│   │   └── routes/
│   │       ├── auth.js        # Authentication endpoints
│   │       ├── users.js       # User management
│   │       ├── horses.js      # Horse & events
│   │       ├── stables.js     # Stable management
│   │       ├── sessions.js    # Training sessions
│   │       ├── competitions.js # Competitions
│   │       ├── billing.js     # Billing & rates
│   │       ├── notifications.js # Notifications
│   │       ├── connections.js # User connections
│   │       ├── contact.js     # Contact messages
│   │       └── uploads.js     # File uploads
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   └── api/
│   │       └── client.js      # New API client (replaces Base44 SDK)
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   └── nginx.conf
├── k8s/
│   ├── 00-namespace-config.yaml
│   ├── 01-postgres.yaml
│   ├── 02-backend.yaml
│   └── 03-frontend-ingress.yaml
├── docker-compose.yml
└── MIGRATION_ANALYSIS.md
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login with email/password |
| POST | /api/auth/google | Login with Google |
| GET | /api/auth/me | Get current user |
| PATCH | /api/auth/me | Update current user |
| POST | /api/auth/logout | Logout |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/users | List all users |
| GET | /api/users/:id | Get user by ID |
| GET | /api/users/by-email/:email | Get user by email |

### Horses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/horses | List/filter horses |
| POST | /api/horses | Create horse |
| PATCH | /api/horses/:id | Update horse |
| DELETE | /api/horses/:id | Delete horse |
| GET | /api/horses/:id/events | List horse events |
| POST | /api/horses/events | Create horse event |

### Training Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/sessions | List/filter sessions |
| POST | /api/sessions | Create session |
| PATCH | /api/sessions/:id | Update session |
| DELETE | /api/sessions/:id | Delete session |
| POST | /api/sessions/:id/verify | Rider verifies session |

### Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/billing/rates | Get billing rates |
| POST | /api/billing/rates | Create/update rate |
| PUT | /api/billing/rates | Bulk update rates |
| GET | /api/billing/summaries | Get monthly summaries |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/notifications | List notifications |
| GET | /api/notifications/unread-count | Get unread count |
| PATCH | /api/notifications/:id/read | Mark as read |
| POST | /api/notifications/mark-all-read | Mark all read |

## Kubernetes Deployment

1. **Create secrets**:
   ```bash
   # Edit k8s/00-namespace-config.yaml with your secrets
   kubectl apply -f k8s/00-namespace-config.yaml
   ```

2. **Deploy database**:
   ```bash
   kubectl apply -f k8s/01-postgres.yaml
   ```

3. **Build and push images**:
   ```bash
   docker build -t your-registry/ridersos-backend:latest ./backend
   docker build -t your-registry/ridersos-frontend:latest ./frontend
   docker push your-registry/ridersos-backend:latest
   docker push your-registry/ridersos-frontend:latest
   ```

4. **Deploy application**:
   ```bash
   # Update image names in k8s files first
   kubectl apply -f k8s/02-backend.yaml
   kubectl apply -f k8s/03-frontend-ingress.yaml
   ```

## Environment Variables

### Backend
| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | Required |
| JWT_SECRET | Secret for JWT signing | Required |
| JWT_EXPIRES_IN | Token expiration | 7d |
| PORT | Server port | 3001 |
| FRONTEND_URL | Frontend URL for CORS | http://localhost:5173 |
| UPLOAD_DIR | File upload directory | ./uploads |
| API_BASE_URL | Base URL for file URLs | http://localhost:3001 |

### Frontend
| Variable | Description | Default |
|----------|-------------|---------|
| VITE_API_URL | Backend API URL | http://localhost:3001/api |

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

## License

Proprietary - All rights reserved.

## Support

For issues or questions, contact the development team.
