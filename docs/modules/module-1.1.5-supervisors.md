# Module 1.1.5 — Supervisors

## Objective
Admin can create supervisor accounts, view all supervisors, and deactivate them. This module exists solely to ensure supervisor employee records exist before Module 1.2 (Workers) needs them. Nothing else.

---

## Prerequisites
- Module 1.1 gate checklist fully passed
- At least one active city exists in the DB
- Admin can log in and reach `/admin/dashboard`

---

## Scope

**Admin can:**
- Create a supervisor account (creates a `users` row + `employees` row in one action)
- View all supervisors in a table
- Deactivate a supervisor → login disabled, site assignments revoked
- Reactivate a deactivated supervisor

**Supervisor cannot:**
- Create or manage other supervisors
- See this section at all

---

## Packages to Install

No new packages required.

---

## Step 1 — Schema Changes

### Add `status` column to `employees`

The `employees` table needs an active/inactive status so supervisors can be deactivated without being deleted.

```ts
// Add to employees table in schema.ts
status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
```

### Add `status` column to `users`

better-auth needs a way to block login for deactivated supervisors. Add a status column to `users`:

```ts
// Add to users table in schema.ts
status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
```

After updating schema, run:
```bash
pnpm drizzle-kit push
pnpm tsc --noEmit
```

---

## Step 2 — Update Auth to Check User Status

Update `src/lib/auth.ts` to block login for inactive users:

```ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  hooks: {
    after: [
      {
        matcher: (context) => context.path === '/sign-in/email',
        handler: async (context) => {
          // If sign-in succeeded, check if user is active
          const userId = context.context?.session?.userId
          if (userId) {
            const user = await db.query.users.findFirst({
              where: eq(schema.users.id, userId),
            })
            if (user?.status === 'inactive') {
              // Invalidate the session that was just created
              const sessionToken = context.context?.session?.token
              if (sessionToken) {
                await db
                  .delete(schema.sessions)
                  .where(eq(schema.sessions.token, sessionToken))
              }
              throw new Error('Account is deactivated. Contact your administrator.')
            }
          }
          return context
        },
      },
    ],
  },
})
```

> **Note:** If the better-auth version in use does not support `hooks.after` with this signature, implement the status check inside the middleware instead — in `src/middleware.ts`, after confirming a session exists, fetch the user record and redirect to `/login?error=deactivated` if `status === 'inactive'`. Either approach is acceptable; pick whichever better-auth supports cleanly.

---

## Step 3 — Server Actions

Create `src/actions/supervisors.ts`:

