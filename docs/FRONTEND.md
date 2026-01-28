# Frontend Documentation

## Overview

The frontend is a React 18 application built with Vite, using Tailwind CSS for styling and shadcn/ui for components.

**Entry Point:** `frontend/src/main.jsx`
**App Component:** `frontend/src/App.jsx`
**Layout:** `frontend/src/Layout.jsx`

## Project Structure

```
frontend/src/
├── api/
│   └── base44Client.js      # API client wrapper
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── AppSidebar.jsx        # Main sidebar navigation
│   ├── InstallAppButton.jsx  # PWA install button
│   ├── LanguageSelector.jsx  # Language switcher
│   ├── Logo.jsx              # App logo component
│   ├── NotificationBell.jsx  # Notifications dropdown
│   └── translations.jsx      # i18n translations
├── pages/                    # Route components
├── lib/
│   └── utils.js              # Utility functions (cn)
└── utils/
    └── index.js              # createPageUrl helper
```

## Pages

### Public Pages (no auth required)
| Page | Path | Description |
|------|------|-------------|
| Home | `/` | Landing page |
| Login | `/Login` | Authentication page |
| Stables | `/Stables` | Browse approved stables |
| StableDetails | `/Stables/:id` | Single stable view |
| ContactUs | `/ContactUs` | Contact form |
| PrivacyPolicy | `/PrivacyPolicy` | Privacy policy |

### Protected Pages (auth required)
| Page | Path | Roles | Description |
|------|------|-------|-------------|
| Dashboard | `/Dashboard` | All | User profile & quick actions |
| RiderProfile | `/RiderProfile` | Rider | Training schedule view |
| MyHorses | `/MyHorses` | Rider | Horse management |
| MyRiders | `/MyRiders` | Trainer | Rider management |
| Schedule | `/Schedule` | Trainer | Session & competition management |
| Billing | `/Billing` | Trainer | Revenue & rates |
| Guardian | `/Guardian` | Parent/Guardian | Monitor children |
| ManageStable | `/ManageStable` | StableManager | Stable management |
| RegisterStable | `/RegisterStable` | Any | Register new stable |
| NotificationSettings | `/NotificationSettings` | All | Notification preferences |
| Admin | `/Admin` | Admin | System administration |

## Key Components

### AppSidebar
**File:** `frontend/src/components/AppSidebar.jsx`

Role-based sidebar navigation using shadcn/ui Sidebar component.

```javascript
// Menu items shown based on user roles:
- Rider: Rider Profile, My Horses
- Trainer: My Riders, Schedule, Billing
- Parent/Guardian: Guardian Dashboard
- StableManager: Manage Stable
- Admin: Admin Panel
```

### InstallAppButton
**File:** `frontend/src/components/InstallAppButton.jsx`

PWA install button that:
- Detects if app is installable
- Shows native install prompt on Chrome/Android
- Shows manual instructions for iOS Safari
- Hides if already installed (standalone mode)

### NotificationBell
**File:** `frontend/src/components/NotificationBell.jsx`

Dropdown showing unread notifications with:
- Unread count badge
- Click to mark as read
- Links to relevant pages

### LanguageSelector
**File:** `frontend/src/components/LanguageSelector.jsx`

Toggle between English and Hebrew:
- Stores preference in localStorage
- Updates document direction (RTL for Hebrew)

### Translations
**File:** `frontend/src/components/translations.jsx`

```javascript
// Usage in components:
import { useTranslation } from '../components/translations';

const t = useTranslation();
// Access: t.nav.home, t.dashboard.welcome, etc.
```

Supports:
- `he` - Hebrew
- `en` - English

## API Client

**File:** `frontend/src/api/base44Client.js`

Wraps Axios with authentication:

```javascript
import { base44 } from '@/api/base44Client';

// Auth methods
base44.auth.me()                    // Get current user
base44.auth.updateMe(data)          // Update user
base44.auth.login(email, password)  // Login
base44.auth.logout(redirectUrl)     // Logout
base44.auth.redirectToLogin(returnUrl)

// Entity operations
base44.entities.Horse.list()
base44.entities.Horse.get(id)
base44.entities.Horse.create(data)
base44.entities.Horse.update(id, data)
base44.entities.Horse.delete(id)
base44.entities.Horse.filter(criteria)

// Available entities:
- User
- Horse
- HorseEvent
- Stable
- StableEvent
- TrainingSession
- Competition
- BillingRate
- MonthlyBillingSummary
- Notification
- NotificationPreference
- UserConnection
- GuardianMinor
- ContactMessage

// Integrations
base44.integrations.Core.UploadFile({ file })
```

## State Management

Uses React hooks for state:
- `useState` for component state
- `useEffect` for side effects and data fetching
- No global state management (props/context as needed)

## Styling

### Tailwind CSS
Custom colors defined in `tailwind.config.js`:
```javascript
colors: {
  primary: '#1B4332',    // Dark green
  secondary: '#8B5A2B',  // Brown
  background: '#FAFAF8', // Off-white
}
```

### shadcn/ui Components
Located in `frontend/src/components/ui/`:
- Button, Card, Input, Label
- Dialog, Sheet, Popover
- Select, Checkbox, Switch
- Avatar, Badge
- Calendar, Tabs
- And more...

## Routing

**File:** `frontend/src/App.jsx`

```javascript
// Public routes (in publicPages array)
<Route path="/" element={<Home />} />
<Route path="/Login" element={<Login />} />
// etc.

// Protected routes (wrapped in Layout)
<Route element={<Layout />}>
  <Route path="/Dashboard" element={<Dashboard />} />
  // etc.
</Route>
```

### Layout Component
**File:** `frontend/src/Layout.jsx`

- Checks authentication
- Shows sidebar for protected pages
- Handles redirects for unauthenticated users
- PUBLIC_PAGES array defines pages without sidebar

## Google OAuth

**File:** `frontend/src/pages/Login.jsx`

Uses `@react-oauth/google`:
```javascript
<GoogleOAuthProvider clientId={VITE_GOOGLE_CLIENT_ID}>
  <GoogleLogin
    onSuccess={handleGoogleSuccess}
    onError={handleGoogleError}
  />
</GoogleOAuthProvider>
```

## Build & Deployment

### Development
```bash
cd frontend
npm run dev  # Starts Vite dev server on :5173
```

### Production Build
```bash
npm run build  # Outputs to dist/
```

### Docker (Railway)
**File:** `frontend/Dockerfile`

Multi-stage build:
1. Build stage: Node.js builds the app
2. Production stage: Nginx serves static files

**Nginx Config:** `frontend/nginx.conf`
- Serves from `/usr/share/nginx/html`
- All routes fallback to `index.html` (SPA)
- Dynamic PORT via envsubst
