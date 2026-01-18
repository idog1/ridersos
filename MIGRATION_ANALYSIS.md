# RidersOS.app - Base44 to Independent Stack Migration Analysis

## Executive Summary

This document outlines the complete migration strategy for RidersOS.app from Base44's platform to an independent, self-hosted solution using Docker/Kubernetes.

## Current Architecture (Base44)

### Technology Stack
- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui (Radix)
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router DOM v6
- **Data Layer**: Base44 SDK (`@base44/sdk`)
- **Authentication**: Base44 Auth (OAuth-based)
- **File Storage**: Base44 Core Integration
- **Build Tool**: Vite with Base44 plugin

### Identified Entities (Database Schema)

#### 1. User
```typescript
interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  roles: string[]; // ['Rider', 'Trainer', 'Parent/Guardian', 'StableManager', 'admin']
  profile_image?: string;
  birthday?: string; // ISO date
  parent_email?: string; // For minors
  dashboard_card_order?: string[];
  locker_number?: string;
  role?: string; // Legacy field
  created_date: string;
  updated_date: string;
}
```

#### 2. UserConnection (Trainer-Rider/Guardian relationships)
```typescript
interface UserConnection {
  id: string;
  from_user_email: string;
  to_user_email: string;
  connection_type: string; // 'Trainer-Rider'
  status: 'pending' | 'approved' | 'rejected';
  created_date: string;
}
```

#### 3. GuardianMinor (Parent-Child relationships)
```typescript
interface GuardianMinor {
  id: string;
  guardian_email: string;
  minor_email: string;
  status: 'active' | 'inactive';
  created_date: string;
}
```

#### 4. Horse
```typescript
interface Horse {
  id: string;
  owner_email: string;
  name: string;
  home_stable_name?: string;
  suite_number?: string;
  breed?: string;
  birth_year?: number;
  color?: string;
  height?: string;
  chip_number?: string;
  description?: string;
  image_url?: string;
  created_date: string;
  updated_date: string;
}
```

#### 5. HorseEvent (Health/Care tracking)
```typescript
interface HorseEvent {
  id: string;
  horse_id: string;
  event_type: 'Farrier' | 'Vaccination' | 'Veterinarian' | 'Other';
  event_date: string;
  provider_name?: string;
  description?: string;
  cost?: number;
  next_due_date?: string;
  notes?: string;
  status: 'scheduled' | 'completed';
  completed_date?: string;
  is_recurring: boolean;
  recurrence_weeks?: number;
  reminder_weeks_before?: number;
  reminder_email?: string;
  created_date: string;
}
```

#### 6. Stable
```typescript
interface Stable {
  id: string;
  name: string;
  manager_email: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  description?: string;
  images?: string[];
  approval_status: 'pending' | 'approved' | 'rejected';
  created_date: string;
  updated_date: string;
}
```

#### 7. StableEvent
```typescript
interface StableEvent {
  id: string;
  stable_id: string;
  title: string;
  event_type: 'Competition' | 'Training' | 'Clinic' | 'Show' | 'Other';
  description?: string;
  event_date: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  created_date: string;
}
```

#### 8. TrainingSession
```typescript
interface TrainingSession {
  id: string;
  trainer_email: string;
  rider_email: string;
  rider_name?: string;
  horse_name?: string;
  session_date: string; // ISO datetime
  duration: number; // minutes
  session_type: 'Lesson' | 'Training' | 'Horse Training' | 'Horse Transport' | 'Competition Prep' | 'Evaluation' | 'Other';
  notes?: string;
  is_recurring: boolean;
  recurrence_weeks?: number;
  rider_verified: boolean;
  rider_verified_date?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  created_date: string;
  updated_date: string;
}
```

#### 9. Competition
```typescript
interface Competition {
  id: string;
  trainer_email: string;
  name: string;
  competition_date: string;
  location: string;
  riders: CompetitionRider[];
  created_date: string;
  updated_date: string;
}

interface CompetitionRider {
  rider_email: string;
  rider_name?: string;
  services: string[]; // Service types like 'Competition Prep'
  payment_status: 'pending' | 'requested' | 'paid';
}
```

#### 10. BillingRate
```typescript
interface BillingRate {
  id: string;
  trainer_email: string;
  session_type: string;
  currency: 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'ILS';
  rate: number;
  created_date: string;
  updated_date: string;
}
```

#### 11. MonthlyBillingSummary
```typescript
interface MonthlyBillingSummary {
  id: string;
  trainer_email: string;
  rider_email: string;
  month: string; // 'YYYY-MM' format
  sessions_revenue: number;
  competitions_revenue: number;
  total_revenue: number;
  currency: string;
  session_count: number;
  payment_requested: boolean;
  payment_status: 'pending' | 'paid';
  created_date: string;
}
```

