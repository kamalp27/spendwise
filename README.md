# SpendWise — Personal Expense Tracker

SpendWise is a responsive, full-stack personal finance and expense tracking web application. It enables users to monitor spending habits, organize expenses by categories, establish monthly budgets, and analyze spending trends with data-driven interactive charts.

---

## 🛠 Technology Stack

- **Frontend:** React (v18), Vite, Tailwind CSS, Recharts, Lucide Icons, Axios
- **Backend:** Node.js, Express.js, Argon2, Cookie-Parser, Helmet, CORS, Express-Rate-Limit, Dotenv
- **Database:** PostgreSQL (tested with Neon Serverless PostgreSQL), `pg` (node-postgres)
- **Database Migrations:** Explicit transactional SQL migration runner with PostgreSQL advisory locking
- **Testing:** Vitest, Supertest, React Testing Library, jsdom
- **Architecture:** Monorepo with npm workspaces (`client`, `server`)
- **Default Currency:** INR (`₹`)

---

## 📁 Repository Structure

```
spendwise/
├── client/                     # Frontend Single Page Application (React + Vite)
│   ├── src/
│   │   ├── assets/             # Static icons and assets
│   │   ├── components/         # Common UI primitives and layout shell (Header, Sidebar, Nav)
│   │   ├── features/           # Domain modules (auth, dashboard, expenses, categories, budgets, analytics)
│   │   ├── context/            # React contexts (AuthContext with session restoration)
│   │   ├── hooks/              # Custom application hooks (useFocusTrap)
│   │   ├── services/           # Axios HTTP client, CSRF header interceptor, and API services
│   │   ├── styles/             # Tailwind CSS theme configuration and base styles
│   │   └── utils/              # Currency/date formatters, validators, and date helpers
│   ├── tests/                  # Frontend component and integration test suites (Vitest + RTL)
│   ├── .env.example            # Client environment variable template
│   └── package.json            # Client dependencies and scripts
│
├── server/                     # Backend API Service (Node.js + Express)
│   ├── src/
│   │   ├── config/             # Environment validation (env.js) and runtime configuration
│   │   ├── controllers/        # Request controllers (auth, expenses, categories, budgets, analytics, health)
│   │   ├── db/
│   │   │   ├── migrations/     # Versioned SQL migration files (001_ to 006_)
│   │   │   ├── migrate.js      # Transactional migration runner with advisory locking
│   │   │   ├── pool.js         # Singleton PostgreSQL connection pool with strict TLS handling
│   │   │   └── seed.js         # Idempotent development seed runner (categories, dev user)
│   │   ├── middleware/         # Session authentication, CSRF, error handler, rate limiters, Helmet
│   │   ├── routes/             # Versioned REST API route definitions (/api/v1/...)
│   │   ├── services/           # Business logic, Argon2id hashing, session management, and aggregations
│   │   ├── utils/              # AppError class, password utilities, and schema validators
│   │   └── server.js           # Application entrypoint with graceful shutdown handling
│   ├── tests/                  # Backend unit, integration, and security test suites (Vitest + Supertest)
│   ├── .env.example            # Server environment variable template
│   └── package.json            # Server dependencies and scripts
│
├── .gitignore                  # Git exclusions (node_modules, .env files, build outputs)
├── package.json                # Root workspace orchestration scripts
└── README.md                   # Project documentation
```

---

## 🗄 Database Design & Schema Migrations

SpendWise manages its database schema through sequential, transactional SQL migration files.

> [!NOTE]
> **Explicit Migration Execution:** Database migrations (`npm run db:migrate`) and seeds (`npm run db:seed`) are executed through explicit manual commands. The backend server does **not** automatically run migrations or seeds on startup, preserving operational predictability.

### Migration Sequence

1. **`001_create_schema_migrations.sql`**:
   - Creates the `schema_migrations` tracking table (`id`, `name`, `applied_at`) to ensure each migration runs exactly once.
2. **`002_create_users_table.sql`**:
   - Creates the `users` table (`id` UUID, `email`, `display_name`, `currency`, `created_at`, `updated_at`).
   - Enforces a case-insensitive unique index on `LOWER(email)`.
3. **`003_create_categories_table.sql`**:
   - Creates the `categories` table (`id` UUID, `user_id` UUID NULL, `name`, `icon`, `color`, `is_predefined`).
   - Supports both global predefined categories (`user_id IS NULL`) and custom user categories (`user_id` foreign key).
4. **`004_create_expenses_table.sql`**:
   - Creates the `expenses` table (`id` UUID, `user_id` UUID NOT NULL, `category_id` UUID NULL, `title`, `amount` NUMERIC(12,2), `date`, `payment_method`, `notes`).
   - Uses `ON DELETE RESTRICT` on `user_id` for audit safety, and `ON DELETE SET NULL` on `category_id` to preserve transactions if a category is deleted.
   - Includes composite indexes on `(user_id, date DESC)` and `(user_id, category_id)`.
