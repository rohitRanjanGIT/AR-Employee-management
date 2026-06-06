# Module 1.0 — Foundation

## Objective
Proven plumbing only. App runs, all 13 database tables exist in Neon, admin can log in, role-aware routing works, dashboards show live data from the DB. Nothing else.

---

## Prerequisites
- Next.js 15 project initialised with App Router
- pnpm as package manager
- shadcn/ui initialised with **base-nova** style (`@base-ui/react`)
- Environment variables set in `.env` (gitignored via `.env*`):
  - `DATABASE_URL` — Neon Postgres connection string
  - `BETTER_AUTH_SECRET` — random 32-char string
  - `BETTER_AUTH_URL` — e.g. `http://localhost:3000`
  - `NEXT_PUBLIC_APP_URL` — e.g. `http://localhost:3000`
  - `AADHAAR_ENCRYPTION_KEY` — 32-byte hex string for AES-256-GCM (generate with `openssl rand -hex 32`)

---

## Packages to Install

```bash
pnpm add drizzle-orm @neondatabase/serverless dotenv
pnpm add better-auth
pnpm add @tanstack/react-query @tanstack/react-table
pnpm add react-hook-form zod @hookform/resolvers
pnpm add drizzle-kit tsx --save-dev
```

---

## Step 1 — Environment Validation

Create `src/env.ts`. This runs at module load time and throws a clear error for any missing required variable — far better than the cryptic runtime failure from a `!` assertion.

```ts
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const env = {
  DATABASE_URL: requireEnv('DATABASE_URL'),
  BETTER_AUTH_SECRET: requireEnv('BETTER_AUTH_SECRET'),
  BETTER_AUTH_URL: requireEnv('BETTER_AUTH_URL'),
  AADHAAR_ENCRYPTION_KEY: requireEnv('AADHAAR_ENCRYPTION_KEY'),
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
}
```

`NEXT_PUBLIC_APP_URL` is client-side and has a fallback, so it is not required.

---

## Step 2 — Drizzle Config

Create `drizzle.config.ts` at project root. Use an explicit guard instead of `!` so `drizzle-kit` CLI fails clearly when `DATABASE_URL` is absent:

```ts
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

const url = process.env.DATABASE_URL
if (!url) throw new Error('Missing required environment variable: DATABASE_URL')

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
})
```

> **Why not import from `src/env.ts`?** `drizzle.config.ts` is loaded by the `drizzle-kit` CLI outside the Next.js runtime. It already has `dotenv/config` to load `.env`, so an inline guard is the right approach here.

---

## Step 3 — Database Schema

Create `src/db/schema.ts` with all 13 tables. Every table must be declared in this single file — do not split across files. Add Drizzle relations at the bottom of the file.

**Tables:**
- `users`, `sessions`, `accounts`, `verifications` (better-auth)
- `states`, `cities`, `employees`, `work_types`, `sites` (core)
- `site_work_types`, `site_supervisor_assignments` (junctions)
- `workers`, `site_snapshots` (operational)

**Enums:** `role`, `worker_status`, `worker_category`, `site_status`

> **Ordering matters:** `states` → `cities` → `employees` — each references the previous.

> **Relations:** All Drizzle `relations()` declarations live at the bottom of `schema.ts`, imported from `drizzle-orm`. They are required for `.findMany({ with: { ... } })` queries.

---

## Step 4 — Run Migration

```bash
pnpm drizzle-kit push
```

Verify in Neon console that all 13 tables exist before proceeding.

---

## Step 5 — Drizzle Client

Create `src/db/index.ts`. Import `DATABASE_URL` from `src/env.ts` — do not use `process.env.DATABASE_URL!`:

```ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import { env } from '@/env'

const sql = neon(env.DATABASE_URL)
export const db = drizzle(sql, { schema })
```

---

## Step 6 — better-auth Setup

- `src/lib/auth.ts` — server-side auth instance with `drizzleAdapter`, `emailAndPassword` enabled, `role` as an `additionalField` on user
- `src/lib/auth-client.ts` — client-side auth client using `NEXT_PUBLIC_APP_URL` with a `'http://localhost:3000'` fallback (client bundle — do not import from `src/env.ts`)
- `src/app/api/auth/[...all]/route.ts` — Next.js route handler

