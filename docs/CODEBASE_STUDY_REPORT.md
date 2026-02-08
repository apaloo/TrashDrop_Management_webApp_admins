# TrashDrop Admin Portal — Codebase Study Report

## 1) High-level architecture
- **Frontend framework**: Create React App (`react-scripts`), React 18 in `package.json`.
- **Routing**: React Router v6 in `src/App.js`.
- **Styling**: Tailwind CSS (plus some React Bootstrap usage).
- **Backend**: Supabase (`@supabase/supabase-js`) for:
  - **Auth** (sign-in/sign-up/reset-password)
  - **Database** (PostgREST queries + RPC calls)
  - **Realtime** (channels / postgres changes)
  - **Edge Functions** (invoked from frontend in some services)

### Directory roles (as implemented)
- **`src/pages/`**
  - Page-level screens and flows: login/signup/password reset, dashboards, maps, illegal dumping, etc.
- **`src/context/`**
  - App-wide state providers, primarily `AuthContext`.
- **`src/utils/`**
  - Core utilities: Supabase client creation, auth wrappers, dev auth, database helpers, schema safety utilities.
- **`src/services/`**
  - “Service layer” abstractions for domain logic + realtime sync + monitoring. Intended as a central place for business logic.
- **`cypress/`**
  - E2E tests.

---

## 2) Entry points and navigation

### `src/App.js`
- Defines:
  - **Public routes**: `/login`, `/signup`, `/forgot-password`, `/reset-password`
  - **Protected routes**: `/dashboard`, plus feature routes (pickup requests, bin mgmt, illegal dumping, settings)
- Uses:
  - `AuthProvider` + `ModalProvider`
  - `Layout` wrapper
  - Lazy-loading for major pages

### Auth gating logic
- **`ProtectedRoute`**
  - Waits until `authInitialized` and `loading === false`.
  - If not authenticated → redirects to `"/login"`.
  - If authenticated but onboarding not complete → redirects to `"/onboarding"` (unless already on onboarding).
- **`PublicRoute`**
  - If authenticated → redirects to `"/dashboard"` (unless already there).

**Key implication**: authentication + onboarding flags strongly control navigation. Any changes to `AuthContext` have a big effect on routing behavior.

---

## 3) Auth subsystem (Supabase + Dev Mode)

### `src/context/AuthContext.js`
This is the **source of truth** for:
- `user`
- `role`
- `isAuthenticated` (explicit state variable)
- `onboardingCompleted`
- `authInitialized`
- `loading`

#### Initialization flow (important)
- On mount:
  1. If `isDevMode()` is true:
     - Creates/loads a mock dev user via `devAuth` and sets auth state *without* Supabase session.
  2. Otherwise:
     - Calls `supabase.auth.getSession()` and populates state from a real Supabase session if present.
  3. Subscribes to `supabase.auth.onAuthStateChange()` and calls `setAuthData(session)`.

#### Dev auth design
- `src/utils/devAuth.js` toggles dev mode via:
  - `process.env.NODE_ENV !== 'production'`
  - `REACT_APP_USE_DEV_AUTH === 'true'`
- Stores a mock user and auth flags in `localStorage`.

**Invariants / assumptions**
- In dev mode, localStorage values can be treated like session state.
- In production, auth should come from Supabase session.

---

## 4) Supabase client + database error strategy

### `src/utils/supabase.js`
- Builds a Supabase client with:
  - `detectSessionInUrl: true` and `flowType: 'pkce'`
  - persists in `window` (`__trashdrop_supabase_client__`) to avoid multiple instances during hot reload

#### Config flags (env-driven)
- `REACT_APP_FORCE_LIVE_DATA`
- `REACT_APP_DISABLE_MOCK_DATA`
- `REACT_APP_REQUIRE_DATABASE`

#### `checkConnection()`
- Pings `batches` table.
- In non-strict mode: logs warnings and allows continuing.
- In strict mode: throws.

#### `handleDatabaseError()`
- Maps common Postgres/Supabase error codes to user-friendly messages.
- **Throws** an enhanced error object.

**Notable**: `handleDatabaseError` is written to throw, but some services treat it like it returns an error object (see risks section).

---

## 5) “Safe database” / schema validation layer

### `src/utils/safeDatabaseService.js`
Despite the header saying “strict”, the actual behavior is mixed:
- `safeQuery()` / `safeRPC()`:
  - Check existence of tables/functions before executing.
  - Throws when required items are missing (no mock generation).
- `initializeSchemaCheck()`:
  - Performs a schema check at app start (called from `App.js`).
  - Logs missing core tables and then sets internal flags to allow fallback modes.
  - The messaging (“strict mode”) and the behavior (“relaxed mode/partial success”) are inconsistent.

**Invariants / assumptions**
- The app expects at least `batches`, `bags`, `scans` to exist for core validation (per `initializeSchemaCheck`).
- Many SQL scripts in the repo suggest the DB schema is evolving and sometimes out-of-sync with code.

---

## 6) Service layer patterns

### Service conventions (as intended)
Most services:
- Have `initialize()` and `cleanup()`
- Keep local caches (`Map`) and subscriber registries (`Set`/`Map`)
- Integrate with:
  - `realtimeManager` for subscriptions
  - `performanceMonitor` for metrics

### `src/services/realtimeManager.js`
A centralized manager for realtime subscriptions:
- Tracks subscriptions & channels in Maps.
- Attempts reconnection with backoff.
- Creates uniquely named channels to avoid “subscribe multiple times” errors.
- Provides helpers like `subscribeToPickupRequests()`, `subscribeToAlerts()`.

