# Database Documentation

## Overview

Database: PostgreSQL
ORM: Prisma
Schema File: `backend/prisma/schema.prisma`

## Models

### User
Primary user account model.

```prisma
model User {
  id                    String   @id @default(uuid())
  email                 String   @unique
  passwordHash          String?  // For email/password auth
  firstName             String?  @map("first_name")
  lastName              String?  @map("last_name")
  fullName              String?  @map("full_name")
  role                  String   @default("user") // 'user' or 'admin'
  roles                 String[] @default([]) // ['Rider', 'Trainer', 'Parent/Guardian', 'StableManager', 'Sponsor']
  profileImage          String?  @map("profile_image")
  birthday              DateTime?
  parentEmail           String?  @map("parent_email")
  dashboardCardOrder    String[] @default([]) @map("dashboard_card_order")
  lockerNumber          String?  @map("locker_number")
  googleId              String?  @unique @map("google_id")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")
}
```

**Table:** `users`

### Horse
User's horses.

```prisma
model Horse {
  id              String   @id @default(uuid())
  name            String
  breed           String?
  birthYear       Int?     @map("birth_year")
  color           String?
  height          String?
  microchipNumber String?  @map("microchip_number")
  homeStable      String?  @map("home_stable")
  suiteNumber     String?  @map("suite_number")
  description     String?
  imageUrl        String?  @map("image_url")
  ownerEmail      String   @map("owner_email")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
}
```

**Table:** `horses`

### HorseEvent
Health/maintenance events for horses.

```prisma
model HorseEvent {
  id            String    @id @default(uuid())
  horseId       String    @map("horse_id")
  eventType     String    @map("event_type") // 'Farrier', 'Vaccination', 'Veterinarian', 'Other'
  eventDate     DateTime  @map("event_date")
  providerName  String?   @map("provider_name")
  cost          Decimal?  @db.Decimal(10, 2)
  description   String?
  nextDueDate   DateTime? @map("next_due_date")
  isRecurring   Boolean   @default(false) @map("is_recurring")
  recurringDays Int?      @map("recurring_days")
  completed     Boolean   @default(false)
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
}
```

**Table:** `horse_events`

### Stable
Registered stables/facilities.

```prisma
model Stable {
  id           String   @id @default(uuid())
  name         String
  description  String?
  address      String?
  city         String?
  state        String?
  country      String?
  phone        String?
  email        String?
  latitude     Float?
  longitude    Float?
  images       String[] @default([])
  trainers     String[] @default([]) // Array of trainer emails
  managerEmail String   @map("manager_email")
  status       StableStatus @default(PENDING) // PENDING, APPROVED, REJECTED
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
}

enum StableStatus {
  PENDING
  APPROVED
  REJECTED
}
```

**Table:** `stables`

### StableEvent
Events at stables.

```prisma
model StableEvent {
  id          String   @id @default(uuid())
  stableId    String   @map("stable_id")
  title       String
  eventType   String   @map("event_type") // 'Competition', 'Training', 'Clinic', 'Show', 'Other'
  description String?
  eventDate   DateTime @map("event_date")
  location    String?
  latitude    Float?
  longitude   Float?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
}
```

**Table:** `stable_events`

### TrainingSession
Training sessions between trainer and rider.

```prisma
model TrainingSession {
  id              String   @id @default(uuid())
  trainerEmail    String   @map("trainer_email")
  riderEmail      String   @map("rider_email")
  horseId         String?  @map("horse_id")
  sessionDate     DateTime @map("session_date")
  sessionType     String   @map("session_type") // 'Lesson', 'Training', 'Horse Training', etc.
  duration        Int      @default(60) // minutes
  notes           String?
  isRecurring     Boolean  @default(false) @map("is_recurring")
  recurringWeeks  Int?     @map("recurring_weeks")
  parentSessionId String?  @map("parent_session_id")
  verified        Boolean  @default(false)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
}
```

**Table:** `training_sessions`

### Competition
Competition entries.