---

## Step 7 — Seed Script

`src/db/seed.ts` — creates both the admin and sample supervisor via `auth.api.signUpEmail`, then sets their roles via a DB update. Idempotent: wrapped in try/catch so re-running never fails.

| User | Email | Password | Role |
|------|-------|----------|------|
| Super Admin | `admin@anuranjan.com` | `Admin@1234` | `admin` |
| Sample Supervisor | `supervisor@anuranjan.com` | `Supervisor@1234` | `supervisor` |

Also seeds a default `General Construction` work type.

Add to `package.json` scripts:
```json
"seed": "tsx src/db/seed.ts"
```

Run: `pnpm seed`

---

## Step 8 — Middleware (Role-Aware Routing)

`src/middleware.ts` — optimistic cookie check only. Redirects unauthenticated users to `/login`. Full role validation happens in each page server component.

> **Do not** redirect logged-in users away from `/login` in middleware — stale/invalid cookies would cause an infinite redirect loop. The login page handles that redirect itself after validating the session.

---

## Step 9 — Login Page

`src/app/login/page.tsx` — Client component with react-hook-form + zod, shadcn `Card`/`Input`/`Button`/`Label`. Redirects to role-appropriate dashboard on success.

---

## Step 10 — Admin Dashboard

`src/app/admin/dashboard/page.tsx` — Server component. Checks `session.user.role === 'admin'`, renders welcome content. Layout and header are handled by `src/app/admin/layout.tsx` (added in Module 1.1).

---

## Step 11 — Supervisor Dashboard

`src/app/supervisor/dashboard/page.tsx` — Same pattern. Layout handled by `src/app/supervisor/layout.tsx` (added in Module 1.1).

---

## Step 12 — Root Redirect

`src/app/page.tsx` — Redirects to `/login`.

---

## Base UI Select — Known Rendering Behaviour

shadcn base-nova style uses `@base-ui/react` instead of Radix UI. **`Select.Value` renders the raw value string** (e.g. a UUID), not the label of the selected item as Radix does.

**Pattern to use in all Select instances:**

```tsx
// Track display name in local state
const [selectedName, setSelectedName] = useState('')

// On value change, resolve the label from the data list
onValueChange={(v) => {
  setSelectedName(items.find(i => i.id === v)?.name ?? '')
  // ... other state updates
}}

// Render label directly in trigger — do NOT use <SelectValue />
<SelectTrigger className="w-full">
  <span className={selectedName ? 'text-foreground' : 'text-muted-foreground'}>
    {selectedName || 'Select an option'}
  </span>
</SelectTrigger>
```

Do not import or use `SelectValue` in controlled selects with UUID values.

---

## Module 1.0 Gate Checklist

```
[ ] pnpm drizzle-kit push runs without errors
[ ] All 13 tables visible in Neon console:
    users, sessions, accounts, verifications,
    states, cities, employees, work_types, sites,
    site_work_types, site_supervisor_assignments,
    workers, site_snapshots
[ ] pnpm seed runs without errors
[ ] Admin user exists in users table with role = 'admin'
[ ] Supervisor user exists in users table with role = 'supervisor'
[ ] Default work type exists in work_types table
[ ] App starts with pnpm dev — no console errors
[ ] Visiting / redirects to /login
[ ] Login page renders correctly
[ ] Logging in with wrong password shows inline error
[ ] Logging in with admin credentials redirects to /admin/dashboard
[ ] Logging in with supervisor credentials redirects to /supervisor/dashboard
[ ] Admin dashboard shows correct name and role from DB
[ ] Logout button signs out and redirects to /login
[ ] Visiting /admin/dashboard while logged out redirects to /login
[ ] pnpm tsc --noEmit — zero type errors
[ ] pnpm lint — zero lint errors
[ ] Git commit: "feat: module 1.0 foundation"
```

---

*Next: Module 1.1 — Cities & Sites*
