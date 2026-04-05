# Finance Dashboard API

A backend REST API for a finance dashboard with role-based access control, built with Node.js, Express, PostgreSQL, and Prisma ORM.

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Runtime | Node.js + Express | Lightweight, widely adopted, easy to structure |
| Database | PostgreSQL | Relational model fits users + financial records well |
| ORM | Prisma | Clean schema definition, auto migrations, type-safe queries |
| Auth | JWT | Stateless, simple to verify across routes |
| Validation | Zod | Schema-first, field-level error messages out of the box |
| Docs | Swagger (OpenAPI 3.0) | Interactive, self-documenting, testable from browser |

---

## Project Structure

```
finance-dashboard/
├── .env                          # Environment variables (not committed)
├── .env.example                  # Template for environment setup
├── package.json
│
├── prisma/
│   ├── schema.prisma             # Database schema (tables, enums, relations)
│   └── seed.js                   # Seeds test users and sample financial records
│
└── src/
    ├── app.js                    # Entry point — middleware, routes, server start
    │
    ├── config/
    │   ├── db.js                 # Prisma client singleton
    │   └── swagger.js            # OpenAPI spec configuration
    │
    ├── middleware/
    │   ├── auth.js               # JWT verification + role-based authorization guard
    │   └── errorHandler.js       # Global error handler, asyncHandler, createError
    │
    ├── modules/
    │   ├── auth/
    │   │   └── auth.routes.js    # POST /register, POST /login, GET /me
    │   ├── users/
    │   │   └── users.routes.js   # Admin-only user management
    │   ├── records/
    │   │   └── records.routes.js # Financial records CRUD with filtering
    │   └── dashboard/
    │       └── dashboard.routes.js # Summary and analytics endpoints
    │
    └── utils/
        └── pagination.js         # Pagination query parsing and metadata builder
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Rename `.env.example` to `.env` and fill in your values:

```env
DATABASE_URL="postgresql://postgres:YOURPASSWORD@localhost:5432/finance_dashboard"
JWT_SECRET="any-long-random-string"
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV=development
```

### 3. Create the database

In pgAdmin or psql:

```sql
CREATE DATABASE finance_dashboard;
```

### 4. Run migrations

```bash
npx prisma migrate dev --name init
```

### 5. Generate Prisma client

```bash
npx prisma generate
```

### 6. Seed test data

```bash
node prisma/seed.js
```

### 7. Start the server

```bash
npm run dev
```

Server runs at: `http://localhost:3000`
Swagger docs at: `http://localhost:3000/api-docs`

---

## Test Credentials

Seeded automatically by `seed.js`:

| Role | Email | Password |
|---|---|---|
| Admin | admin@finance.com | admin123 |
| Analyst | analyst@finance.com | analyst123 |
| Viewer | viewer@finance.com | viewer123 |

---

## API Reference

> All protected endpoints require the header:
> `Authorization: Bearer <token>`
> Get a token by calling `POST /api/auth/login` first.

---

### Auth

#### POST `/api/auth/register`
Register a new user. New users are assigned the VIEWER role by default.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "john1234"
}
```

**Response `201`:**
```json
{
  "success": true,
  "message": "Registration successful.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "VIEWER",
      "status": "ACTIVE"
    }
  }
}
```

---

#### POST `/api/auth/login`
Login and receive a JWT token.

**Request:**
```json
{
  "email": "admin@finance.com",
  "password": "admin123"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "name": "Admin User",
      "email": "admin@finance.com",
      "role": "ADMIN",
      "status": "ACTIVE"
    }
  }
}
```

---

#### GET `/api/auth/me`
Returns the currently authenticated user.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Admin User",
      "email": "admin@finance.com",
      "role": "ADMIN",
      "status": "ACTIVE"
    }
  }
}
```

---

### Users
> All user endpoints require Admin role.

#### GET `/api/users`
List all users with optional filters and pagination.

**Query params:** `role`, `status`, `page`, `limit`

