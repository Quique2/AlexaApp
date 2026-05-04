# Rrëy — System Architecture & Technical Reference

> Brewery Management System · Full-Stack Mobile + Cloud API  
> Version 1.0 · May 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Frontend — React Native / Expo App](#3-frontend--react-native--expo-app)
4. [Backend — REST API](#4-backend--rest-api)
5. [Database — PostgreSQL + Prisma](#5-database--postgresql--prisma)
6. [Authentication & Security](#6-authentication--security)
7. [Business Logic Modules](#7-business-logic-modules)
8. [API Reference](#8-api-reference)
9. [Deployment — Railway](#9-deployment--railway)
10. [Development Workflow](#10-development-workflow)
11. [Industrial Scaling — 1,000 Concurrent Users](#11-industrial-scaling--1000-concurrent-users)
12. [Budget Estimate](#12-budget-estimate)

---

## 1. Executive Summary

Rrëy is a **mobile-first brewery management system** built for real-time inventory control, production planning, supplier order management, and JIT (Just-In-Time) raw material alerting. It is designed as a cross-platform React Native application backed by a cloud-hosted REST API and a managed PostgreSQL database.

The system provides:

- **Real-time JIT inventory alerts** — RED / YELLOW / GREEN status per raw material based on daily consumption and supplier lead times
- **Production planning** — schedule batches per beer style with automatic material requirement calculation
- **Purchase order lifecycle** — from auto-generation through transit to reception
- **Dashboard KPIs** — alert summary, upcoming production, monthly spend
- **Secure multi-user access** — JWT authentication with biometric (Face ID / fingerprint) support

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │              React Native App  (Expo SDK 54)                 │  │
│   │                                                              │  │
│   │   ┌─────────────┐  ┌────────────────┐  ┌────────────────┐   │  │
│   │   │  expo-router │  │  ThemeContext  │  │  AuthContext   │   │  │
│   │   │  (file-based │  │  dark/light +  │  │  JWT + Face ID │   │  │
│   │   │   routing)   │  │  font scale    │  │  + SecureStore │   │  │
│   │   └─────────────┘  └────────────────┘  └────────────────┘   │  │
│   │                                                              │  │
│   │   ┌──────────────────────────────────────────────────────┐  │  │
│   │   │  TanStack Query  (server state, caching, refetch)    │  │  │
│   │   └──────────────────────────────────────────────────────┘  │  │
│   │                                                              │  │
│   │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │  │
│   │   │Dashboard │ │Inventory │ │Production│ │   Orders    │  │  │
│   │   │  Screen  │ │  Screen  │ │  Screen  │ │   Screen    │  │  │
│   │   └──────────┘ └──────────┘ └──────────┘ └─────────────┘  │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│          iOS · Android · Web  (via Expo Go or native build)         │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  HTTPS / JSON REST
                                   │
┌──────────────────────────────────▼──────────────────────────────────┐
│                       RAILWAY CLOUD PLATFORM                        │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │              Express.js API  (Node.js / TypeScript)          │  │
│   │                                                              │  │
│   │   ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │  │
│   │   │  CORS +    │  │  JWT Auth  │  │  Zod Validation    │    │  │
│   │   │  JSON body │  │  Middleware│  │  (request schemas) │    │  │
│   │   └────────────┘  └────────────┘  └────────────────────┘    │  │
│   │                                                              │  │
│   │   /auth  /inventory  /materials  /production                 │  │
│   │   /orders  /receptions  /suppliers  /dashboard               │  │
│   │   /recipes  /config                                          │  │
│   │                                                              │  │
│   │   ┌──────────────────────────────────────────────────────┐  │  │
│   │   │                  Prisma ORM Client                   │  │  │
│   │   └────────────────────────┬─────────────────────────────┘  │  │
│   └────────────────────────────┼─────────────────────────────────┘  │
│                                │                                    │
│   ┌────────────────────────────▼─────────────────────────────────┐  │
│   │            Railway Managed PostgreSQL 16                     │  │
│   │                                                              │  │
│   │  users · user_sessions · materials · inventory               │  │
│   │  suppliers · orders · receptions · production_plans          │  │
│   │  recipe_lines · jit_config                                   │  │
│   └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Mobile Framework | React Native | 0.81.5 |
| App Platform | Expo SDK | 54 |
| Navigation | expo-router (file-system) | 6.0 |
| Server State | TanStack React Query | 5 |
| Secure Storage | expo-secure-store | 15 |
| Biometrics | expo-local-authentication | 17 |
| API Framework | Express.js | 4.19 |
| Language | TypeScript | 5.4 |
| ORM | Prisma | 5.14 |
| Database | PostgreSQL | 16 |
| Validation | Zod | 3.23 |
| Auth | JSON Web Tokens (jsonwebtoken) | 9 |
| Password Hashing | bcryptjs | 3 (12 rounds) |
| Cloud Platform | Railway | — |
| CI/CD | Railway Git-push deploy | — |

---

## 3. Frontend — React Native / Expo App

### 3.1 Project Structure

```
app/
├── _layout.tsx              Root layout: QueryClient + ThemeProvider + AuthProvider
├── index.tsx                Entry point: auth redirect guard
├── app.json                 Expo config (bundle ID, plugins, API URL)
│
├── (auth)/                  Unauthenticated route group
│   ├── _layout.tsx          Fade-animated stack, no header
│   ├── login.tsx            Email/password + Face ID login
│   └── register.tsx         Account creation
│
├── (tabs)/                  Authenticated route group
│   ├── _layout.tsx          Tab bar + HeaderRight with SettingsModal
│   ├── index.tsx            Dashboard screen
│   ├── inventory.tsx        Inventory list + edit bottom sheet
│   ├── production.tsx       Production plan + order generation
│   └── orders.tsx           Order list + receive modal
│
├── components/
│   ├── AlertBadge.tsx       JIT status indicator (RED/YELLOW/GREEN/NONE)
│   ├── EmptyState.tsx       Empty list placeholder
│   ├── FilterChips.tsx      Horizontal scrollable filter tabs
│   ├── InventoryRow.tsx     Single inventory list item
│   ├── KPICard.tsx          Dashboard metric card
│   ├── SearchBar.tsx        Search input with clear button
│   ├── SectionHeader.tsx    Section title with optional action
│   └── SettingsModal.tsx    Bottom sheet: theme, font, biometrics, logout
│
├── context/
│   ├── AuthContext.tsx      JWT session, biometric enrollment, logout
│   └── ThemeContext.tsx     Color mode + font size, persisted to SecureStore
│
├── constants/
│   └── theme.ts             darkColors, lightColors, makeTypography, spacing, radius
│
├── hooks/
│   ├── useDashboard.ts      React Query hooks for dashboard endpoints
│   ├── useInventory.ts      React Query hooks for inventory + mutations
│   ├── useOrders.ts         React Query hooks for orders + mutations
│   └── useProduction.ts     React Query hooks for production plans
│
├── services/
│   └── api.ts               Typed fetch client, token injection, all API calls
│
└── types/
    └── index.ts             Shared TypeScript types matching Prisma models
```

### 3.2 Routing Architecture

Expo Router uses **file-system routing** — each file in `app/` is a route. Route groups in parentheses (`(auth)`, `(tabs)`) create logical groupings without affecting the URL path.

```
/                    → app/index.tsx  (redirect guard: → /login or → /(tabs))
/(auth)/login        → app/(auth)/login.tsx
/(auth)/register     → app/(auth)/register.tsx
/(tabs)              → app/(tabs)/index.tsx  (Dashboard)
/(tabs)/inventory    → app/(tabs)/inventory.tsx
/(tabs)/production   → app/(tabs)/production.tsx
/(tabs)/orders       → app/(tabs)/orders.tsx
```

**Auth guard flow:**

```
App start
   └─ index.tsx reads AuthContext.isLoading
        ├─ isLoading = true  → Spinner
        ├─ user = null       → <Redirect href="/(auth)/login" />
        └─ user = AuthUser   → <Redirect href="/(tabs)" />
```

### 3.3 State Management

The app uses two layers of state:

| Layer | Tool | Scope |
|-------|------|-------|
| Server state (API data) | TanStack React Query | Cached, refetchable, auto-stale |
| Auth session | AuthContext (React Context + SecureStore) | Persisted across app restarts |
| Theme preferences | ThemeContext (React Context + SecureStore) | Persisted across app restarts |
| Local UI state | `useState` | Per-component only |

**React Query configuration:**

```typescript
{ retry: 2, staleTime: 20_000 }  // 20s cache window, 2 retries on failure
```

On pull-to-refresh, `refetch()` is called manually, bypassing the stale window.

### 3.4 Theme System

The theme system supports two color modes and three font scales, all persisted to SecureStore:

```
ThemeContext
├── colorMode: "dark" | "light"
├── fontSize: "small" | "normal" | "large"
├── colors: Colors          ← darkColors or lightColors object
├── typography: Typography  ← makeTypography(fontSize, colors)
├── setColorMode(mode)      ← updates state + persists to SecureStore
└── setFontSize(size)       ← updates state + persists to SecureStore
```

Font scale factors: `small = 0.85×`, `normal = 1.0×`, `large = 1.2×`

Every component calls `const { colors, typography } = useTheme()` and creates styles dynamically via `useMemo(() => makeStyles(colors), [colors])`.

### 3.5 API Client

The `api.ts` service module is a thin typed wrapper around `fetch`:

```typescript
// Base URL resolution order:
// 1. Constants.expoConfig?.extra?.apiUrl  (app.json → set at build time)
// 2. process.env.EXPO_PUBLIC_API_URL       (environment variable)
// 3. "https://alexaapp-production.up.railway.app/api"  (hardcoded fallback)

let _accessToken: string | null = null;
export const setApiToken = (token: string | null) => { _accessToken = token; };

// Every request automatically includes Authorization: Bearer <token>
// if a token is present in memory
```

The access token lives **only in memory** (never written to disk) and is re-set on every app start via the refresh token flow.

---

## 4. Backend — REST API

### 4.1 Server Setup

```
api/
├── src/
│   ├── index.ts              Express app: CORS, JSON body, /health, /api router
│   ├── routes/
│   │   ├── index.ts          Mounts all sub-routers under /api
│   │   ├── auth.ts           Login, register, refresh, logout, biometric-token
│   │   ├── inventory.ts      CRUD + JIT alert computation
│   │   ├── materials.ts      CRUD for raw materials catalog
│   │   ├── production.ts     Plans + order generation engine
│   │   ├── orders.ts         Purchase order lifecycle
│   │   ├── receptions.ts     Goods received records
│   │   ├── suppliers.ts      Supplier catalog
│   │   ├── recipes.ts        Beer style ingredient lines
│   │   ├── dashboard.ts      Aggregated KPIs
│   │   └── config.ts         JIT system configuration
│   ├── middleware/
│   │   ├── requireAuth.ts    JWT Bearer token validation
│   │   └── errorHandler.ts   Centralized error responses
│   └── lib/
│       └── prisma.ts         Singleton Prisma client
├── prisma/
│   └── schema.prisma         Data model definitions
└── railway.toml              Build + deploy configuration
```

### 4.2 Middleware Pipeline

Every authenticated request passes through:

```
Incoming request
     │
     ▼
CORS middleware         (origin: true — accepts all origins)
     │
     ▼
JSON body parser        (limit: 5mb)
     │
     ▼
Route matching
     │
     ├─ Public routes: /health, /api/auth/login, /api/auth/register, /api/auth/refresh
     │
     └─ Protected routes → requireAuth middleware
              │
              ▼
         Extract Bearer token from Authorization header
              │
              ▼
         jwt.verify(token, JWT_SECRET)
              │
         ┌───┴───┐
        OK       Error (401)
         │
         ▼
    Attach userId to request
         │
         ▼
    Route handler (Prisma query)
         │
         ▼
    JSON response
         │
         └─ On error → errorHandler middleware
```

### 4.3 JIT Alert Computation

The core business logic for inventory alerting runs on every inventory update:

```typescript
function computeAlertStatus(
  currentStock: number,
  dailyConsumption: number,
  reorderPointDays: number,   // days of stock at which to trigger yellow
  daysToOrder: number          // supplier lead time
): AlertStatus {
  if (dailyConsumption === 0)                return "NONE";
  const coverageDays = currentStock / dailyConsumption;
  if (currentStock === 0 || coverageDays <= daysToOrder) return "RED";    // must order NOW
  if (coverageDays <= reorderPointDays)      return "YELLOW";             // order soon
  return "GREEN";                                                          // sufficient stock
}
```

**Coverage calculation:**
- `coverageDays = currentStock ÷ dailyConsumption`
- `quantityToOrder = max(0, dailyConsumption × reorderPointDays − currentStock)`
- `estimatedOrderCost = quantityToOrder × material.unitPrice`

### 4.4 Order Generation Engine

The production order generation is a two-phase operation:

**Phase 1 — Preview (`?confirm=false`):**
1. Load production plan by ID
2. Fetch all `RecipeLine` entries for the plan's beer style
3. For each ingredient: calculate `needed = qtyPerBatch × plannedBatches`
4. Compare against current inventory stock
5. Return preview array with `shortfall`, `estimatedCost`, `willOrder` flag

**Phase 2 — Confirm (`?confirm=true`):**
1. Re-run Phase 1 calculation
2. Mark production plan `orderedAt = now()`
3. For each material with `shortfall > 0`: create `Order` record with:
   - Auto-generated folio: `PED-{timestamp}-{materialId}`
   - `estimatedArrivalDate = now + supplier.daysToOrder`
   - Status: `PENDING`
4. Return created orders count + skipped (sufficient stock) count

---

## 5. Database — PostgreSQL + Prisma

### 5.1 Entity Relationship Overview

```
Supplier ──< Material ──< Inventory
               │
               ├──< Order ──< Reception
               │
               └──< RecipeLine

ProductionPlan (references style string, not a FK to Recipe)

User ──< UserSession (refresh tokens)

JITConfig (singleton row, id = 1)
```

### 5.2 Data Models

**`users` + `user_sessions`**
Authentication store. Sessions hold refresh tokens with expiry timestamps. `onDelete: Cascade` ensures sessions are cleaned up when a user is deleted.

**`materials`**
Master catalog of raw ingredients. Types: `LUPULO` (hops), `MALTA` (malt), `YEAST`, `ADJUNTO` (adjuncts), `OTRO`. Each material optionally belongs to one supplier.

**`inventory`**
One-to-one with Material. Tracks live stock levels, daily consumption rate, reorder point, and the computed alert status. Updated on every stock change via the JIT computation.

**`suppliers`**
Supplier master with `daysToOrder` (lead time) and `estimatedDeliveryDays`. These values feed directly into JIT calculations.

**`orders`**
Purchase orders with full lifecycle: `PENDING → IN_TRANSIT → RECEIVED_COMPLETE / RECEIVED_PARTIAL / CANCELLED`. Auto-generated `folio` serves as the human-readable order reference.

**`receptions`**
Records actual goods received against an order. Tracks received quantity, condition, batch lot number, and who received it. Stock update is triggered upon reception creation.

**`production_plans`**
Scheduled brewing batches. Stores ingredient totals (`totalMaltKg`, `totalHopKg`, `totalYeastG`) computed at save time from per-batch quantities × planned batches count.

**`recipe_lines`**
Ingredient bill of materials per beer style. Unique constraint on `(beerStyle, materialId)` prevents duplicate ingredient entries.

**`jit_config`**
Singleton configuration row (always `id = 1`) for system-wide JIT parameters: working days per week, max raw material days, safety buffer, average daily production.

### 5.3 Key Indexes

- `UserSession.refreshToken` — unique index, critical for O(1) session lookup on every refresh
- `Inventory.materialId` — unique index, supports one-to-one join
- `Order.folio` — unique index for reference lookups
- `RecipeLine.(beerStyle, materialId)` — composite unique, prevents duplicate recipe entries

### 5.4 Schema Migration Strategy

The project uses **`prisma db push`** (schema push) rather than formal migrations. This is appropriate for a single-team product but would need to be migrated to `prisma migrate` for multi-environment deployments with controlled schema evolution.

---

## 6. Authentication & Security

### 6.1 Token Architecture

```
Login flow:
  POST /api/auth/login
       ├─ Verify password (bcrypt, 12 rounds)
       ├─ Create UserSession (refresh token, 30-day expiry)
       └─ Return: { accessToken (1h JWT), refreshToken (30d JWT), user }

App session:
  accessToken  → Stored IN MEMORY ONLY (setApiToken())
  refreshToken → Stored in SecureStore (encrypted on device)

Token refresh (on app start / 401 response):
  POST /api/auth/refresh { refreshToken }
       ├─ Verify JWT signature
       ├─ Check UserSession exists in DB and not expired
       └─ Return new accessToken

Logout:
  POST /api/auth/logout { refreshToken }
       └─ Deletes the specific UserSession from DB
          (access token expires naturally after 1h)
```

### 6.2 Biometric Authentication

The biometric system uses **two completely independent sessions**:

```
BIO_KEY (SecureStore)       REFRESH_KEY (SecureStore)
     │                            │
     └─ Points to a dedicated     └─ Points to the regular
        UserSession in DB            UserSession in DB
        (never deleted by logout)    (deleted on logout)

Enroll Face ID:
  1. LocalAuthentication.authenticateAsync()
  2. POST /api/auth/biometric-token   ← creates NEW UserSession
  3. Store new refreshToken → BIO_KEY
  4. Store user.email → BIO_EMAIL_KEY

Login with Face ID:
  1. LocalAuthentication.authenticateAsync()
  2. POST /api/auth/refresh(BIO_KEY)  ← get accessToken
  3. POST /api/auth/biometric-token   ← create NEW regular session
  4. Store new token → REFRESH_KEY    ← BIO_KEY untouched
  5. Set accessToken in memory

Logout:
  ├─ Deletes REFRESH_KEY session from DB
  └─ BIO_KEY session survives → Face ID still works on next login
```

This design ensures that logging out on one device does not invalidate biometric enrollment.

### 6.3 Security Properties

| Property | Implementation |
|----------|---------------|
| Password storage | bcrypt, cost factor 12 |
| User enumeration prevention | Constant-time compare even on "user not found" |
| Token transport | HTTPS only (Railway enforces TLS) |
| Access token lifetime | 1 hour |
| Refresh token lifetime | 30 days |
| Session revocation | DB-backed — logout deletes the session row |
| Biometric token | Separate DB session, not revoked by logout |
| Token storage on device | SecureStore (iOS Keychain / Android Keystore) |
| CORS | Currently `origin: true` — should be restricted in production |

---

## 7. Business Logic Modules

### 7.1 Dashboard

Aggregates five parallel Prisma queries into one response:
- `inventory.groupBy(alertStatus)` — alert counts (RED / YELLOW / GREEN / NONE)
- `material.count()` — total material catalog size
- `productionPlan.findMany` for next 7 days — upcoming production
- `order.aggregate` — monthly spend sum and order count
- `order.count` where `IN_TRANSIT` — in-flight orders

Response time is bounded by the slowest of the five queries, all running in parallel via `Promise.all`.

### 7.2 Inventory JIT

The JIT engine is purely reactive — it recalculates on every stock update. There is no background job or scheduled task. This means:
- Alert status is always current at query time
- The computation is lightweight (pure arithmetic, no additional DB queries needed at read time)
- `quantityToOrder` and `estimatedOrderCost` are stored denormalized for fast reads

### 7.3 Production Planning

Production plans store both per-batch and total values:
- `maltKgPerBatch`, `hopKgPerBatch`, `yeastGPerBatch` — inputs
- `totalMaltKg`, `totalHopKg`, `totalYeastG` — computed on save (`per × batches`)

The order generation engine cross-references `RecipeLine` entries, which define ingredient amounts per batch for each beer style. This is separate from the plan's own ingredient tracking — recipes define the composition while plans define the schedule.

### 7.4 Order Lifecycle

```
PENDING
   │
   ├─ Advance action (mobile) → IN_TRANSIT
   │       │
   │       └─ Receive action (mobile) → opens ReceiveModal
   │               │
   │               └─ Creates Reception record
   │                  Updates Order.status → RECEIVED_COMPLETE
   │                  Updates Order.totalPaid
   │                  Invalidates inventory cache (triggers stock refresh)
   │
   └─ (admin) → CANCELLED
```

---

## 8. API Reference

All endpoints require `Authorization: Bearer <accessToken>` unless noted.  
Base URL: `https://alexaapp-production.up.railway.app/api`

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | ❌ | Create account |
| `POST` | `/auth/login` | ❌ | Email + password login |
| `POST` | `/auth/refresh` | ❌ | Exchange refresh token for new access token |
| `GET` | `/auth/me` | ✅ | Get current user profile |
| `POST` | `/auth/logout` | ❌ | Revoke refresh token session |
| `POST` | `/auth/biometric-token` | ✅ | Create dedicated biometric session |

### Inventory

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/inventory` | ✅ | List all inventory rows (filterable by `alert`, `type`, `search`) |
| `GET` | `/inventory/alerts` | ✅ | Only RED and YELLOW items |
| `GET` | `/inventory/:materialId` | ✅ | Single inventory row |
| `PUT` | `/inventory/:materialId` | ✅ | Update stock, consumption, reorder point → triggers JIT recomputation |

### Materials

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/materials` | ✅ | List all materials (filterable by `type`, `search`) |
| `GET` | `/materials/:id` | ✅ | Single material |
| `POST` | `/materials` | ✅ | Create material |
| `PUT` | `/materials/:id` | ✅ | Update material |
| `DELETE` | `/materials/:id` | ✅ | Delete material |

### Production

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/production` | ✅ | List plans (filterable by `from`, `to`, `style`) |
| `GET` | `/production/upcoming` | ✅ | Plans for next 7 days |
| `GET` | `/production/:id` | ✅ | Single plan |
| `POST` | `/production` | ✅ | Create plan |
| `PUT` | `/production/:id` | ✅ | Update plan |
| `DELETE` | `/production/:id` | ✅ | Delete plan |
| `POST` | `/production/:id/generate-orders?confirm=false` | ✅ | Preview material requirements |
| `POST` | `/production/:id/generate-orders?confirm=true` | ✅ | Create purchase orders from plan |

### Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/orders` | ✅ | List orders (filterable by `status`, `materialId`) |
| `GET` | `/orders/summary/monthly` | ✅ | Monthly spend aggregation |
| `GET` | `/orders/:id` | ✅ | Single order |
| `POST` | `/orders` | ✅ | Create order |
| `PUT` | `/orders/:id` | ✅ | Update order (status, totalPaid, etc.) |
| `DELETE` | `/orders/:id` | ✅ | Delete order |

### Receptions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/receptions` | ✅ | List receptions (filterable by `orderId`) |
| `GET` | `/receptions/:id` | ✅ | Single reception |
| `POST` | `/receptions` | ✅ | Register received goods |

### Suppliers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/suppliers` | ✅ | List suppliers with material + order counts |
| `GET` | `/suppliers/:id` | ✅ | Single supplier |
| `PUT` | `/suppliers/:id` | ✅ | Update supplier |

### Recipes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/recipes` | ✅ | List recipe lines (filterable by `style`) |
| `POST` | `/recipes` | ✅ | Create recipe line |
| `PUT` | `/recipes/:id` | ✅ | Update recipe line |
| `DELETE` | `/recipes/:id` | ✅ | Delete recipe line |

### Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/dashboard/summary` | ✅ | Main KPIs: alerts, upcoming production, monthly spend |
| `GET` | `/dashboard/spend` | ✅ | Monthly spend history (all time) |

### System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | ❌ | Health check: `{ status: "ok" }` |
| `GET` | `/config` | ✅ | JIT configuration |
| `PUT` | `/config` | ✅ | Update JIT configuration |

---

## 9. Deployment — Railway

### 9.1 Services

Railway hosts two services in the same project:

| Service | Type | Config |
|---------|------|--------|
| `rrey-api` | Node.js (Nixpacks) | `api/railway.toml` |
| `rrey-db` | Managed PostgreSQL 16 | Railway plugin |

### 9.2 Build Pipeline

```
git push → Railway detects change in api/ directory
        │
        ▼
Nixpacks build container:
  1. npm install
  2. npx prisma generate   (generates Prisma client from schema)
  3. npm run build         (tsc → compiles TypeScript to dist/)
        │
        ▼
Deploy container:
  node dist/index.js       (starts Express server on $PORT)
        │
        ▼
Health check: GET /health → { status: "ok" }
```

**Important:** `prisma db push` is NOT run in the build pipeline. Schema migrations must be applied manually from a local machine with `DATABASE_URL` set, before deploying breaking schema changes. This avoids the health check timeout that would occur if migration ran during startup.

### 9.3 Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Railway service | PostgreSQL connection string (auto-set by Railway) |
| `JWT_SECRET` | Railway service | Secret for signing JWTs — must be cryptographically random, 32+ chars |
| `PORT` | Railway service | Auto-set by Railway, defaults to 3000 |

### 9.4 Current Deployment Specs (Hobby Plan)

| Resource | Allocation |
|----------|-----------|
| vCPU | Shared (burstable) |
| RAM | 512 MB |
| PostgreSQL storage | 1 GB |
| Outbound bandwidth | 100 GB/mo |
| Custom domain | Available |
| Auto-restart | ON_FAILURE, max 3 retries |

### 9.5 Deployment URL

`https://alexaapp-production.up.railway.app`

The mobile app has this URL hardcoded as a fallback in `api.ts` and also configured in `app.json` under `extra.apiUrl`.

---

## 10. Development Workflow

### 10.1 Local Setup

```bash
# 1. Start local PostgreSQL
docker-compose up -d

# 2. Configure API environment
# api/.env:
DATABASE_URL="postgresql://rrey:rrey_secret@localhost:5432/rrey_db"
JWT_SECRET="your-dev-secret-at-least-32-chars"

# 3. Push schema to local DB
cd api && npx prisma db push

# 4. (Optional) Seed with initial data
npm run db:seed

# 5. Start API dev server (hot reload)
npm run api       # runs ts-node-dev

# 6. Start Expo dev server
cd app && npx expo start

# 7. For iPhone on different network (e.g. mobile data):
npx expo start --tunnel    # requires ngrok auth token
```

### 10.2 Development vs Production

| Concern | Development | Production |
|---------|-------------|------------|
| Database | Local Docker PostgreSQL | Railway managed PostgreSQL |
| API URL | `localhost:3000` | `alexaapp-production.up.railway.app` |
| App transport | Expo Go (dev client) | Native build via EAS |
| Auth tokens | Same flow, shorter secrets OK | Long cryptographic secrets |
| CORS | `origin: true` | Should be locked to app domain |
| Tunnel | ngrok `--tunnel` flag | N/A (app talks to Railway directly) |

---

## 11. Industrial Scaling — 1,000 Concurrent Users

### 11.1 Current Bottlenecks

The current single-instance Railway Hobby deployment has the following limits:

| Bottleneck | Current | Required for 1,000 users |
|------------|---------|--------------------------|
| API instances | 1 | 4–8 |
| RAM per instance | 512 MB | 1–2 GB |
| DB connections | ~20 (Prisma default pool) | 200–500 (with pooler) |
| No caching layer | — | Redis for hot reads |
| No CDN | — | Optional for web assets |
| No rate limiting | — | Required |
| No horizontal auto-scale | — | Required |

### 11.2 Projected Load Profile

For 1,000 concurrent brewery workers:

| Metric | Estimate |
|--------|----------|
| Requests per second (avg) | ~50–100 req/s |
| Requests per second (peak) | ~200–400 req/s |
| Peak time window | 7:00–10:00 AM (shift start) |
| Read/write ratio | ~80% reads / 20% writes |
| Average payload size | ~5–20 KB per response |
| DB queries per request | 1–5 (most are single queries) |
| Monthly API calls (est.) | ~25–50 million |

### 11.3 Recommended Architecture at Scale

```
                        ┌────────────────────────────┐
                        │     Mobile App (1000 users) │
                        └──────────────┬─────────────┘
                                       │ HTTPS
                        ┌──────────────▼─────────────┐
                        │       Load Balancer         │
                        │   (Railway / Nginx / ALB)   │
                        └──┬──────────┬──────────┬───┘
                           │          │          │
                  ┌────────▼──┐ ┌─────▼────┐ ┌──▼──────┐
                  │  API #1   │ │  API #2  │ │  API #3  │
                  │ Node.js   │ │ Node.js  │ │ Node.js  │
                  │ 2vCPU/2GB │ │2vCPU/2GB │ │2vCPU/2GB │
                  └────────┬──┘ └─────┬────┘ └──┬───────┘
                           │          │          │
                        ┌──▼──────────▼──────────▼──┐
                        │    Redis Cache (optional)   │
                        │  Dashboard, inventory reads │
                        │     TTL: 30–60 seconds      │
                        └──────────────┬─────────────┘
                                       │
                        ┌──────────────▼─────────────┐
                        │    PgBouncer (conn pooler)  │
                        │   Pools to 100 DB conns     │
                        └──────────────┬─────────────┘
                                       │
                        ┌──────────────▼─────────────┐
                        │   PostgreSQL 16 (primary)   │
                        │   4 vCPU / 16 GB RAM        │
                        │   500 GB SSD storage        │
                        │   + Read replica (optional) │
                        └────────────────────────────┘
```

### 11.4 Code Changes Required for Scale

| Change | Priority | Effort |
|--------|----------|--------|
| Lock CORS to specific origins | High | Low |
| Add rate limiting (express-rate-limit) | High | Low |
| Add Redis cache for dashboard + inventory reads | High | Medium |
| Add request logging (Winston / Pino) | High | Low |
| Replace `prisma db push` with `prisma migrate` | High | Medium |
| Add connection pooling (PgBouncer or Prisma Data Proxy) | High | Low |
| Implement token refresh on 401 in api.ts | Medium | Low |
| Add API versioning (`/api/v1/`) | Medium | Low |
| Add push notifications for RED alerts | Medium | High |
| Add multi-tenancy (per-brewery isolation) | High (for SaaS) | Very High |

---

## 12. Budget Estimate

All prices are in USD, approximate as of 2025–2026.

---

### Tier 1 — Current (Development / Pilot, < 20 users)

| Service | Plan | Monthly Cost |
|---------|------|-------------|
| Railway — API service | Hobby ($5 credit included) | $0–5 |
| Railway — PostgreSQL | Included in Hobby | $0 |
| ngrok tunnel (dev) | Free tier | $0 |
| Expo Go (development) | Free | $0 |
| **Total** | | **~$0–5 / month** |

This is the current live configuration. Suitable for a single brewery team of up to ~20 users with light usage.

---

### Tier 2 — Growth (50–200 concurrent users)

| Service | Plan | Monthly Cost |
|---------|------|-------------|
| Railway Pro plan | Pro base | $20 |
| API service — 2 replicas (1 vCPU / 512 MB each) | Usage-based | ~$40 |
| PostgreSQL — Railway managed | 10 GB storage | ~$15 |
| Sentry (error monitoring) | Developer plan | $26 |
| Apple Developer Program (iOS builds) | Annual / 12 | $8.25 |
| Google Play Developer (Android) | One-time / 12 mo amortized | $2 |
| Expo EAS Build (native builds) | Free tier (30 builds/mo) | $0 |
| **Total** | | **~$111 / month** |

---

### Tier 3 — Industrial (500–1,000 concurrent users, Railway)

| Service | Plan / Specs | Monthly Cost |
|---------|-------------|-------------|
| Railway Pro | Base | $20 |
| API service — 6 replicas (2 vCPU / 2 GB RAM) | Usage ~720 vCPU-hr/mo | ~$240 |
| Railway PostgreSQL | 100 GB, performance tier | ~$80 |
| Redis (Railway or Upstash) | 500 MB, 10k req/s | ~$20 |
| Sentry (error + performance monitoring) | Team plan | $89 |
| Apple Developer Program | Annual / 12 | $8.25 |
| Expo EAS Build | Production plan | $99 |
| Cloudflare (DDoS, CDN, WAF) | Pro plan | $20 |
| **Total** | | **~$576 / month** |

---

### Tier 4 — Enterprise (1,000+ concurrent, AWS/GCP)

For production-grade reliability with SLAs, the recommended stack moves to a major cloud provider:

| Service | Specs | Monthly Cost |
|---------|-------|-------------|
| **AWS EC2** (API) — 3× t3.medium (2 vCPU, 4 GB) | Auto-scaling group, 3 AZs | ~$150 |
| **AWS ALB** (Application Load Balancer) | + data transfer | ~$25 |
| **AWS RDS PostgreSQL** — db.t3.large (2 vCPU, 8 GB) | Multi-AZ, 500 GB SSD, automated backups | ~$280 |
| **AWS ElastiCache Redis** — cache.t3.medium | Single node | ~$45 |
| **AWS CloudFront** (CDN + DDoS) | ~100 GB transfer | ~$10 |
| **AWS Secrets Manager** | JWT secret, DB credentials | ~$5 |
| **AWS CloudWatch** (logs, metrics, alarms) | Standard tier | ~$30 |
| **Datadog APM** (optional) | Pro plan | ~$150 |
| **Expo EAS** (build + updates) | Production plan | $99 |
| **Apple Developer** | Annual / 12 | $8.25 |
| **Google Play** | One-time amortized | $2 |
| **Domain + TLS** (Route 53 + ACM) | | ~$5 |
| **Total** | | **~$809–960 / month** |

---

### Cost Summary Table

| Scale | Concurrent Users | Monthly Cost | Cost per User |
|-------|-----------------|--------------|--------------|
| Pilot (current) | < 20 | ~$5 | < $0.25 |
| Growth | 50–200 | ~$111 | $0.55–$2.22 |
| Industrial (Railway) | 500–1,000 | ~$576 | $0.58–$1.15 |
| Enterprise (AWS) | 1,000+ | ~$960 | < $0.96 |

---

### Additional One-Time Costs (Any Scale)

| Item | Cost |
|------|------|
| Apple Developer enrollment | $99 / year |
| Google Play enrollment | $25 one-time |
| Initial EAS build setup | $0 (included in plan) |
| Expo OTA update credits | Included in EAS plan |
| SSL certificate | $0 (Let's Encrypt via Railway / ACM) |

---

### Cost Optimization Notes

1. **Read caching with Redis** is the single highest-impact optimization. The dashboard and inventory list endpoints are read many times per minute by all users — caching them for 30–60 seconds reduces DB queries by ~70% and enables the same DB instance to serve 3–5× more users.

2. **Connection pooling (PgBouncer)** is mandatory above 200 concurrent users. PostgreSQL's default connection limit is 100, and each idle Prisma client holds a connection. PgBouncer allows thousands of application connections to share 20–100 real DB connections.

3. **Horizontal API scaling is cheap** for this workload because the API is stateless (no in-memory session state — tokens are validated against the DB). Any replica can handle any request.

4. **Railway vs AWS**: Railway is significantly cheaper and simpler at < 500 users. At 1,000+ users with SLA requirements, AWS or GCP provide better observability, auto-scaling policies, and geographic distribution.

5. **For a SaaS offering** (selling this to multiple breweries), add multi-tenancy (schema-per-tenant or row-level security) and the cost per customer drops dramatically with shared infrastructure.

---

*Document generated May 2026 · Rrëy Cervecería Management System v1.0*
