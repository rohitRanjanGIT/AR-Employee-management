# Module 1.0 — Foundation

## Objective
Proven plumbing only. App runs, all 12 database tables exist in Neon, admin can log in, role-aware routing works, dashboards show live data from the DB. Nothing else.

---

## Prerequisites
- Next.js 15 project initialised with App Router
- pnpm as package manager
- shadcn/ui initialised
- Environment variables set in `.env` (gitignored via `.env*`):
  - `DATABASE_URL` — Neon Postgres connection string
  - `BETTER_AUTH_SECRET` — random 32-char string
  - `BETTER_AUTH_URL` — e.g. `http://localhost:3000`
  - `AADHAAR_ENCRYPTION_KEY` — 32-byte hex string for AES-256-GCM (generate with `openssl rand -hex 32`)

---

## Packages to Install

```bash
pnpm add drizzle-orm @neondatabase/serverless dotenv
pnpm add better-auth
pnpm add @tanstack/react-query @tanstack/react-table
pnpm add react-hook-form zod @hookform/resolvers
pnpm add drizzle-kit --save-dev
```

---

## Step 1 — Drizzle Config

Create `drizzle.config.ts` at project root:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

---

## Step 2 — Database Schema

Create `src/db/schema.ts` with all 12 tables. Every table must be created in this file — do not split across files.

Tables:
- users, sessions, accounts, verifications (better-auth)
- cities, employees, work_types, sites (core)
- site_work_types, site_supervisor_assignments (junctions)
- workers, site_snapshots (operational)

Enums: role, worker_status, worker_category, site_status

> **Note on ordering:** `cities` must be declared before `employees` because `employees.cityId` references `cities.id`.

---

## Step 3 — Run Migration

```bash
pnpm drizzle-kit push
```

Verify in Neon console that all 12 tables exist before proceeding.

---

## Step 4 — Drizzle Client

Create `src/db/index.ts`:

```ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

---

## Step 5 — better-auth Setup

- `src/lib/auth.ts` — server-side auth instance with drizzleAdapter
- `src/lib/auth-client.ts` — client-side auth client
- `src/app/api/auth/[...all]/route.ts` — Next.js route handler

---

## Step 6 — Seed Script

`src/db/seed.ts` — creates admin user via better-auth and seeds default work type.

Credentials: `admin@anuranjan.com` / `Admin@1234`

Run: `pnpm seed`

---

## Step 7 — Middleware (Role-Aware Routing)

`src/middleware.ts` — lightweight session check. Redirects unauthenticated users to `/login`. Full role enforcement is done in page components server-side.

---

## Step 8 — Login Page

`src/app/login/page.tsx` — Client component with react-hook-form + zod, shadcn Card/Input/Button/Label. Redirects to role-appropriate dashboard on success.

---

## Step 9 — Admin Dashboard

`src/app/admin/dashboard/page.tsx` — Server component. Checks session role === 'admin', fetches employee record, renders welcome card.

---

## Step 10 — Supervisor Dashboard

`src/app/supervisor/dashboard/page.tsx` — Same pattern as admin dashboard but for role === 'supervisor'.

---

## Step 11 — Root Redirect

`src/app/page.tsx` — Redirects to `/login`.

---

## Module 1.0 Gate Checklist

```
[ ] pnpm drizzle-kit push runs without errors
[ ] All 12 tables visible in Neon console:
    users, sessions, accounts, verifications,
    employees, cities, work_types, sites,
    site_work_types, site_supervisor_assignments,
    workers, site_snapshots
[ ] pnpm seed runs without errors
[ ] Admin user exists in users table with role = 'admin'
[ ] Default work type exists in work_types table
[ ] App starts with pnpm dev — no console errors
[ ] Visiting / redirects to /login
[ ] Login page renders correctly
[ ] Logging in with wrong password shows inline error
[ ] Logging in with admin credentials redirects to /admin/dashboard
[ ] Admin dashboard shows correct name and role from DB
[ ] Logout button signs out and redirects to /login
[ ] Visiting /admin/dashboard while logged out redirects to /login
[ ] pnpm tsc --noEmit — zero type errors
[ ] pnpm lint — zero lint errors
[ ] Git commit: "feat: module 1.0 foundation"
```

---

*Next: Module 1.1 — Cities & Sites*