5. **`005_create_budgets_table.sql`**:
   - Creates the `budgets` table (`id` UUID, `user_id` UUID NOT NULL, `category_id` UUID NULL, `amount` NUMERIC(12,2), `month`, `year`).
   - Enforces partial unique indexes: at most one overall budget per user per month (`category_id IS NULL`), and at most one budget per category per month (`category_id IS NOT NULL`).
6. **`006_add_auth_and_sessions.sql`**:
   - Extends `users` with `password_hash` VARCHAR(255), `is_active` BOOLEAN DEFAULT TRUE, and `last_login_at` TIMESTAMPTZ.
   - Creates the `user_sessions` table (`sid` VARCHAR(255) PRIMARY KEY, `sess` JSONB, `expire` TIMESTAMPTZ, `user_id` UUID REFERENCES users(id) ON DELETE CASCADE, `created_at`, `updated_at`).
   - Creates performance indexes on `user_sessions(expire)` and `user_sessions(user_id)`.

---

## 🔒 Authentication & Security Architecture

SpendWise implements server-side session authentication with PostgreSQL persistence and defense-in-depth security controls:

### Authentication Lifecycle
- **Registration (`POST /api/v1/auth/register`):** Creates a user record, securely hashes the password with **Argon2id**, provisions a session record in `user_sessions`, and issues a cryptographically signed HTTP-only cookie (`spendwise.sid`).
- **Login (`POST /api/v1/auth/login`):** Verifies candidate credentials against the Argon2id hash, regenerates the session identifier upon authentication to prevent session fixation, updates `last_login_at`, and sets the session cookie.
- **Session Restoration (`GET /api/v1/auth/me`):** On application mount or page refresh, the frontend validates the active session cookie against PostgreSQL (`expires_at > NOW()`). If valid, the authenticated user profile is restored into React context.
- **Logout (`POST /api/v1/auth/logout`):** Revokes the session record in `user_sessions` and clears the client session cookie.

> [!IMPORTANT]
> **User Account Creation for Testing:**
> The database seed runner (`npm run db:seed`) provisions an initial development user profile (`dev.user@spendwise.example`) for database schema modeling with a `NULL` password hash. Because the authentication service rejects users without password hashes, **testers must register a new account via the UI (`Register` tab) to log in and interact with the application.**

### Security Controls
- **Protected Financial Routes:** All financial endpoints (`/expenses`, `/categories`, `/budgets`, `/analytics`) are guarded by `sessionAuthMiddleware`. Unauthenticated requests are rejected with HTTP 401 Unauthorized. The frontend gates all domain queries behind the authenticated state.
- **Tenant Data Isolation:** Every database query in the expense, category, budget, and analytics services enforces strict user scoping via parameterized SQL (`WHERE user_id = $1`). Cross-tenant access attempts fail closed.
- **CSRF Protection:** Mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) require a double-submit CSRF cookie pattern verified via the `X-SpendWise-CSRF` custom request header.
- **Cookie Security:** Session cookies are configured with `httpOnly: true`, `sameSite: 'lax'`, and signed with HMAC SHA-256 using `SESSION_SECRET`. In production mode, `secure: true` is enforced.
- **TLS Certificate Verification:** PostgreSQL connections enforce TLS certificate verification (`rejectUnauthorized: true`). The server configuration prohibits disabling TLS verification in production mode.
- **Rate Limiting & Headers:** API endpoints are protected with `express-rate-limit` (with dedicated limits on authentication routes) and standard HTTP security headers via `helmet`.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js:** v18.x or higher (tested on Node.js v20+)
- **npm:** v9.x or higher
- **PostgreSQL Database:** PostgreSQL 14+ (local instance or hosted, e.g., Neon PostgreSQL)

### 1. Installation
Clone the repository and install root and workspace dependencies:
```bash
git clone <repository-url>
cd spendwise
npm install
```

### 2. Environment Configuration

#### Client Configuration
Copy the client environment template:
```bash
cp client/.env.example client/.env
```
Default client parameters (`client/.env`):
```ini
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_DEFAULT_CURRENCY=INR
VITE_DEFAULT_CURRENCY_SYMBOL=₹
```

#### Server Configuration
Copy the server environment template:
```bash
cp server/.env.example server/.env
```
Configure your server environment variables (`server/.env`). Use strong, secure values for secrets:
```ini
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://username:password@hostname:5432/spendwise?sslmode=require
DATABASE_SSL=false
DATABASE_SSL_REJECT_UNAUTHORIZED=true
SESSION_SECRET=your_secure_random_hex_string_at_least_32_characters_long
SESSION_MAX_AGE_MS=604800000
SESSION_COOKIE_NAME=spendwise.sid
COOKIE_SAME_SITE=lax
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

### 3. Database Migration & Seed
Run database migrations to initialize tables and indexes:
```bash
npm run db:migrate
```
*(Optional)* Populate predefined categories:
```bash
npm run db:seed
```

### 4. Running the Application
Start the backend API server and frontend development server in separate terminals:

**Terminal 1 (Backend API):**
```bash
npm run server
```
*API server listens on `http://localhost:5000`.*

