# Backend Documentation

## Overview

The backend is a Fastify application with Prisma ORM connecting to PostgreSQL.

**Entry Point:** `backend/src/index.js`

## Server Setup

```javascript
// Key plugins registered:
- @fastify/cors (FRONTEND_URL origin)
- @fastify/cookie
- @fastify/jwt (JWT_SECRET, 7d expiry)
- @fastify/multipart (10MB file limit)
- @fastify/static (uploads directory)
```

## Routes

All routes are prefixed with `/api/`

### Auth Routes (`/api/auth`)
**File:** `backend/src/routes/auth.js`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Email/password registration | No |
| POST | `/login` | Email/password login | No |
| POST | `/google` | Google OAuth login/register | No |
| GET | `/me` | Get current user | Yes |
| PATCH | `/me` | Update current user | Yes |
| POST | `/logout` | Logout (client-side) | Yes |
| GET | `/verify` | Verify token validity | Yes |

**Welcome Emails:** Automatically sent on:
- New user registration (welcomeUser)
- Trainer role assigned (welcomeTrainer)
- Parent/Guardian role assigned (welcomeGuardian)

### User Routes (`/api/users`)
**File:** `backend/src/routes/users.js`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List all users | Yes |
| GET | `/:id` | Get user by ID | Yes |
| POST | `/invite` | Invite user by email | Yes |

### Horse Routes (`/api/horses`)
**File:** `backend/src/routes/horses.js`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List user's horses | Yes |
| GET | `/:id` | Get horse by ID | Yes |
| POST | `/` | Create horse | Yes |
| PUT | `/:id` | Update horse | Yes |
| DELETE | `/:id` | Delete horse | Yes |
| GET | `/:id/events` | Get horse health events | Yes |
| POST | `/:id/events` | Create health event | Yes |
| PUT | `/:id/events/:eventId` | Update health event | Yes |
| DELETE | `/:id/events/:eventId` | Delete health event | Yes |

### Stable Routes (`/api/stables`)
**File:** `backend/src/routes/stables.js`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List all approved stables | No |
| GET | `/:id` | Get stable by ID | No |
| POST | `/` | Register new stable | Yes |
| PUT | `/:id` | Update stable | Yes |
| GET | `/:id/trainers` | Get stable trainers | No |
| POST | `/:id/trainers` | Add trainer to stable | Yes |
| DELETE | `/:id/trainers/:email` | Remove trainer | Yes |
| GET | `/:id/events` | Get stable events | No |
| POST | `/:id/events` | Create stable event | Yes |
| PUT | `/:id/events/:eventId` | Update event | Yes |
| DELETE | `/:id/events/:eventId` | Delete event | Yes |

### Session Routes (`/api/sessions`)
**File:** `backend/src/routes/sessions.js`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List sessions (filtered) | Yes |
| GET | `/:id` | Get session by ID | Yes |
| POST | `/` | Create session | Yes |
| POST | `/bulk` | Create multiple sessions | Yes |
| PUT | `/:id` | Update session | Yes |
| DELETE | `/:id` | Delete session | Yes |
| PATCH | `/:id/verify` | Verify session completed | Yes |

### Competition Routes (`/api/competitions`)
**File:** `backend/src/routes/competitions.js`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List competitions | Yes |
| GET | `/:id` | Get competition by ID | Yes |
| POST | `/` | Create competition | Yes |
| PUT | `/:id` | Update competition | Yes |
| DELETE | `/:id` | Delete competition | Yes |

### Billing Routes (`/api/billing`)
**File:** `backend/src/routes/billing.js`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/rates` | Get trainer's rates | Yes |
| PUT | `/rates` | Update rates | Yes |
| GET | `/summary` | Get billing summary | Yes |
| GET | `/monthly` | Get monthly summaries | Yes |
| POST | `/request-payment` | Send payment request | Yes |

### Connection Routes (`/api/connections`)
**File:** `backend/src/routes/connections.js`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List user connections | Yes |
| POST | `/` | Create connection request | Yes |
| PUT | `/:id` | Update connection status | Yes |
| DELETE | `/:id` | Delete connection | Yes |

### Notification Routes (`/api/notifications`)
**File:** `backend/src/routes/notifications.js`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List user notifications | Yes |
| PUT | `/:id/read` | Mark as read | Yes |
| PUT | `/read-all` | Mark all as read | Yes |
| GET | `/preferences` | Get notification prefs | Yes |
| PUT | `/preferences` | Update notification prefs | Yes |

### Upload Routes (`/api/uploads`)
**File:** `backend/src/routes/uploads.js`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/` | Upload file | Yes |
| DELETE | `/:filename` | Delete file | Yes |

### Contact Routes (`/api/contact`)
**File:** `backend/src/routes/contact.js`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/` | Submit contact form | No |
| GET | `/` | List contact messages | Admin |

## Services

### Email Service
**File:** `backend/src/services/email.js`

```javascript
// Initialize
initEmailService() // Uses SMTP_* env vars

// Send email
sendEmail({ to, subject, text, html })

// Templates available:
emailTemplates.connectionRequest(fromName, toName, message)
emailTemplates.sessionScheduled(riderName, trainerName, date, type)
emailTemplates.sessionUpdated(riderName, trainerName, date, changes)
emailTemplates.sessionCancelled(riderName, trainerName, date)
emailTemplates.paymentRequest(riderName, trainerName, amount, currency, month)
emailTemplates.horseCareReminder(ownerName, horseName, eventType, dueDate)
emailTemplates.guardianInvite(guardianName, minorName, minorEmail)
emailTemplates.trainerInvite(trainerName, riderEmail)
emailTemplates.stableTrainerInvite(stableName, trainerEmail)
emailTemplates.welcomeUser(userName)
emailTemplates.welcomeTrainer(trainerName)
emailTemplates.welcomeGuardian(guardianName)
```

## Authentication

### JWT Authentication
- Token generated on login/register
- Includes: `{ id, email }`
- Expiry: 7 days (configurable via JWT_EXPIRES_IN)
- Passed in Authorization header: `Bearer <token>`

### Decorators
```javascript
fastify.authenticate    // Requires valid JWT
fastify.optionalAuth    // Sets user if token exists, doesn't fail
```

### Google OAuth Flow
1. Frontend gets Google token via @react-oauth/google
2. Frontend sends token + profile to `/api/auth/google`
3. Backend creates/links user account
4. Backend returns JWT token

## Error Handling

```javascript
// Prisma errors
P2002 → 409 Conflict (duplicate)
P2025 → 404 Not Found

// Validation errors (Zod)
→ 400 Bad Request with details

// Auth errors
→ 401 Unauthorized
```