```prisma
model Competition {
  id            String   @id @default(uuid())
  trainerEmail  String   @map("trainer_email")
  name          String
  competitionDate DateTime @map("competition_date")
  location      String?
  riders        Json     @default("[]") // Array of {email, service, paymentStatus, amount}
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
}
```

**Table:** `competitions`

### BillingRate
Trainer's rates per session type.

```prisma
model BillingRate {
  id           String   @id @default(uuid())
  trainerEmail String   @map("trainer_email")
  sessionType  String   @map("session_type")
  rate         Decimal  @db.Decimal(10, 2)
  currency     String   @default("USD")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@unique([trainerEmail, sessionType])
}
```

**Table:** `billing_rates`

### MonthlyBillingSummary
Monthly billing summaries for riders.

```prisma
model MonthlyBillingSummary {
  id            String   @id @default(uuid())
  trainerEmail  String   @map("trainer_email")
  riderEmail    String   @map("rider_email")
  month         String   // Format: "YYYY-MM"
  totalAmount   Decimal  @db.Decimal(10, 2) @map("total_amount")
  currency      String   @default("USD")
  sessionCount  Int      @map("session_count")
  status        PaymentStatus @default(PENDING)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@unique([trainerEmail, riderEmail, month])
}

enum PaymentStatus {
  PENDING
  REQUESTED
  PAID
}
```

**Table:** `monthly_billing_summaries`

### Notification
User notifications.

```prisma
model Notification {
  id        String   @id @default(uuid())
  userEmail String   @map("user_email")
  type      String   // 'session', 'payment', 'connection', 'horse', etc.
  title     String
  message   String
  link      String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
}
```

**Table:** `notifications`

### NotificationPreference
User notification preferences.

```prisma
model NotificationPreference {
  id                String   @id @default(uuid())
  userEmail         String   @unique @map("user_email")
  emailNotifications Boolean @default(true) @map("email_notifications")
  sessionReminders  Boolean  @default(true) @map("session_reminders")
  paymentAlerts     Boolean  @default(true) @map("payment_alerts")
  horseReminders    Boolean  @default(true) @map("horse_reminders")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
}
```

**Table:** `notification_preferences`

### UserConnection
Connections between users (trainer-rider, etc.).

```prisma
model UserConnection {
  id              String   @id @default(uuid())
  fromUserEmail   String   @map("from_user_email")
  toUserEmail     String   @map("to_user_email")
  connectionType  String   @map("connection_type") // 'Trainer-Rider'
  status          ConnectionStatus @default(PENDING)
  message         String?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@unique([fromUserEmail, toUserEmail, connectionType])
}

enum ConnectionStatus {
  PENDING
  APPROVED
  REJECTED
}
```

**Table:** `user_connections`

### GuardianMinor
Guardian-minor relationships.

```prisma
model GuardianMinor {
  id            String   @id @default(uuid())
  guardianEmail String   @map("guardian_email")
  minorEmail    String   @map("minor_email")
  relationship  String   @default("parent") // 'parent', 'guardian'
  status        String   @default("active") // 'active', 'pending'
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@unique([guardianEmail, minorEmail])
}
```

**Table:** `guardian_minors`

### ContactMessage
Contact form submissions.

```prisma
model ContactMessage {
  id          String   @id @default(uuid())
  senderEmail String?  @map("sender_email")
  name        String
  email       String
  subject     String
  message     String
  type        String   @default("general") // 'general', 'bug', 'feature', 'support'
  status      String   @default("new") // 'new', 'read', 'resolved'
  createdAt   DateTime @default(now()) @map("created_at")
}
```

**Table:** `contact_messages`

## Database Commands

### Push Schema Changes
```bash
# Local
cd backend && npx prisma db push

# Production
DATABASE_URL="postgresql://..." npx prisma db push
```

### Generate Prisma Client
```bash
npx prisma generate
```

### Open Prisma Studio
```bash
npx prisma studio
```

### Reset Database
```bash
npx prisma migrate reset
```

## Production Database

- **Host:** nozomi.proxy.rlwy.net
- **Port:** 43149
- **Database:** railway
- **User:** postgres
