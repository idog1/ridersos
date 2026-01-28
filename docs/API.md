# API Reference

Base URL: `https://ridersos-production.up.railway.app/api`
Local: `http://localhost:3001/api`

## Authentication

All protected endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

## Endpoints

---

### Auth

#### POST /auth/register
Create new user with email/password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "minimum8chars",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "token": "jwt-token",
  "user": { ... }
}
```

#### POST /auth/login
Login with email/password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "token": "jwt-token",
  "user": { ... }
}
```

#### POST /auth/google
Login/register with Google OAuth.

**Request:**
```json
{
  "googleToken": "google-id-token",
  "profile": {
    "email": "user@gmail.com",
    "id": "google-user-id",
    "given_name": "John",
    "family_name": "Doe",
    "name": "John Doe",
    "picture": "https://..."
  }
}
```

#### GET /auth/me
Get current authenticated user.

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "full_name": "John Doe",
  "role": "user",
  "roles": ["Rider", "Trainer"],
  "profile_image": "https://...",
  "birthday": "1990-01-01T00:00:00.000Z",
  "parent_email": null,
  "dashboard_card_order": ["riderProfile", "myHorses"],
  "locker_number": null
}
```

#### PATCH /auth/me
Update current user.

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "roles": ["Rider", "Trainer"],
  "profileImage": "https://...",
  "birthday": "1990-01-01",
  "parentEmail": "parent@example.com",
  "dashboardCardOrder": ["riderProfile", "myHorses"],
  "lockerNumber": "A-15"
}
```

---

### Users

#### GET /users
List all users.

**Query Parameters:**
- `role` - Filter by role

#### GET /users/:id
Get user by ID.

#### POST /users/invite
Invite user by email.

**Request:**
```json
{
  "email": "newuser@example.com",
  "role": "user"
}
```

---

### Horses

#### GET /horses
List current user's horses.

#### GET /horses/:id
Get horse by ID.

#### POST /horses
Create new horse.

**Request:**
```json
{
  "name": "Thunder",
  "breed": "Arabian",
  "birthYear": 2015,
  "color": "Bay",
  "height": "15.2hh",
  "microchipNumber": "123456789",
  "homeStable": "Green Valley Stables",
  "suiteNumber": "A-12",
  "description": "Gentle and calm",
  "imageUrl": "https://..."
}
```

#### PUT /horses/:id
Update horse.

#### DELETE /horses/:id
Delete horse.

#### GET /horses/:id/events
Get horse health events.

#### POST /horses/:id/events
Create health event.

**Request:**
```json
{
  "eventType": "Farrier",
  "eventDate": "2024-01-15",
  "providerName": "John Smith",
  "cost": 85.00,
  "description": "Regular trim",
  "isRecurring": true,
  "recurringDays": 42
}
```

#### PUT /horses/:id/events/:eventId
Update health event.

#### DELETE /horses/:id/events/:eventId
Delete health event.

---

### Stables

#### GET /stables
List all approved stables.

**Query Parameters:**
- `status` - Filter by status (admin only)

#### GET /stables/:id
Get stable details.

#### POST /stables
Register new stable.

**Request:**
```json
{
  "name": "Green Valley Stables",
  "description": "Family-friendly stable",
  "address": "123 Horse Lane",
  "city": "Springfield",
  "state": "CA",
  "country": "USA",
  "phone": "+1234567890",
  "email": "contact@greenvalley.com",
  "latitude": 37.7749,
  "longitude": -122.4194
}
```

#### PUT /stables/:id
Update stable (manager only).

#### GET /stables/:id/trainers
Get stable's trainers.

#### POST /stables/:id/trainers
Add trainer to stable.

**Request:**
```json
{
  "email": "trainer@example.com"
}
```

#### DELETE /stables/:id/trainers/:email
Remove trainer from stable.

#### GET /stables/:id/events
Get stable events.

#### POST /stables/:id/events
Create stable event.

**Request:**
```json
{
  "title": "Spring Show",
  "eventType": "Competition",
  "description": "Annual spring competition",
  "eventDate": "2024-04-15T09:00:00.000Z",
  "location": "Main Arena",
  "latitude": 37.7749,
  "longitude": -122.4194
}
```

