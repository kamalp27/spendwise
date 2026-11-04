# SpendWise — Personal Expense Tracker

[![Live Demo](https://img.shields.io/badge/Demo-Live%20Application-success?style=flat-square)](https://spendwise-nine-gules.vercel.app)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-181717?style=flat-square&logo=github)](https://github.com/kamalp27/spendwise)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=flat-square)](package.json)

SpendWise is a responsive, full-stack personal finance and expense tracking web application. It enables users to monitor spending habits, categorize expenses, establish monthly and category-specific spending limits, and analyze financial trends through interactive visualizations.

- **Live Application:** [spendwise-nine-gules.vercel.app](https://spendwise-nine-gules.vercel.app)
- **GitHub Repository:** [github.com/kamalp27/spendwise](https://github.com/kamalp27/spendwise)
- **API Health Check:** [spendwise-api-gssx.onrender.com/api/v1/health](https://spendwise-api-gssx.onrender.com/api/v1/health)

---

## 📋 Table of Contents

- [Overview & Problem Statement](#-overview--problem-statement)
- [Key Features](#-key-features)
- [Application Screenshots](#-application-screenshots)
- [Technology Stack](#-technology-stack)
- [System Architecture](#-system-architecture)
- [Database Schema & Migrations](#-database-schema--migrations)
- [Authentication & Security Architecture](#-authentication--security-architecture)
- [Local Development & Setup](#-local-development--setup)
- [Environment Configuration](#-environment-configuration)
- [Available Scripts & Automated Testing](#-available-scripts--automated-testing)
- [REST API Reference](#-rest-api-reference)
- [Engineering Trade-offs & Production Boundaries](#-engineering-trade-offs--production-boundaries)
- [Author & Contact](#-author--contact)
- [License](#-license)

---

## 🎯 Overview & Problem Statement

Personal budgeting tools often suffer from bloated feature sets, opaque data retention policies, or brittle client-side storage that does not persist across user devices. Conversely, basic spreadsheets lack automated aggregations, month-over-month comparisons, and dynamic boundary warnings.

SpendWise addresses these challenges by providing:
1. **Multi-tenant Data Isolation:** Secure, relational data isolation for every user with parameterized PostgreSQL queries.
2. **Reliable Persistence:** Server-backed persistence using PostgreSQL with transactional schema migrations.
3. **Actionable Budget Insights:** Real-time budget utilization metrics and visual warnings when category limits are approached or exceeded.
4. **Frictionless Authentication:** Stateful, secure HTTP-only cookie sessions with defense-in-depth security controls (CSRF custom header defense, rate limiting, Argon2id hashing).

---

## ✨ Key Features

- **User Authentication & Session Management:**
  - Secure registration and login powered by Argon2id password hashing.
  - PostgreSQL-persisted session store with cryptographically signed, HTTP-only, SameSite cookies.
  - Automatic session restoration on initial mount with gated application states.

- **Expense Management (CRUD):**
  - Create, view, edit, and delete expense entries.
  - Server-side pagination, search by title/notes, and allowlisted column sorting (`date`, `amount`, `title`).
  - Filtering by date range (`startDate`, `endDate`), category, and payment method.

- **Categorization System:**
  - 8 predefined system categories: `Food & Dining`, `Transport`, `Shopping`, `Bills & Utilities`, `Health & Medical`, `Education`, `Entertainment`, and `Other`.
  - Custom categories can be created with distinct icons and color codes.

- **Monthly & Category-Specific Budgets:**
  - Set overall monthly spending caps.
  - Establish granular category-specific monthly spending budgets.
  - Real-time spend tracking displaying spent amounts, remaining allowances, and utilization percentages.

- **Interactive Spending Analytics:**
  - Visual summary cards showing total monthly spend, active budget status, and month-over-month percentage changes.
  - Category breakdown visualization using interactive donut charts.
  - Daily spending progression trend bar charts.
  - Payment method distribution breakdown.

- **Payment Method Tracking:**
  - Categorize expenditures across standard payment methods (`cash`, `credit_card`, `debit_card`, `upi`, `net_banking`, `other`).

---

## 📸 Application Screenshots

Application screenshots will be added in a subsequent update.

---

## 🛠 Technology Stack

### Frontend
- **Framework & Tooling:** React 18, Vite
- **Styling & Icons:** Tailwind CSS, Lucide React
- **Data Visualization:** Recharts
- **HTTP Client:** Axios (configured with credentials and CSRF custom header interceptors)
- **Testing:** Vitest, React Testing Library, jsdom

### Backend
- **Runtime & Framework:** Node.js, Express.js
- **Password Hashing:** Argon2 (`argon2id`)
- **Security & Headers:** Helmet, CORS, Express-Rate-Limit, Cookie-Parser
- **Database Driver:** `pg` (node-postgres connection pool)
- **Testing:** Vitest, Supertest

### Database
- **Engine:** PostgreSQL 14+ (tested against Neon Serverless PostgreSQL)
- **Schema Management:** Custom transactional SQL migration runner with PostgreSQL session-level advisory locks

### Infrastructure & Deployment
- **Frontend Hosting:** Vercel (Single Page Application hosting with reverse-proxy edge rewrites)
- **Backend Hosting:** Render (Web Service running Node.js)
- **Database Tier:** Neon Serverless PostgreSQL with SSL/TLS enforcement

---

## 🏛 System Architecture

The architecture uses a reverse-proxy deployment model. The frontend Single Page Application (SPA) hosted on Vercel routes `/api/*` calls through a Vercel Edge rewrite proxy directly to the Render backend service. This design mitigates third-party cookie blocking in modern browsers by ensuring that session cookies operate in a first-party context.

```mermaid
flowchart TD
    subgraph ClientLayer["Frontend — Client Tier (Vercel)"]
        Browser["User Browser"]
        SPA["React 18 / Vite SPA"]
        Proxy["Vercel Edge Rewrite Proxy (/api/:path*)"]
        Browser -->|"UI Interactions"| SPA
        SPA -->|"Same-Origin API Calls"| Proxy
    end

    subgraph ServerLayer["Backend — API Tier (Render)"]
        API["Node.js / Express API"]
        MW["Security Middleware (Helmet, CORS, Rate Limiting, CSRF)"]
        Auth["Session Auth & Controllers"]
        Proxy -->|"HTTPS Proxy Forwarding"| API
        API --> MW
        MW --> Auth
    end

    subgraph DatabaseLayer["Data — Database Tier (Neon Serverless)"]
        Pool["PostgreSQL Connection Pool (pg)"]
        DB[("PostgreSQL Database")]
        Auth -->|"Parameterized SQL"| Pool
        Pool -->|"TLS (rejectUnauthorized)"| DB
    end
```

---

## 🗄 Database Schema & Migrations

SpendWise uses an explicit, sequential, transactional SQL migration runner. Database schema migrations are never executed implicitly on server start; they are controlled via `npm run db:migrate`.

### Migration Runner Reliability
- **PostgreSQL Advisory Locking:** Acquires a dedicated session-level advisory lock (`pg_advisory_lock(824901)`) before scanning or applying migrations, preventing concurrent race conditions during deployments.
- **Atomic Transactions:** Each migration file is executed inside an atomic transaction block (`BEGIN ... COMMIT`). If an error occurs, the transaction rolls back, and execution aborts without leaving half-applied schemas.
- **Migration Tracking:** Applied migrations are recorded in the `schema_migrations` table (`id`, `name`, `applied_at`).

### Migration Sequence

| Migration File | Description |
| :--- | :--- |
| `001_create_schema_migrations.sql` | Initializes the migration ledger table (`schema_migrations`). |
| `002_create_users_table.sql` | Creates `users` table with UUID primary keys and case-insensitive unique index on `LOWER(email)`. |
| `003_create_categories_table.sql` | Creates `categories` table supporting global predefined (`user_id IS NULL`) and custom user categories (`user_id` foreign key). |
| `004_create_expenses_table.sql` | Creates `expenses` table with indexes on `(user_id, date DESC)` and `(user_id, category_id)`. |
| `005_create_budgets_table.sql` | Creates `budgets` table with partial unique indexes preventing duplicate monthly or category budgets per user. |
| `006_add_auth_and_sessions.sql` | Extends `users` with `password_hash`, adds `user_sessions` table with expiration index for stateful session persistence. |

---

## 🔒 Authentication & Security Architecture

SpendWise employs defense-in-depth security principles across both tiers:

1. **Password Hashing:**
   - Evaluated using **Argon2id** with OWASP-recommended parameters (`memoryCost: 65536` KiB, `timeCost: 3`, `parallelism: 1`).
2. **Stateful Session Management:**
   - Sessions are persisted in PostgreSQL (`user_sessions`).
   - Session identifiers are signed using HMAC SHA-256 and transmitted in `httpOnly`, `sameSite: 'lax'`, `secure: true` (in production) cookies (`spendwise.sid`).
   - **Session Fixation Defense:** The session ID is regenerated upon authentication (`POST /api/v1/auth/login`).
   - Expired sessions are rejected at query time (`expire > NOW()`).
3. **Cross-Site Request Forgery (CSRF) Defense:**
   - State-mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) are guarded by custom header validation and origin verification.
   - The backend `csrfProtection` middleware requires incoming mutating requests to carry a custom header (`X-Requested-With` or `X-SpendWise-CSRF`). Standard cross-origin HTML form submissions cannot attach custom headers without CORS preflight authorization.
   - When an `Origin` header is present, it is verified against the configured `CLIENT_URL`.
   - The frontend API client automatically injects `X-Requested-With: XMLHttpRequest` and `X-SpendWise-CSRF: 1` on all mutating Axios requests.
4. **Multi-Tenant Isolation:**
   - Every financial entity query enforces parameterized constraints (`WHERE user_id = $1`). Cross-tenant query attempts fail closed.
5. **Rate Limiting & Security Headers:**
   - Global API rate limiting via `express-rate-limit`.
   - Dedicated brute-force rate limiter on authentication endpoints (`POST /api/v1/auth/login`, `POST /api/v1/auth/register`).
   - Standard HTTP security headers configured through `helmet`.
6. **TLS Certificate Validation:**
   - Database connections require TLS with certificate verification (`rejectUnauthorized: true`).

---

## 🚀 Local Development & Setup

### Prerequisites
- **Node.js:** v18.x or higher (tested on Node.js v20+)
- **npm:** v9.x or higher
- **PostgreSQL:** Local PostgreSQL 14+ instance or a cloud PostgreSQL database (e.g. Neon)

### 1. Clone & Install
```bash
git clone https://github.com/kamalp27/spendwise.git
cd spendwise
npm install
```

### 2. Configure Environment Files
Copy the example environment files into working `.env` files:

```bash
# Frontend environment
cp client/.env.example client/.env

# Backend environment
cp server/.env.example server/.env
```

Configure your local database credentials and secrets in `server/.env`.

### 3. Run Database Migrations
Initialize the schema and indexes:
```bash
npm run db:migrate
```

### 4. (Optional) Seed Predefined Categories
To populate the default global categories (Food & Dining, Transport, Shopping, Bills & Utilities, Health & Medical, Education, Entertainment, Other) in a fresh database:
```bash
npm run db:seed
```

> [!NOTE]
> `npm run db:seed` executes `server/src/db/seed.js`. It populates the 8 global predefined categories (`user_id = NULL`) and creates a development placeholder record (`dev.user@spendwise.example`) with a `NULL` password hash for schema modeling. Because accounts without password hashes cannot authenticate, **testers and developers must register a new account via the UI (`/register`) to log in and interact with the application.** In production mode, `npm run db:seed` will refuse to run unless explicitly overridden by `ALLOW_PROD_SEED=true`.

### 5. Start Development Servers
Start both the API backend and Vite client in separate terminals:

```bash
# Terminal 1: Backend API (runs on http://localhost:5000)
npm run server

# Terminal 2: Frontend Client (runs on http://localhost:5173)
npm run client
```

---

## ⚙️ Environment Configuration

### Frontend (`client/.env`)
Reference template: [`client/.env.example`](client/.env.example)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Base URL for REST API calls | `http://localhost:5000/api/v1` |
| `VITE_APP_CURRENCY` | ISO Currency code | `INR` |
| `VITE_APP_CURRENCY_SYMBOL` | Display symbol for currency | `₹` |

### Backend (`server/.env`)
Reference template: [`server/.env.example`](server/.env.example)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | TCP port the Express server listens on | `5000` |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` |
| `CLIENT_URL` | Trusted frontend origin for CORS and CSRF verification | `http://localhost:5173` |
| `RATE_LIMIT_WINDOW_MS` | Global rate limit window in milliseconds | `900000` (15 mins) |
| `RATE_LIMIT_MAX` | Maximum API requests allowed per window per IP | `100` |
| `TRUST_PROXY` | Upstream reverse-proxy hops to trust (Render / PaaS) | `1` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `SESSION_SECRET` | Secret key for signing session cookies (min 32 chars) | Strong random 32+ character hex string |
| `SESSION_MAX_AGE_MS` | Session expiration duration in milliseconds | `604800000` (7 days) |
| `DEFAULT_CURRENCY` | Default backend currency fallback | `INR` |

---

## 🧪 Available Scripts & Automated Testing

Centralized npm workspace scripts defined in root `package.json`:

```bash
# Start frontend development server on port 5173
npm run client

# Start backend development server on port 5000
npm run server

# Run backend unit, integration, and security test suites via Vitest
npm run test:server

# Run frontend component, hook, and integration test suites via Vitest
npm run test:client

# Alias for npm run test:server
npm run test

# Build frontend production bundle into client/dist/
npm run build:client

# Execute pending transactional database migrations
npm run db:migrate

# Seed global predefined categories and dev user model
npm run db:seed
```

### Automated Test Architecture

The SpendWise automated test suite comprises **423 tests across 35 test files**:

| Suite | Scope | Files | Tests | Framework |
| :--- | :--- | :---: | :---: | :--- |
| **Backend** | Auth, sessions, CSRF, rate limits, migrations, pool lifecycle, services | 20 | 237 | Vitest + Supertest |
| **Frontend** | Components, context, modals, accessibility, API client, date utilities | 15 | 186 | Vitest + React Testing Library + jsdom |
| **Total** | **Full workspace automated test coverage** | **35** | **423** | |

---

## 📡 REST API Reference

All API routes are versioned under `/api/v1` and return standard JSON response envelopes (`{ "success": true, "data": ... }` or `{ "success": false, "error": { "message": "...", "code": "..." } }`).

### Health Endpoint
- `GET /api/v1/health` — Returns service health status and PostgreSQL database connectivity check.

### Authentication Endpoints
- `POST /api/v1/auth/register` — Registers a new user account, creates session, and issues signed cookie (Rate-limited, custom header guarded).
- `POST /api/v1/auth/login` — Verifies credentials, regenerates session ID, and issues signed cookie (Rate-limited, custom header guarded).
- `GET /api/v1/auth/me` — Restores authenticated user profile from active session cookie.
- `POST /api/v1/auth/logout` — Destroys session record in PostgreSQL and clears client session cookie (custom header guarded).

### Category Endpoints *(Protected)*
- `GET /api/v1/categories` — Lists global predefined categories and user-owned custom categories.
- `POST /api/v1/categories` — Creates a custom expense category for the authenticated user (custom header guarded).

### Expense Endpoints *(Protected)*
- `GET /api/v1/expenses` — Retrieves paginated, sorted, and filtered expenses.
  *Query Parameters:* `page`, `limit`, `search`, `categoryId`, `paymentMethod`, `startDate`, `endDate`, `sortBy`, `sortOrder`.
- `GET /api/v1/expenses/:id` — Retrieves an individual expense record by UUID (scoped to user).
- `POST /api/v1/expenses` — Creates a new expense record with category and field validation (custom header guarded).
- `PATCH /api/v1/expenses/:id` — Updates an existing expense record (custom header guarded).
- `DELETE /api/v1/expenses/:id` — Deletes an expense record (custom header guarded).

### Budget Endpoints *(Protected)*
- `GET /api/v1/budgets` — Retrieves monthly overall and category budgets with aggregated spend totals (`?month=MM&year=YYYY`).
- `POST /api/v1/budgets` — Creates or updates a monthly budget limit (custom header guarded).

### Analytics Endpoints *(Protected)*
- `GET /api/v1/analytics/summary` — Computes monthly spending totals, transaction counts, category breakdowns, daily trends, payment distributions, and month-over-month comparisons (`?month=MM&year=YYYY`).

---

## ⚖️ Engineering Trade-offs & Production Boundaries

Every engineering decision involves trade-offs between implementation simplicity, maintainability, and horizontal scale:

1. **PostgreSQL-Backed Sessions vs. Redis Cache:**
   - *Current Implementation:* Sessions are stored directly in PostgreSQL (`user_sessions`). This eliminates external infrastructure dependencies and guarantees transactional integrity across users and sessions.
   - *Production Trade-off:* In high-throughput, multi-region distributed deployments, querying PostgreSQL on every authenticated request introduces database connection overhead. Migrating session storage to an in-memory key-value store (e.g., Redis or Upstash) would be preferable for horizontal scaling.
2. **Expired Session Cleanup:**
   - *Current Implementation:* Expired sessions are ignored at query time (`WHERE expire > NOW()`).
   - *Production Trade-off:* Expired session rows remain in `user_sessions` until manually deleted. A scheduled background worker or PostgreSQL cron job (`pg_cron`) should be introduced to periodically purge expired records.
3. **In-Memory Rate Limiting:**
   - *Current Implementation:* Express rate limiting tracks IP requests using an in-memory counter.
   - *Production Trade-off:* When running across multiple clustered application instances or autoscaling containers, IP counts are not synchronized across instances. Production setups with multiple replicas should use a distributed Redis store for rate limiting.
4. **Single-Currency Presentation:**
   - *Current Implementation:* Configured for INR (`₹`) as the default currency. Multi-currency conversions and historical exchange rate tables are deliberately omitted to preserve a clean core domain model.

---

## 👤 Author & Contact

**Kamal Patil**
- **GitHub:** [@kamalp27](https://github.com/kamalp27)
- **LinkedIn:** [linkedin.com/in/kamal-patil-04895035a](https://www.linkedin.com/in/kamal-patil-04895035a)
- **Repository:** [https://github.com/kamalp27/spendwise](https://github.com/kamalp27/spendwise)
- **Live Application:** [https://spendwise-nine-gules.vercel.app](https://spendwise-nine-gules.vercel.app)

---

## 📜 License

This project is licensed under the **ISC License** as declared in [`package.json`](package.json).
