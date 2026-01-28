# RidersOS Documentation

## Overview

RidersOS is a comprehensive equestrian management platform designed for trainers, riders, parents/guardians, and stable managers. The application is built with a modern tech stack and deployed on Railway.

## Tech Stack

### Frontend
- **Framework:** React 18 with Vite
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Routing:** React Router DOM
- **State Management:** React hooks (useState, useEffect)
- **Animations:** Framer Motion
- **Drag & Drop:** @hello-pangea/dnd
- **Icons:** Lucide React
- **HTTP Client:** Axios (wrapped in base44Client)

### Backend
- **Framework:** Fastify
- **Database ORM:** Prisma
- **Database:** PostgreSQL
- **Authentication:** JWT (@fastify/jwt) + Google OAuth
- **File Uploads:** @fastify/multipart
- **Email:** Nodemailer
- **Validation:** Zod

### Deployment
- **Platform:** Railway
- **Frontend:** Docker + Nginx
- **Backend:** Node.js
- **Database:** Railway PostgreSQL
- **Domain:** ridersos.app (Cloudflare DNS)

## Project Structure

```
ridersos/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components (routes)
│   │   ├── api/              # API client (base44Client)
│   │   └── utils/            # Utility functions
│   ├── public/               # Static assets
│   ├── Dockerfile            # Production Docker build
│   └── nginx.conf            # Nginx configuration
│
├── backend/                  # Fastify backend API
│   ├── src/
│   │   ├── routes/           # API route handlers
│   │   ├── services/         # Business logic services
│   │   └── index.js          # Server entry point
│   ├── prisma/
│   │   └── schema.prisma     # Database schema
│   └── uploads/              # File upload directory
│
├── docs/                     # Documentation
└── VIDEO_SCRIPT*.md          # Video tutorial scripts
```

## Documentation Index

- [Backend Documentation](./BACKEND.md) - API routes, services, authentication
- [Frontend Documentation](./FRONTEND.md) - Components, pages, state management
- [Database Schema](./DATABASE.md) - Prisma models and relationships
- [API Reference](./API.md) - All API endpoints
- [Deployment Guide](./DEPLOYMENT.md) - Railway deployment instructions
- [Environment Variables](./ENV.md) - Required configuration

## User Roles

1. **Rider** - View training schedule, manage horses, track health events
2. **Trainer** - Manage riders, schedule sessions, track billing/revenue
3. **Parent/Guardian** - Monitor children's activities, view payments
4. **Stable Manager** - Register/manage stable, add trainers, create events
5. **Admin** - System administration (set via database)

## Key Features

- Google OAuth authentication
- Multi-role support (users can have multiple roles)
- Training session scheduling with recurring sessions
- Horse health tracking with reminders
- Billing and revenue management
- Competition management
- Email notifications
- PWA install support
- Hebrew/English localization