```
GET /api/users
GET /api/users?role=ANALYST
GET /api/users?status=ACTIVE&page=1&limit=10
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "name": "Admin User",
        "email": "admin@finance.com",
        "role": "ADMIN",
        "status": "ACTIVE",
        "createdAt": "2026-04-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 3,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

---

#### POST `/api/users`
Create a new user with a specific role.

**Request:**
```json
{
  "name": "Sara Khan",
  "email": "sara@finance.com",
  "password": "sara1234",
  "role": "ANALYST"
}
```

**Response `201`:**
```json
{
  "success": true,
  "message": "User created.",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Sara Khan",
      "email": "sara@finance.com",
      "role": "ANALYST",
      "status": "ACTIVE"
    }
  }
}
```

---

#### GET `/api/users/:id`
Get a single user by ID.

```
GET /api/users/uuid-here
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Sara Khan",
      "email": "sara@finance.com",
      "role": "ANALYST",
      "status": "ACTIVE"
    }
  }
}
```

---

#### PATCH `/api/users/:id`
Update a user's name, email, role, or status.

**Request:**
```json
{
  "role": "ADMIN"
}
```

Deactivate a user:
```json
{
  "status": "INACTIVE"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "User updated.",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Sara Khan",
      "role": "ADMIN",
      "status": "ACTIVE"
    }
  }
}
```

---

#### DELETE `/api/users/:id`
Deactivates a user (soft delete — sets status to INACTIVE).

**Response `200`:**
```json
{
  "success": true,
  "message": "User deactivated."
}
```

---

### Financial Records

#### GET `/api/records`
List records with optional filters and pagination. Accessible by all authenticated users.

**Query params:** `type`, `category`, `startDate`, `endDate`, `page`, `limit`

```
GET /api/records
GET /api/records?type=INCOME
GET /api/records?type=EXPENSE&category=Rent
GET /api/records?startDate=2026-03-01&endDate=2026-03-31
GET /api/records?type=EXPENSE&page=1&limit=5
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": "uuid",
        "amount": "85000.00",
        "type": "INCOME",
        "category": "Salary",
        "date": "2026-04-01T00:00:00.000Z",
        "notes": "Monthly salary April",
        "createdBy": {
          "id": "uuid",
          "name": "Admin User",
          "email": "admin@finance.com"
        }
      }
    ],
    "pagination": {
      "total": 30,
      "page": 1,
      "limit": 20,
      "totalPages": 2,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

#### GET `/api/records/:id`
Get a single record by ID.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "record": {
      "id": "uuid",
      "amount": "85000.00",
      "type": "INCOME",
      "category": "Salary",
      "date": "2026-04-01T00:00:00.000Z",
      "notes": "Monthly salary April",
      "isDeleted": false,
      "createdBy": {
        "id": "uuid",
        "name": "Admin User"
      }
    }
  }
}
```

---

#### POST `/api/records`
Create a financial record. Requires ANALYST or ADMIN role.

**Income example:**
```json
{
  "amount": 85000,
  "type": "INCOME",
  "category": "Salary",
  "date": "2026-04-01",
  "notes": "Monthly salary April"
}
```

**Expense example:**
```json
{
  "amount": 25000,
  "type": "EXPENSE",
  "category": "Rent",
  "date": "2026-04-01",
  "notes": "April office rent"
}
```

**More examples to seed variety:**
```json
{ "amount": 12500, "type": "INCOME", "category": "Freelance", "date": "2026-04-03", "notes": "Website project" }
{ "amount": 5000,  "type": "INCOME", "category": "Investment", "date": "2026-03-28", "notes": "Stock dividends Q1" }
{ "amount": 4500,  "type": "EXPENSE", "category": "Utilities", "date": "2026-04-02", "notes": "Electricity and internet" }
{ "amount": 8900,  "type": "EXPENSE", "category": "Software", "date": "2026-04-03", "notes": "Annual SaaS subscriptions" }
{ "amount": 15000, "type": "EXPENSE", "category": "Marketing", "date": "2026-03-20", "notes": "Google Ads campaign" }
{ "amount": 3100,  "type": "EXPENSE", "category": "Groceries", "date": "2026-03-30", "notes": "Office pantry restock" }
```

**Response `201`:**
```json
{
  "success": true,
  "message": "Record created.",
  "data": {
    "record": {
      "id": "uuid",
      "amount": "85000.00",
      "type": "INCOME",
      "category": "Salary",
      "date": "2026-04-01T00:00:00.000Z",
      "notes": "Monthly salary April"
    }
  }
}
```

---

#### PATCH `/api/records/:id`
Update a record. Analysts can only update their own records. Admins can update any.

**Request:**
```json
{
  "amount": 90000,
  "notes": "Salary revised after appraisal"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Record updated.",
  "data": {
    "record": {
      "id": "uuid",
      "amount": "90000.00",
      "notes": "Salary revised after appraisal"
    }
  }
}
```

---

#### DELETE `/api/records/:id`
Soft-deletes a record (sets `isDeleted: true`). Analysts can only delete their own records.

**Response `200`:**
```json
{
  "success": true,
  "message": "Record deleted."
}
```

---

### Dashboard

#### GET `/api/dashboard/summary`
Overall financial summary. Accessible by all authenticated users.

```
GET /api/dashboard/summary
GET /api/dashboard/summary?startDate=2026-04-01&endDate=2026-04-30
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalIncome": 105700,
      "totalExpenses": 56500,
      "netBalance": 49200,
      "totalRecords": 9,
      "incomeCount": 4,
      "expenseCount": 5
    },
    "period": {
      "startDate": "2026-04-01",
      "endDate": "2026-04-30"
    }
  }
}
```

---

#### GET `/api/dashboard/recent`
Most recent financial activity. Accessible by all authenticated users.

```
GET /api/dashboard/recent
GET /api/dashboard/recent?limit=5
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": "uuid",
        "amount": "8900.00",
        "type": "EXPENSE",
        "category": "Software",
        "date": "2026-04-03T00:00:00.000Z",
        "notes": "Annual SaaS subscriptions",
        "createdBy": { "id": "uuid", "name": "Admin User" }
      }
    ]
  }
}
```

---

#### GET `/api/dashboard/by-category`
Totals broken down by category. Requires ANALYST or ADMIN role.

```
GET /api/dashboard/by-category
GET /api/dashboard/by-category?startDate=2026-03-01&endDate=2026-04-30
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "categories": [
      { "category": "Salary",     "income": 85000, "expense": 0,     "net": 85000,  "count": 1 },
      { "category": "Rent",       "income": 0,     "expense": 25000, "net": -25000, "count": 1 },
      { "category": "Freelance",  "income": 15700, "expense": 0,     "net": 15700,  "count": 2 },
      { "category": "Marketing",  "income": 0,     "expense": 15000, "net": -15000, "count": 1 },
      { "category": "Software",   "income": 0,     "expense": 8900,  "net": -8900,  "count": 1 }
    ]
  }
}
```

---

#### GET `/api/dashboard/monthly-trends`
Month-by-month income vs expense for a given year. Requires ANALYST or ADMIN role.

```
GET /api/dashboard/monthly-trends?year=2026
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "year": 2026,
    "trends": [
      { "month": 1,  "label": "Jan", "income": 0,      "expense": 0,     "net": 0 },
      { "month": 2,  "label": "Feb", "income": 0,      "expense": 0,     "net": 0 },
      { "month": 3,  "label": "Mar", "income": 8200,   "expense": 18100, "net": -9900 },
      { "month": 4,  "label": "Apr", "income": 97500,  "expense": 38400, "net": 59100 }
    ]
  }
}
```

---

#### GET `/api/dashboard/weekly-trends`
Last 12 weeks of activity. Requires ANALYST or ADMIN role.

```
GET /api/dashboard/weekly-trends
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "weeks": [
      { "week": "2026-W11", "income": 3200,  "expense": 15000, "net": -11800 },
      { "week": "2026-W13", "income": 5000,  "expense": 3100,  "net": 1900 },
      { "week": "2026-W14", "income": 97500, "expense": 38400, "net": 59100 }
    ]
  }
}
```

---

## Access Control

Roles follow a strict hierarchy: **ADMIN > ANALYST > VIEWER**

```
VIEWER   → Read records, view basic dashboard summary and recent activity
ANALYST  → Create/edit/delete own records, access full analytics
ADMIN    → Full access: manage users, edit any record, all analytics
```

### Expected 403 responses (access control working correctly)

| Token | Endpoint | Result |
|---|---|---|
| Viewer | `POST /api/records` | 403 Forbidden |
| Viewer | `GET /api/users` | 403 Forbidden |
| Viewer | `GET /api/dashboard/by-category` | 403 Forbidden |
| Analyst | `GET /api/users` | 403 Forbidden |
| Analyst | `DELETE /api/records/:id` (another user's record) | 403 Forbidden |

### Expected 401 responses

```
Authorization: Bearer faketoken123   →  401 Invalid token
(no Authorization header)            →  401 Access denied
```

---

## Error Response Format

All errors follow a consistent structure:

**Validation error `400`:**
```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": [
    { "field": "amount", "message": "Amount must be a positive number" },
    { "field": "type",   "message": "Invalid enum value. Expected 'INCOME' | 'EXPENSE'" }
  ]
}
```

**Not found `404`:**
```json
{
  "success": false,
  "message": "Record not found."
}
```

**Conflict `409`:**
```json
{
  "success": false,
  "message": "A record with that email already exists."
}
```

---

## Data Models

### User

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | String | |
| email | String | Unique |
| passwordHash | String | bcrypt hashed |
| role | Enum | VIEWER, ANALYST, ADMIN |
| status | Enum | ACTIVE, INACTIVE |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### FinancialRecord

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| amount | Decimal(12,2) | Avoids floating point issues |
| type | Enum | INCOME, EXPENSE |
| category | String | Indexed for fast filtering |
| date | Date | Calendar date, no time component |
| notes | String? | Optional |
| isDeleted | Boolean | Soft delete flag |
| createdById | UUID | Foreign key → User |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

## Design Decisions

**Soft deletes on records** — Records are never hard deleted. The `isDeleted` flag hides them from all queries and analytics while preserving audit history and referential integrity.

**Soft delete on users** — Deleting a user sets their status to `INACTIVE` rather than removing the row, since their records still reference them via foreign key.

**asyncHandler wrapper** — All route handlers are wrapped in `asyncHandler()` which forwards any thrown error to the global error middleware. This eliminates repetitive try/catch blocks throughout the codebase.

**Zod validation** — Each route defines its own Zod schema inline. The global error handler catches `ZodError` automatically and returns structured field-level messages without any extra code in the route.

**Role hierarchy as numeric levels** — `VIEWER=1, ANALYST=2, ADMIN=3`. The `authorize()` guard computes the minimum required level so a single middleware call handles the full hierarchy cleanly.

**Prisma aggregations for analytics** — Dashboard endpoints use Prisma's `groupBy` and `aggregate` APIs. No raw SQL is needed, keeping the analytics logic readable and maintainable.

**Indexed fields** — `type`, `category`, `date`, and `isDeleted` are indexed on `FinancialRecord` since these are the primary filter and query dimensions.

---

## Assumptions

- Self-registered users always receive the `VIEWER` role. Only an Admin can create users with ANALYST or ADMIN roles.
- Soft-deleted records are excluded from all listings, filters, and analytics.
- Dashboard summary and recent activity are accessible to all authenticated users. Deeper analytics require ANALYST or above.
- Amounts are stored as `Decimal(12,2)` to avoid floating point precision errors on financial data.
- Dates are stored without a time component since financial entries refer to a calendar date.

---

## Optional Features Included

- JWT Authentication (register, login, protected routes)
- Pagination on all list endpoints
- Soft deletes (records via `isDeleted`, users via `status`)
- Swagger / OpenAPI 3.0 at `/api-docs`
- Structured error responses with field-level validation messages
- Database seed script with test users and 30 sample records

---

## Using Swagger UI

1. Open `http://localhost:3000/api-docs`
2. Click **POST /auth/login** → **Try it out** → enter `admin@finance.com` / `admin123` → **Execute**
3. Copy the `token` from the response
4. Click **Authorize** (top right) → paste the token → **Authorize**
5. All protected endpoints are now unlocked