**Terminal 2 (Frontend Client):**
```bash
npm run client
```
*Vite frontend application serves at `http://localhost:5173`.*

---

## 🧪 Available Commands & Testing

SpendWise provides centralized npm scripts in the root `package.json`:

| Command | Action | Description |
| :--- | :--- | :--- |
| `npm run client` | Development | Starts the Vite frontend development server on port 5173 |
| `npm run server` | Development | Starts the Express backend server with nodemon on port 5000 |
| `npm run db:migrate` | Database | Executes pending SQL migrations sequentially inside transactions |
| `npm run db:seed` | Database | Seeds predefined categories and development user profile idempotently |
| `npm run test:server` | Testing | Runs backend unit, integration, and security test suites via Vitest |
| `npm run test:client` | Testing | Runs frontend component, accessibility, and integration test suites via Vitest |
| `npm run test` | Testing | Alias for `npm run test:server` |
| `npm run build:client` | Production | Compiles the React application into optimized static assets in `client/dist/` |

---

## 📡 REST API Specifications

All endpoints are versioned under `/api/v1` and return standard JSON response envelopes (`{ "success": true, "data": ... }`).

### Health Endpoint (Public)
- `GET /api/v1/health`: Returns API status and PostgreSQL connectivity status.

### Authentication Endpoints (Public)
- `POST /api/v1/auth/register`: Creates a new user account and sets session cookie.
- `POST /api/v1/auth/login`: Authenticates credentials, rotates session, and sets session cookie.
- `GET /api/v1/auth/me`: Returns the authenticated user profile for the active session.
- `POST /api/v1/auth/logout`: Revokes active session in PostgreSQL and clears session cookie.

### Category Endpoints (Protected)
- `GET /api/v1/categories`: Lists all global predefined categories plus user-owned custom categories.
- `POST /api/v1/categories`: Creates a new custom category for the authenticated user.
- `DELETE /api/v1/categories/:id`: Deletes a user-owned custom category (linked expenses are preserved as uncategorized).

### Expense Endpoints (Protected)
- `GET /api/v1/expenses`: Lists user expenses with filtering (`startDate`, `endDate`, `categoryId`, `paymentMethod`), search (`search`), allowlisted sorting (`sortBy`, `sortOrder`), and pagination (`page`, `limit`).
- `GET /api/v1/expenses/:id`: Retrieves a single expense by UUID (enforcing user ownership).
- `POST /api/v1/expenses`: Creates a new expense record with category and field validation.
- `PATCH /api/v1/expenses/:id`: Updates an existing user expense.
- `DELETE /api/v1/expenses/:id`: Deletes an expense record.

### Budget Endpoints (Protected)
- `GET /api/v1/budgets`: Lists budgets for a specific month and year with aggregated actual spending.
- `POST /api/v1/budgets`: Creates an overall monthly budget or category-specific budget.
- `PATCH /api/v1/budgets/:id`: Updates budget amount limits.
- `DELETE /api/v1/budgets/:id`: Deletes a budget limit.

### Analytics Endpoints (Protected)
- `GET /api/v1/analytics/monthly`: Computes monthly spend totals, transaction counts, category breakdowns, daily trends, payment method distributions, and previous-month comparisons.

---

## ⚖️ Features & Production Readiness Boundaries

### Implemented & Verified Capabilities
- **Authentication & Multi-Tenant Isolation:** Complete Argon2id session authentication, CSRF validation, and tenant-scoped SQL queries.
- **Expense & Budget Management:** Full CRUD operations with server-side pagination, search, sorting, and real-time budget utilization metrics.
- **Data-Driven Dashboard & Analytics:** Dynamic reporting periods, category donut charts, daily spending trends, and payment method distribution charts.
- **Accessibility & UX:** Modal focus management and keyboard trapping (`useFocusTrap`), accessible error banners, and responsive mobile navigation.

### Production Deployment Prerequisites & Known Limitations
- **Distributed Session Store:** Sessions are stored directly in PostgreSQL (`user_sessions`). In large-scale, multi-region distributed deployments, an external memory store (e.g., Redis) is recommended for sub-millisecond session validation.
- **Session Cleanup Automation:** Expired sessions are rejected on query; an automated background worker or PostgreSQL cron job should be scheduled to periodically purge expired records.
- **In-Memory Rate Limiting:** The API uses in-memory IP rate limiting; multi-instance deployments require a shared store (e.g., Redis) for shared rate enforcement.
- **Automated Browser E2E Tests:** All component, unit, and integration tests are automated in Vitest. Automated browser end-to-end tests (e.g., Playwright) can be added for automated CI/CD pipelines.

---

## 📜 License

ISC License.