#### 12. Notification
```typescript
interface Notification {
  id: string;
  user_email: string;
  type: 'session_scheduled' | 'session_cancelled' | 'payment_request' | 'connection_request' | 'horse_care_reminder';
  title: string;
  message: string;
  related_entity_type?: string;
  related_entity_id?: string;
  read: boolean;
  created_date: string;
}
```

#### 13. NotificationPreference
```typescript
interface NotificationPreference {
  id: string;
  user_email: string;
  notification_type: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  updated_date: string;
}
```

#### 14. ContactMessage
```typescript
interface ContactMessage {
  id: string;
  sender_email?: string;
  sender_name?: string;
  type: 'general' | 'bug_report' | 'feature_suggestion';
  subject: string;
  message: string;
  status: 'new' | 'read' | 'resolved';
  created_date: string;
}
```

## Base44 SDK Usage Patterns

### Authentication
```javascript
base44.auth.me()              // Get current user
base44.auth.updateMe(data)    // Update current user
base44.auth.redirectToLogin() // Redirect to login
base44.auth.logout()          // Logout
```

### Entity Operations
```javascript
base44.entities.[Entity].create(data)     // Create new record
base44.entities.[Entity].list()           // List all records
base44.entities.[Entity].filter(criteria) // Filter records
base44.entities.[Entity].update(id, data) // Update record
base44.entities.[Entity].delete(id)       // Delete record
```

### File Uploads
```javascript
base44.integrations.Core.UploadFile({ file }) // Returns { file_url }
```

## Business Logic Requirements

### 1. Minor (Under 18) Handling
- If rider's age < 18, they must have a parent_email
- Payment requests and notifications route to guardian
- Guardian can view all sessions and billing for their children
- Guardian relationships stored in GuardianMinor entity

### 2. Role-Based Access
- **Rider**: View schedule, horses, verify sessions
- **Trainer**: Create sessions, manage riders, set billing rates
- **Parent/Guardian**: View children's activities, handle payments
- **StableManager**: Manage stable details, events, trainers
- **Admin**: Approve stables, manage contact messages

### 3. Session Verification Flow
1. Trainer creates session
2. Rider receives notification
3. Rider verifies session completion
4. Session becomes billable

### 4. Billing Flow
1. Trainer sets rates per session type
2. Sessions accrue throughout month
3. Monthly summary generated
4. Payment request sent to rider (or guardian if minor)

## Migration Target Architecture

### Backend Stack
- **Runtime**: Node.js 20 LTS
- **Framework**: Fastify (faster than Express)
- **Database**: PostgreSQL 16 with Prisma ORM
- **Authentication**: JWT + Passport.js (Google/Email OAuth)
- **File Storage**: MinIO (S3-compatible) or local storage
- **Email**: Nodemailer with any SMTP provider

### Frontend Stack (Minimal Changes)
- Keep existing React + Vite + Tailwind setup
- Replace `@base44/sdk` with custom API client
- Replace `@base44/vite-plugin` with standard Vite config

### Infrastructure
- **Development**: Docker Compose
- **Production**: Kubernetes manifests
- **Database Persistence**: Docker volumes / K8s PVC

## Migration Steps

### Phase 1: Backend Setup
1. Create Node.js/Fastify API server
2. Set up PostgreSQL with Prisma schema
3. Implement JWT authentication
4. Create REST API endpoints for all entities
5. Implement file upload service

### Phase 2: Frontend Adaptation
1. Create new API client to replace Base44 SDK
2. Update authentication context
3. Update all API calls in pages/components
4. Test all functionality

### Phase 3: Containerization
1. Create Dockerfile for frontend (nginx)
2. Create Dockerfile for backend (Node.js)
3. Create docker-compose.yml for local dev
4. Create Kubernetes manifests for production

### Phase 4: Data Migration
1. Export data from Base44 (if possible)
2. Create migration scripts
3. Import data to new database

## Files to Modify

### Remove
- `src/api/base44Client.js`
- `@base44/sdk` dependency
- `@base44/vite-plugin` dependency

### Create
- `src/api/client.js` - New API client
- `src/api/auth.js` - Auth helpers
- Backend folder with full API implementation

### Modify
- All pages that use `base44` client
- `src/lib/AuthContext.jsx`
- `vite.config.js`
- `package.json`

## Hebrew/RTL Support
- Current: LTR only with Hebrew text translations
- Recommendation: Keep LTR, Hebrew works fine without RTL in this context
- Alternative: Add RTL toggle with Tailwind's `rtl:` prefix if needed later