```ts
'use server'

import { db } from '@/db'
import { users, employees, sessions, siteSupervisorAssignments } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

// ─── Create Supervisor ────────────────────────────────────────────────────────
// Creates a users row (via better-auth) + an employees row linked to it.
// The new account is immediately active.

const createSupervisorSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().max(15).optional(),
  joinDate: z.string().optional(),           // ISO date string
  salaryMonthly: z.string().optional(),      // decimal string
  cityId: z.string().uuid().optional(),      // home city — optional
})

export async function createSupervisor(input: z.infer<typeof createSupervisorSchema>) {
  await requireAdmin()
  const data = createSupervisorSchema.parse(input)

  // Check email is not already taken
  const existing = await db.query.users.findFirst({
    where: eq(users.email, data.email),
  })
  if (existing) throw new Error('Email already in use')

  // Create the auth user via better-auth
  const result = await auth.api.signUpEmail({
    body: {
      email: data.email,
      password: data.password,
      name: data.name,
    },
  })

  if (!result?.user?.id) throw new Error('Failed to create user account')

  // Set role to supervisor (better-auth defaults to whatever schema default is)
  await db
    .update(users)
    .set({ role: 'supervisor', status: 'active' })
    .where(eq(users.id, result.user.id))

  // Create the employee profile
  await db.insert(employees).values({
    userId: result.user.id,
    name: data.name,
    phone: data.phone ?? null,
    joinDate: data.joinDate ? new Date(data.joinDate) : null,
    salaryMonthly: data.salaryMonthly ?? null,
    cityId: data.cityId ?? null,
    status: 'active',
  })

  revalidatePath('/admin/supervisors')
}

// ─── Get All Supervisors ──────────────────────────────────────────────────────

export async function getAllSupervisors() {
  await requireAdmin()

  const rows = await db.query.employees.findMany({
    with: {
      user: true,
      city: true,
      siteSupervisorAssignments: {
        with: { site: { with: { city: true } } },
      },
    },
    // Only employees whose user has role = supervisor
    // Drizzle does not support filtering on relations directly —
    // filter in application code after the query
  })

  return rows
    .filter((e) => e.user.role === 'supervisor')
    .map((e) => ({
      id: e.id,
      userId: e.userId,
      name: e.name,
      email: e.user.email,
      phone: e.phone,
      joinDate: e.joinDate,
      salaryMonthly: e.salaryMonthly,
      homeCity: e.city,
      status: e.status,
      assignedSites: e.siteSupervisorAssignments.map((a) => ({
        siteId: a.site.id,
        siteName: a.site.name,
        siteCode: a.site.code,
        cityName: a.site.city.name,
      })),
    }))
}

// ─── Deactivate Supervisor ────────────────────────────────────────────────────
// Marks user + employee as inactive, kills all active sessions,
// revokes all site assignments.

export async function deactivateSupervisor(employeeId: string) {
  await requireAdmin()

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    with: { user: true },
  })
  if (!employee) throw new Error('Supervisor not found')
  if (employee.status === 'inactive') throw new Error('Supervisor already inactive')

  // Mark user inactive → blocks future logins
  await db
    .update(users)
    .set({ status: 'inactive' })
    .where(eq(users.id, employee.userId))

  // Mark employee inactive
  await db
    .update(employees)
    .set({ status: 'inactive' })
    .where(eq(employees.id, employeeId))

  // Kill all active sessions
  await db
    .delete(sessions)
    .where(eq(sessions.userId, employee.userId))

  // Revoke all site assignments
  await db
    .delete(siteSupervisorAssignments)
    .where(eq(siteSupervisorAssignments.employeeId, employeeId))

  revalidatePath('/admin/supervisors')
}

// ─── Reactivate Supervisor ────────────────────────────────────────────────────

export async function reactivateSupervisor(employeeId: string) {
  await requireAdmin()

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    with: { user: true },
  })
  if (!employee) throw new Error('Supervisor not found')
  if (employee.status === 'active') throw new Error('Supervisor already active')

  await db
    .update(users)
    .set({ status: 'active' })
    .where(eq(users.id, employee.userId))

  await db
    .update(employees)
    .set({ status: 'inactive' })
    .where(eq(employees.id, employeeId))

  revalidatePath('/admin/supervisors')
}
```

> **Note on `reactivateSupervisor`:** The employee status update above should set `status: 'active'`, not `'inactive'`. This is a copy-paste trap — double-check both `update` calls set the intended value.

---

## Step 4 — Update `getSupervisorEmployees` in `sites.ts`

The sites action file already has a `getSupervisorEmployees()` stub. Replace it with the real implementation:

```ts
// In src/actions/sites.ts

export async function getSupervisorEmployees() {
  await requireAdmin()

  const rows = await db.query.employees.findMany({
    with: { user: true },
  })

  return rows
    .filter((e) => e.user.role === 'supervisor' && e.status === 'active')
    .map((e) => ({
      id: e.id,
      name: e.name,
      email: e.user.email,
    }))
}
```

This is what `AssignSupervisorDialog` in the sites page uses to populate the supervisor dropdown. Only active supervisors are shown.

---

## Step 5 — Admin Navigation Update

Add "Supervisors" to `src/components/AdminNav.tsx`:

- Dashboard → `/admin/dashboard`
- Cities → `/admin/cities`
- Sites → `/admin/sites`
- **Supervisors → `/admin/supervisors`** ← new
- Work Types → `/admin/work-types`

---

## Step 6 — Admin: Supervisors Page

File structure:
```
src/app/admin/supervisors/
  page.tsx                      ← server component
  SupervisorsTable.tsx          ← TanStack Table, client component
  CreateSupervisorDialog.tsx    ← create form
  DeactivateConfirmDialog.tsx   ← confirm deactivation
```

### `page.tsx` (server component)
- Role check: admin only
- Fetch all supervisors via `getAllSupervisors()`
- Fetch all active cities for the home city dropdown in create form
- Render `<SupervisorsTable />`