---

### Training Sessions

#### GET /sessions
List sessions.

**Query Parameters:**
- `trainerEmail` - Filter by trainer
- `riderEmail` - Filter by rider
- `startDate` - Filter from date
- `endDate` - Filter to date

#### POST /sessions
Create session.

**Request:**
```json
{
  "riderEmail": "rider@example.com",
  "horseId": "horse-uuid",
  "sessionDate": "2024-01-20T10:00:00.000Z",
  "sessionType": "Lesson",
  "duration": 60,
  "notes": "Focus on jumping",
  "isRecurring": true,
  "recurringWeeks": 4
}
```

#### POST /sessions/bulk
Create multiple sessions (Excel import).

**Request:**
```json
{
  "sessions": [
    { ... },
    { ... }
  ]
}
```

#### PUT /sessions/:id
Update session.

#### DELETE /sessions/:id
Delete session.

#### PATCH /sessions/:id/verify
Mark session as verified/completed.

---

### Competitions

#### GET /competitions
List trainer's competitions.

#### POST /competitions
Create competition.

**Request:**
```json
{
  "name": "Regional Championship",
  "competitionDate": "2024-06-15T08:00:00.000Z",
  "location": "State Fairgrounds",
  "riders": [
    {
      "email": "rider1@example.com",
      "service": "Full Day",
      "paymentStatus": "pending",
      "amount": 150
    }
  ]
}
```

#### PUT /competitions/:id
Update competition.

#### DELETE /competitions/:id
Delete competition.

---

### Billing

#### GET /billing/rates
Get trainer's billing rates.

**Response:**
```json
{
  "rates": [
    {
      "sessionType": "Lesson",
      "rate": 75.00,
      "currency": "USD"
    }
  ]
}
```

#### PUT /billing/rates
Update billing rates.

**Request:**
```json
{
  "rates": [
    { "sessionType": "Lesson", "rate": 75.00 },
    { "sessionType": "Training", "rate": 85.00 }
  ],
  "currency": "USD"
}
```

#### GET /billing/summary
Get billing summary.

**Query Parameters:**
- `startDate` - Start of period
- `endDate` - End of period
- `riderEmail` - Filter by rider (optional)

#### GET /billing/monthly
Get monthly billing summaries.

#### POST /billing/request-payment
Send payment request to rider/parent.

**Request:**
```json
{
  "riderEmail": "rider@example.com",
  "month": "2024-01",
  "amount": 450.00
}
```

---

### Connections

#### GET /connections
List user's connections.

**Query Parameters:**
- `status` - Filter by status (pending, approved, rejected)

#### POST /connections
Create connection request.

**Request:**
```json
{
  "toUserEmail": "rider@example.com",
  "connectionType": "Trainer-Rider",
  "message": "I'd like to add you as my rider"
}
```

#### PUT /connections/:id
Update connection (approve/reject).

**Request:**
```json
{
  "status": "approved"
}
```

#### DELETE /connections/:id
Delete connection.

---

### Notifications

#### GET /notifications
List user's notifications.

**Query Parameters:**
- `unreadOnly` - Only show unread

#### PUT /notifications/:id/read
Mark notification as read.

#### PUT /notifications/read-all
Mark all as read.

#### GET /notifications/preferences
Get notification preferences.

#### PUT /notifications/preferences
Update preferences.

**Request:**
```json
{
  "emailNotifications": true,
  "sessionReminders": true,
  "paymentAlerts": true,
  "horseReminders": true
}
```

---

### Uploads

#### POST /uploads
Upload file.

**Request:** `multipart/form-data`
- `file` - The file to upload

**Response:**
```json
{
  "file_url": "/uploads/filename.jpg"
}
```

#### DELETE /uploads/:filename
Delete uploaded file.

---

### Contact

#### POST /contact
Submit contact form.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Question",
  "message": "I have a question...",
  "type": "general"
}
```

#### GET /contact
List contact messages (admin only).

---

### Health Check

#### GET /health
Check API status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-20T10:00:00.000Z"
}
```

---

## Error Responses

```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

**Status Codes:**
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate entry)
- `500` - Internal Server Error