**Important detail**: `realtimeManager.subscribe(subscriptionKey, tables, callback, options)` expects:
- `tables` as an array of table names (strings)

But some services call it with a different signature (see risks).

### `src/services/systemInit.js`
Orchestrates initialization:
- `initializeDatabase()` uses `checkConnection()`
- Conditionally starts performance monitoring & realtime subscriptions based on env flags
- Initializes core business services (`pickupRequestService`, `digitalBinService`, etc.)

**Note**: There isn’t a clear call site from `App.js` to `initializeAllServices()`; it exists in `src/services/index.js`, but startup appears to rely more on `safeDatabaseService.initializeSchemaCheck()` currently.

---

## 7) Example domain service deep dives

### Pickup Requests (`src/services/pickupRequestService.js`)
- Uses:
  - `realtimeManager.subscribeToPickupRequests()` (correct usage)
  - `trackDatabaseOperation()` wrapper
- Implements:
  - Fetch with advanced query & relationships
  - Reservation logic via RPC functions like `reserve_pickup_request`
  - Local reservation cache in memory

**Risk**: It uses `supabase.sql\`...\`` in updates. In `@supabase/supabase-js` v2, there isn’t a stable `supabase.sql` template helper in the client like there is in some other query builders. If this code is running, it’s either:
- dead code path,
- relying on a custom extension,
- or will fail at runtime when that branch is hit.

### Illegal Dumping (`src/services/illegalDumpingService.js`)
- Uses `safeDatabaseService.safeQuery/safeRPC` heavily.
- Mixes table names:
  - Subscribes to `illegal_dumping` table
  - Fetches from `illegal_dumping_mobile` table
- Also calls `assignCleanupTeam` / `updateIllegalDumpingStatus` from `src/utils/databaseUtils`.

This service shows the project’s general approach:
- Try RPC when available,
- fall back to direct table operations where RPC is removed/deprecated.

### Alerts & Notifications (`src/services/alertsNotificationService.js`)
- Triggers based on realtime updates in multiple tables.
- Creates `alerts` rows.
- Sends notifications via Edge Functions (`send-email`, `send-sms`, `send-push`).
- Maintains rate limiting and escalation timers in memory.

**Red flag**: It imports `supabaseAdmin` (which is exported as `null` in `src/utils/supabase.js`). That means any call like `supabaseAdmin.from(...)` will crash at runtime unless `supabaseAdmin` is replaced elsewhere.

### Dashboard Analytics (`src/services/dashboardAnalyticsService.js`)
- Imports and uses `supabaseAdmin.rpc(...)`.
- Same issue: `supabaseAdmin` is `null`.

---

## 8) Deployment & environment expectations
- `netlify.toml`:
  - `NODE_VERSION = "16.20.2"`
  - `NPM_FLAGS = "--legacy-peer-deps"`
  - Build uses `CI=false npm run build`
- README expects:
  - `REACT_APP_SUPABASE_URL`
  - `REACT_APP_SUPABASE_ANON_KEY`
  - optional `REACT_APP_USE_DEV_AUTH=true`

**Implication**: Local development on a newer Node version might work, but production deployment is pinned to Node 16.

---

## 9) Highest-risk areas / likely sources of bugs

### 9.1 `supabaseAdmin` is `null` but used widely
- In `src/utils/supabase.js`:
  - `export const supabaseAdmin = null;`
- But services call `supabaseAdmin.rpc`, `.from`, `.storage`, `.functions.invoke`.

**Practical effect**: Those services will throw immediately if executed. If you’re not seeing crashes, it likely means:
- those services aren’t being initialized/called in the UI path you tested, or
- there are guards elsewhere, or
- the code is partially legacy / not fully integrated.

### 9.2 RealtimeManager API mismatch across services
`realtimeManager.subscribe()` signature is:
- `(subscriptionKey, tablesArray, callback, options)`

But multiple services call it like:
- `realtimeManager.subscribe('illegal_dumping', { table: 'illegal_dumping', callback: ... })`

That won’t work as written unless there’s another overload. This suggests certain services are written against an older/newer version of the realtime manager.

### 9.3 Error handling inconsistencies (`handleDatabaseError`)
- `handleDatabaseError()` throws, but in `pickupRequestService.fetchPickupRequests` it does:
  - `const dbError = handleDatabaseError(error, 'fetchPickupRequests'); throw dbError;`

That line never returns; it will throw inside `handleDatabaseError`. It “works”, but the code implies confusion about return vs throw.

### 9.4 Database schema drift (tables/columns/functions)
The repo includes many `.sql` and `.md` “fix” documents, and code has many notes like:
- “column doesn’t exist”
- “RPC removed”
- “table doesn’t exist”

So the code is actively compensating for schema changes.

### 9.5 Dev mode auth overriding production behaviors
Dev mode logic is quite aggressive in `AuthContext`:
- It can create a fake user and mark onboarding complete.
- It stores multiple auth flags in localStorage.

This is useful for development but is a risk if env flags are misconfigured (though `isDevMode()` blocks in production builds).

---

## 10) Quick wins (non-breaking improvements)
- **Unify realtime subscription API usage**.
- **Replace/remove `supabaseAdmin` usage in frontend**:
  - If admin operations are needed, move them to **Edge Functions** (server-side) and call via `supabase.functions.invoke`.
  - For client-side DB access, use `supabase` with RLS-based permissions.
- **Establish a single “data access pattern”**:
  - Right now there’s a mix of direct `supabase.from`, `safeDatabaseService.safeQuery`, and RPCs.
- **Audit which services are actually initialized**:
  - Some of the biggest issues (supabaseAdmin, realtime API mismatch) may be dormant only because those services aren’t currently wired into the UI.