### `SupervisorsTable.tsx` (client component)
TanStack Table columns:
- Name
- Email
- Phone
- Home City
- Monthly Salary (formatted ₹ Indian locale)
- Assigned Sites (comma-separated `{siteName} ({cityName})` — truncate after 2, show "+N more")
- Status (badge: active / inactive)
- Actions: Deactivate (active rows) | Reactivate (inactive rows)

Filters: by status

### `CreateSupervisorDialog.tsx`
Fields:
- Name (required)
- Email (required)
- Password (required, min 8 chars) — type `password`, show/hide toggle
- Phone (optional)
- Join Date (optional) — date input
- Monthly Salary (optional) — numeric input, ₹ prefix
- Home City (optional) — Select from active cities

Helper text under password: "Share this with the supervisor — they cannot reset it themselves."

On submit: call `createSupervisor()`.
On success: close dialog, table refreshes via `router.refresh()`.
Show inline error if email already in use.

### `DeactivateConfirmDialog.tsx`
- Body: "Deactivating {name} will remove them from all site assignments and immediately end their session. They will not be able to log in until reactivated."
- Two buttons: Cancel | Deactivate (destructive)
- On confirm: call `deactivateSupervisor(employeeId)`
- Reactivate: simpler confirm — "Reactivate {name}? They will be able to log in again." — calls `reactivateSupervisor(employeeId)`

---

## Key Logic Notes

**Password management:** There is no password reset flow in this system. Admin sets the password at creation. If a supervisor forgets their password, admin must deactivate and recreate the account — or a password reset feature can be added in a future module. Do not build it now.

**Home city vs assigned cities:** `employees.cityId` is the supervisor's *home* city — an administrative grouping, not a functional restriction. Functional city access comes from site assignments (`siteSupervisorAssignments → sites → cityId`). The home city is optional and informational only.

**Deactivation is not deletion:** Deactivated supervisors remain in the DB with all their history intact. The `status` column controls login access and site assignment eligibility.

**Session invalidation:** `deactivateSupervisor` deletes all rows in `sessions` for that userId. If the supervisor is currently logged in, their next request will fail the session check and middleware will redirect them to `/login`.

**`getAllSupervisors` filter:** Drizzle's relational query API does not support `WHERE` on joined relation columns directly. The filter `e.user.role === 'supervisor'` happens in application code after the query. This is fine for the expected volume (tens to low hundreds of supervisors).

---

## Module 1.1.5 Gate Checklist

Do not proceed to Module 1.2 until every item below passes.

```
[ ] Schema updated: employees.status and users.status columns exist
[ ] pnpm drizzle-kit push runs without errors
[ ] pnpm tsc --noEmit — zero type errors
[ ] Admin nav shows Supervisors link

CREATE SUPERVISOR
[ ] Admin can open Create Supervisor dialog
[ ] All fields render correctly
[ ] Password field has show/hide toggle
[ ] Submitting with duplicate email shows inline error
[ ] On success: new supervisor appears in table with status = active
[ ] New supervisor can log in with the credentials admin set
[ ] Logged-in supervisor lands on /supervisor/dashboard
[ ] Supervisor's name and role show correctly on dashboard

SUPERVISORS TABLE
[ ] Table shows: name, email, phone, home city, salary, assigned sites, status
[ ] Assigned sites column shows correct site + city names
[ ] Active/inactive status badge renders correctly
[ ] Filtering by status works

DEACTIVATE / REACTIVATE
[ ] Deactivate button appears on active supervisor rows
[ ] Confirm dialog shows supervisor name and warning text
[ ] After deactivation: status badge changes to inactive
[ ] After deactivation: supervisor is removed from all site assignments
     (verify in /admin/sites — their chips should be gone)
[ ] Deactivated supervisor cannot log in
     (try logging in — should show error or redirect to login)
[ ] Reactivate button appears on inactive rows
[ ] After reactivation: supervisor can log in again

SITES INTEGRATION
[ ] AssignSupervisorDialog on /admin/sites now shows real supervisors
[ ] Deactivated supervisors do not appear in the assign dropdown
[ ] At least one supervisor can be assigned to a site end-to-end

QUALITY
[ ] pnpm tsc --noEmit — zero type errors
[ ] pnpm lint — zero lint errors
[ ] Git commit: "feat: module 1.1.5 supervisors"
```

---

*Next: Module 1.2 — Workers*
