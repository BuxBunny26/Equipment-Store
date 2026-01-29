# Equipment Store - Inventory Management System

A comprehensive web-based equipment inventory management application designed to maintain an accurate, single source of truth for equipment assets.

## Features

### Core Functionality
- ✅ **Equipment Register** - Master list with current state
- ✅ **Check Out / Check In** - Full equipment lifecycle management
- ✅ **Consumables Management** - Issue and restock tracking
- ✅ **Movement History** - Immutable event log for all actions
- ✅ **Controlled Categories** - Predefined categories and subcategories
- ✅ **Location Tracking** - Controlled location dropdown
- ✅ **Personnel Management** - Track who has equipment
- ✅ **Reports & Analytics** - Overdue, available, usage stats

### Business Rules Enforced
- Equipment can only be checked out if status is "Available"
- Equipment can only be checked in if status is "Checked Out"
- Non-checkout categories (Storage & Furniture, Documentation & Media) are blocked
- Consumables use ISSUE/RESTOCK actions (no returns)
- All movements are append-only (cannot be edited or deleted)
- State is system-controlled, derived from movement events
- 14-day overdue threshold (configurable)

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Frontend**: React 18
- **Styling**: Custom CSS (no framework dependencies)

## Project Structure

```
Equipment Store/
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── .env.example
│   ├── database/
│   │   ├── db.js          # Database connection
│   │   ├── init.js        # Database initialization script
│   │   ├── schema.sql     # Database schema with triggers
│   │   └── seed.sql       # Initial data (categories, locations, etc.)
│   └── routes/
│       ├── categories.js
│       ├── subcategories.js
│       ├── locations.js
│       ├── personnel.js
│       ├── equipment.js
│       ├── movements.js
│       └── reports.js
│
├── frontend/
│   ├── package.json
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── index.js
│       ├── App.js
│       ├── styles/
│       │   └── index.css
│       ├── services/
│       │   └── api.js
│       └── pages/
│           ├── Dashboard.js
│           ├── Equipment.js
│           ├── EquipmentDetail.js
│           ├── CheckOut.js
│           ├── CheckIn.js
│           ├── Consumables.js
│           ├── Reports.js
│           └── Settings.js
│
└── README.md
```

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

## Installation

### 1. Clone and Navigate

```bash
cd "Equipment Store"
```

### 2. Set Up PostgreSQL Database

Create a new PostgreSQL database:

```sql
CREATE DATABASE equipment_store;
```

### 3. Configure Backend

```bash
cd backend

# Copy environment template
copy .env.example .env

# Edit .env with your database credentials:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=equipment_store
# DB_USER=postgres
# DB_PASSWORD=your_password_here
# PORT=3001
# OVERDUE_THRESHOLD_DAYS=14

# Install dependencies
npm install

# Initialize database (creates tables and seed data)
npm run db:init
```

### 4. Configure Frontend

```bash
cd ../frontend

# Install dependencies
npm install
```

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- API: http://localhost:3001

### Production Mode

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
# Serve the build folder with your preferred static file server
```

## API Endpoints

### Equipment
- `GET /api/equipment` - List all equipment (with filters)
- `GET /api/equipment/:id` - Get equipment details
- `POST /api/equipment` - Create new equipment
- `PUT /api/equipment/:id` - Update equipment metadata
- `GET /api/equipment/:id/history` - Get movement history

### Movements
- `GET /api/movements` - List movements
- `POST /api/movements` - Create movement (OUT/IN/ISSUE/RESTOCK)
- `POST /api/movements/handover` - Quick handover (atomic IN + OUT)

### Reports
- `GET /api/reports/dashboard` - Dashboard summary
- `GET /api/reports/checked-out` - Currently checked out
- `GET /api/reports/overdue` - Overdue equipment
- `GET /api/reports/available` - Available equipment
- `GET /api/reports/low-stock` - Low stock consumables
- `GET /api/reports/by-category` - Summary by category
- `GET /api/reports/by-location` - Summary by location
- `GET /api/reports/usage-stats` - Usage statistics

### Reference Data
- `GET /api/categories` - List categories
- `GET /api/subcategories` - List subcategories
- `GET /api/locations` - List locations
- `GET /api/personnel` - List personnel

## Initial Data

The seed data includes:

### Categories
| Category | Checkout Allowed | Consumable |
|----------|------------------|------------|
| Sensors & Measurement | Yes | No |
| Cables & Leads | Yes | No |
| Data Loggers & Instruments | Yes | No |
| Calibration & Alignment Tools | Yes | No |
| Power & Charging | Yes | No |
| Mounting & Accessories | Yes | No |
| IT & Computing Equipment | Yes | No |
| Hand Tools | Yes | No |
| Storage & Furniture | **No** | No |
| Safety Equipment | Yes | No |
| Documentation & Media | **No** | No |
| Consumables | Yes | **Yes** |

### Locations
- Main Store, Secondary Store, Office, Workshop
- Site locations (Mine A, Mine B, Plant 1, Plant 2, Refinery, Power Station)
- Client Site, In Transit, Calibration Lab, Repair - External

## Validation Rules

### Check-Out (OUT)
- Equipment must be `Available`
- Category must allow checkout
- Personnel and location are required

### Check-In (IN)
- Equipment must be `Checked Out`
- Return location is required

### Issue (ISSUE) - Consumables Only
- Sufficient stock must be available
- Quantity is deducted from available

### Restock (RESTOCK) - Consumables Only
- Quantity is added to available and total

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | equipment_store |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | - |
| `PORT` | API server port | 3001 |
| `OVERDUE_THRESHOLD_DAYS` | Days before item is overdue | 14 |

## Future Enhancements

Potential additions for v2:
- [ ] User authentication and authorization
- [ ] TRANSFER action for direct equipment handover
- [ ] Barcode/QR code scanning
- [ ] Email notifications for overdue items
- [ ] Equipment maintenance scheduling
- [ ] Attachment support (photos, documents)
- [ ] Export to CSV/PDF
- [ ] Mobile-responsive improvements
- [ ] Audit log viewing

## Support

For issues or questions, please create an issue in the repository.

---

Built with ❤️ for efficient equipment management
