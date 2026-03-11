# Equipment Store App Documentation

## Overview
The Equipment Store app is a full-stack solution for managing equipment, consumables, calibration, maintenance, and reservations. It features robust audit logging, secure authentication, input validation, and a user-friendly React frontend.

## Architecture
- **Frontend:** React (with accessibility, validation, performance optimizations)
- **Backend:** Node.js/Express (REST API, JWT authentication, input validation)
- **Database:** Supabase/PostgreSQL (audit triggers, relational schema)
- **Deployment:** Netlify (frontend), GitHub (source control)

## Key Features
- Equipment check-in/check-out with condition and reason tracking
- Consumable addition with duplicate prevention
- Calibration as a destination and site-to-site transfers
- Audit log for all key actions (via Supabase triggers)
- Secure authentication (JWT)
- Input validation and sanitization
- Accessibility (ARIA labels, keyboard navigation)
- Performance (debounce, lazy-load)
- Confirmation dialogs for critical actions

## Backend
- **Routes:**
  - `/movements` (equipment check-in/out)
  - `/consumables` (add consumables)
  - `/users` (user management, bulk import)
  - `/calibration` (calibration records)
  - `/maintenance` (maintenance logs)
  - `/audit` (audit log retrieval)
- **Validation:** Uses `express-validator` for all input
- **Authentication:** JWT required for protected routes
- **Error Handling:** Centralized middleware for consistent responses
- **Audit Triggers:**
  - All key tables have triggers (see `audit_triggers.sql`)
  - Every INSERT, UPDATE, DELETE is logged with user and timestamp

## Frontend
- **Pages:**
  - Dashboard, Equipment, CheckIn, CheckOut, Calibration, Maintenance, Reservations, AuditLog, UserManagement, Reports, Settings
- **Components:**
  - EquipmentImageGallery, OperatorSelector, OperatorWarning, PhotoCapture, etc.
- **Validation:** Dynamic forms, input sanitization, ARIA labels
- **Performance:** Debounced search/filter, lazy-loaded images
- **Accessibility:** ARIA, keyboard navigation, error boundaries
- **Audit Log UI:** Filter controls, modal details, summary cards, pagination

## Database
- **Supabase/PostgreSQL:**
  - Relational schema for equipment, movements, calibration, maintenance, reservations, categories, subcategories, locations, personnel, customers, users
  - Audit log table records all changes
  - Triggers defined in `audit_triggers.sql`

## Deployment
- **Frontend:**
  - Build with `npm run build`
  - Deploy to Netlify
- **Backend:**
  - Deploy to chosen platform (e.g., Heroku, Supabase Edge Functions)
- **Source Control:**
  - GitHub repository (push with `git add . && git commit -m "message" && git push`)

## Testing
- **Unit/Integration Tests:** (To be added)
- **Manual Testing:**
  - Check-in/out flows
  - Consumable addition
  - Calibration and transfers
  - Audit log retrieval
  - Error handling and validation

## Security
- JWT authentication
- Input validation and sanitization
- HTTPS enforced (recommended)

## Accessibility
- ARIA labels
- Keyboard navigation
- Error boundaries

## Auditability
- All changes logged in audit_log
- Triggers ensure traceability for every action

## How to Run Locally
1. Clone the repo
2. Install dependencies in `backend` and `frontend`
3. Configure Supabase/PostgreSQL and run `audit_triggers.sql`
4. Start backend: `npm start` (in backend)
5. Start frontend: `npm start` (in frontend)
6. Build frontend: `npm run build`

## How to Deploy
- Push changes to GitHub
- Deploy frontend to Netlify
- Deploy backend to chosen platform
- Ensure Supabase triggers are active

## Developer Notes
- All routes and forms are validated and sanitized
- Audit triggers are idempotent and cover all key tables
- Accessibility and performance are prioritized
- Error handling is standardized
- Further improvements: add unit/integration tests, update README, expand admin UI

---
For detailed schema and triggers, see `backend/database/audit_triggers.sql`.
For route details, see backend route files.
For UI details, see frontend components and pages.
