# Module 1.3-pre — Profile Management, Attendance Windows & Worker Table Fix

## Objective
Three focused patches before Module 1.3 (Attendance) is implemented:
1. Admin and supervisor can manage their own profile and password. Admin can also edit supervisor details and password, and remove a supervisor permanently.
2. Sites have configurable attendance time windows (morning and evening). Late marks are flagged.
3. Workers table default filter fixed — shows all statuses instead of pending-only on load.

---

## Prerequisites
- Modules 1.0 through 1.2 gate checklists fully passed
- Admin and at least one supervisor exist in the DB

---

## Packages to Install

No new packages required.

---

## Part A — Profile & Password Management

### A1 — Schema Changes

No schema changes required for profile fields — `employees` already has `name`, `phone`, `salary_monthly`, `city_id`. Password is managed by better-auth via the `accounts` table.

---

### A2 — Server Actions

Create `src/actions/profile.ts`:

```ts
'use server'

import { db } from '@/db'
import { users, employees, accounts } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { encryptAadhaar, extractLastFour } from '@/lib/aadhaar'

// ─── Auth guards ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Unauthorised')
  return session
}

// ─── Update own profile ───────────────────────────────────────────────────────
// Available to both admin and supervisor.
// Updates: name, phone. Salary and city are admin-only fields — excluded here.

const updateOwnProfileSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(15).optional(),
})

export async function updateOwnProfile(input: z.infer<typeof updateOwnProfileSchema>) {
  const session = await requireAuth()
  const data = updateOwnProfileSchema.parse(input)

  // Update display name in users table (used by better-auth session)
  await db
    .update(users)
    .set({ name: data.name, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  // Update employee profile
  await db
    .update(employees)
    .set({ name: data.name, phone: data.phone ?? null, updatedAt: new Date() })
    .where(eq(employees.userId, session.user.id))

  revalidatePath('/admin/dashboard')
  revalidatePath('/supervisor/dashboard')
}

// ─── Change own password ──────────────────────────────────────────────────────
// Available to both admin and supervisor.

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function changeOwnPassword(
  input: z.infer<typeof changeOwnPasswordSchema>
) {
  const session = await requireAuth()
  const data = changeOwnPasswordSchema.parse(input)

  // Use better-auth's built-in password change — verifies current password
  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: false,
      },
    })
  } catch (e: any) {
    // better-auth throws on wrong current password
    throw new Error('Current password is incorrect')
  }
}

// ─── Admin: update supervisor profile ────────────────────────────────────────
// Admin can edit name, phone, salary, city of any supervisor.

const updateSupervisorProfileSchema = z.object({
  employeeId: z.string().uuid(),
  name: z.string().min(1).max(200),
  phone: z.string().max(15).optional(),
  salaryMonthly: z.string().optional(),
  cityId: z.string().uuid().optional(),
  joinDate: z.string().optional(),
})

export async function updateSupervisorProfile(
  input: z.infer<typeof updateSupervisorProfileSchema>
) {
  await requireAdmin()
  const data = updateSupervisorProfileSchema.parse(input)

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, data.employeeId),
    with: { user: true },
  })
  if (!employee) throw new Error('Employee not found')
  if (employee.user.role !== 'supervisor') throw new Error('Not a supervisor')

  await db
    .update(users)
    .set({ name: data.name, updatedAt: new Date() })
    .where(eq(users.id, employee.userId))

  await db
    .update(employees)
    .set({
      name: data.name,
      phone: data.phone ?? null,
      salaryMonthly: data.salaryMonthly ?? null,
      cityId: data.cityId ?? null,
      joinDate: data.joinDate ? new Date(data.joinDate) : null,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, data.employeeId))

  revalidatePath('/admin/supervisors')
}

// ─── Admin: reset supervisor password ────────────────────────────────────────
// Admin sets a new password for a supervisor directly — no current password needed.

const resetSupervisorPasswordSchema = z.object({
  employeeId: z.string().uuid(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function resetSupervisorPassword(
  input: z.infer<typeof resetSupervisorPasswordSchema>
) {
  await requireAdmin()
  const data = resetSupervisorPasswordSchema.parse(input)

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, data.employeeId),
    with: { user: true },
  })
  if (!employee) throw new Error('Employee not found')
  if (employee.user.role !== 'supervisor') throw new Error('Not a supervisor')

  // Use better-auth admin API to set password directly
  // This does not require the current password
  await auth.api.setPassword({
    body: {
      newPassword: data.newPassword,
      userId: employee.userId,
    },
  })

  // Invalidate all existing sessions for this user
  await db
    .delete(sessions => sessions)
    .where(eq(sessions.userId, employee.userId))

  revalidatePath('/admin/supervisors')
}

// ─── Admin: remove supervisor permanently ────────────────────────────────────
// Hard deletes the users row — cascades to employees, sessions, accounts via FK.
// Use only when the supervisor record is no longer needed.
// Deactivation (from 1.1.5) is preferred for temporary suspension.

export async function removeSupervisor(employeeId: string) {
  await requireAdmin()

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    with: { user: true },
  })
  if (!employee) throw new Error('Employee not found')
  if (employee.user.role !== 'supervisor') throw new Error('Not a supervisor')

  // Cascade delete: users → sessions, accounts, employees all cascade on delete
  await db.delete(users).where(eq(users.id, employee.userId))

  revalidatePath('/admin/supervisors')
}
```

> **Note on `auth.api.setPassword`:** Check the installed version of better-auth for the exact method name and parameter shape for admin password reset. If `setPassword` is not available, the fallback is to directly hash the password using bcrypt and update the `accounts` table's `password` field:
> ```ts
> import { hash } from 'bcryptjs' // pnpm add bcryptjs @types/bcryptjs
> const hashed = await hash(data.newPassword, 10)
> await db.update(accounts)
>   .set({ password: hashed })
>   .where(eq(accounts.userId, employee.userId))
> ```

---

### A3 — Profile Settings Page (Shared)

Create `src/app/settings/page.tsx` — accessible to both admin and supervisor:

```
src/app/settings/
  page.tsx               ← server component, role-aware
  ProfileForm.tsx        ← update name + phone
  ChangePasswordForm.tsx ← change own password
```

### `page.tsx` (server component)
- Session check: any authenticated user
- Fetch employee record for current user
- Render `ProfileForm` and `ChangePasswordForm` side by side (or stacked on mobile)
- Page title: "Account Settings"

### `ProfileForm.tsx` (client component)
- Fields: Name (required), Phone (optional)
- Pre-filled with current values
- On submit: calls `updateOwnProfile()`
- On success: show toast "Profile updated"

### `ChangePasswordForm.tsx` (client component)
- Fields: Current Password, New Password, Confirm New Password
- Confirm password validated client-side (must match new password)
- On submit: calls `changeOwnPassword()`
- On success: show toast "Password changed"
- On error (wrong current password): show inline error

Add a Settings link to both nav components:

`AdminNav.tsx` — add Settings → `/settings` (can be at the end or as a separate icon)
`SupervisorNav.tsx` — same

---

### A4 — Supervisors Page Updates (Admin)

Update `src/app/admin/supervisors/SupervisorsTable.tsx` — add two new actions per row:

**Edit Profile** → opens `EditSupervisorDialog`
**Reset Password** → opens `ResetPasswordDialog`
**Remove** → replaces or sits alongside the existing Deactivate button

Update `src/app/admin/supervisors/` with new dialog files:

### `EditSupervisorDialog.tsx`
- Pre-filled with current supervisor data
- Fields: Name, Phone, Join Date, Monthly Salary, Home City
- On submit: calls `updateSupervisorProfile()`

### `ResetPasswordDialog.tsx`
- Shows supervisor name
- Field: New Password (min 8 chars) with show/hide toggle
- Warning text: "This will immediately end the supervisor's current session."
- On submit: calls `resetSupervisorPassword()`
- On success: show toast "Password reset. Share the new password with the supervisor."

### `RemoveSupervisorDialog.tsx`
- Destructive confirm dialog
- Body: "Permanently removing {name} will delete all their data including site assignments. This cannot be undone. If you want to temporarily suspend access, use Deactivate instead."
- Type-to-confirm: supervisor must type the supervisor's name to enable the Remove button
- On confirm: calls `removeSupervisor(employeeId)`

> **Deactivate vs Remove:** Deactivate (from 1.1.5) suspends login and revokes site assignments but keeps the record. Remove permanently deletes. Both options should be visible in the Actions column — Deactivate for temporary, Remove for permanent.

---

## Part B — Site Attendance Time Windows

### B1 — Schema Changes

Add two new columns to the `sites` table in `src/db/schema.ts`:

```ts
// Add to sites table
morningAttendanceStart: text('morning_attendance_start'),  // e.g. '08:00'
morningAttendanceEnd: text('morning_attendance_end'),      // e.g. '10:00'
eveningAttendanceStart: text('evening_attendance_start'),  // e.g. '18:00'
eveningAttendanceEnd: text('evening_attendance_end'),      // e.g. '20:00'
```

Time stored as plain `HH:MM` 24-hour strings — no timezone complexity, no separate table needed.

Add `isLate` flag to the `attendance` table:

```ts
// Add to attendance table
isMorningLate: boolean('is_morning_late').notNull().default(false),
isEveningLate: boolean('is_evening_late').notNull().default(false),
```

After schema changes, run:
```bash
pnpm drizzle-kit push
pnpm tsc --noEmit
```

---

### B2 — Attendance Time Window Utility

Add to `src/lib/attendance.ts`:

```ts
/**
 * Checks if a given timestamp falls within an HH:MM–HH:MM window.
 * Returns true if on time, false if late or outside the window entirely.
 * If no window is configured (start/end are null), always returns true (on time).
 */
export function isWithinWindow(
  markedAt: Date,
  windowStart: string | null,
  windowEnd: string | null
): boolean {
  if (!windowStart || !windowEnd) return true

  const [startH, startM] = windowStart.split(':').map(Number)
  const [endH, endM] = windowEnd.split(':').map(Number)

  const markH = markedAt.getHours()
  const markM = markedAt.getMinutes()

  const markMinutes = markH * 60 + markM
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  return markMinutes >= startMinutes && markMinutes <= endMinutes
}
```

---

### B3 — Update Site Creation and Edit

Update `src/actions/sites.ts`:

Add optional time window fields to `createSiteSchema`:

```ts
const createSiteSchema = z.object({
  // ...existing fields...
  morningAttendanceStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  morningAttendanceEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  eveningAttendanceStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  eveningAttendanceEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
})
```

All four fields are optional — sites without time windows have no attendance time restriction.

Add a validation rule: if any one of the four fields is provided, both start and end for that shift must be provided:

```ts
.refine(
  (d) => {
    const morningComplete =
      (!d.morningAttendanceStart && !d.morningAttendanceEnd) ||
      (d.morningAttendanceStart && d.morningAttendanceEnd)
    const eveningComplete =
      (!d.eveningAttendanceStart && !d.eveningAttendanceEnd) ||
      (d.eveningAttendanceStart && d.eveningAttendanceEnd)
    return morningComplete && eveningComplete
  },
  { message: 'Both start and end times must be provided for each shift' }
)
```

Also add `updateSiteAttendanceWindows` action for editing existing sites:

```ts
const updateAttendanceWindowSchema = z.object({
  siteId: z.string().uuid(),
  morningAttendanceStart: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  morningAttendanceEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  eveningAttendanceStart: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  eveningAttendanceEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
})

export async function updateSiteAttendanceWindows(
  input: z.infer<typeof updateAttendanceWindowSchema>
) {
  await requireAdmin()
  const data = updateAttendanceWindowSchema.parse(input)

  await db
    .update(sites)
    .set({
      morningAttendanceStart: data.morningAttendanceStart,
      morningAttendanceEnd: data.morningAttendanceEnd,
      eveningAttendanceStart: data.eveningAttendanceStart,
      eveningAttendanceEnd: data.eveningAttendanceEnd,
      updatedAt: new Date(),
    })
    .where(eq(sites.id, data.siteId))

  revalidatePath('/admin/sites')
}
```

---

### B4 — Update Attendance Actions for Late Detection

In `src/actions/attendance.ts` (Module 1.3), when inserting or updating morning/evening marks, fetch the site's time window and compute `isMorningLate` / `isEveningLate`.

Add this logic inside `markMorningAttendance` when inserting or updating:

```ts
// Fetch site time window
const siteWithWindow = await db.query.sites.findFirst({
  where: eq(sites.id, data.siteId),
})

const isMorningLate = !isWithinWindow(
  now,
  siteWithWindow?.morningAttendanceStart ?? null,
  siteWithWindow?.morningAttendanceEnd ?? null
)
```

Set `isMorningLate` on both insert and update of the attendance row.

Same pattern for `markEveningAttendance` using `eveningAttendanceStart` / `eveningAttendanceEnd` → `isEveningLate`.

---

### B5 — Update Site Creation UI

Update `src/app/admin/sites/CreateSiteDialog.tsx`:

Add an optional "Attendance Time Windows" section at the bottom of the form — collapsible or under a separator:

**Morning Attendance Window:**
- Start Time (HH:MM input, 24hr) — e.g. 08:00
- End Time (HH:MM input, 24hr) — e.g. 10:00

**Evening Attendance Window:**
- Start Time — e.g. 18:00
- End Time — e.g. 20:00

Helper text: "Supervisors marking outside these windows will be flagged as late. Leave blank for no restriction."

Add a time input component — use `<input type="time" />` (native HTML, renders a time picker on mobile). Store as `HH:MM` string.

Also add an "Edit Time Windows" option in the site Actions column on the sites table — opens a dialog pre-filled with current values, calls `updateSiteAttendanceWindows()`.

---

### B6 — Late Badge in Attendance UI

In Module 1.3's `AttendanceTable.tsx` (admin), add:

- Late badge next to Morning column if `isMorningLate = true`
- Late badge next to Evening column if `isEveningLate = true`

In supervisor's `AttendanceMarking.tsx`, after a successful morning or evening submission, if the current time is outside the configured window show a warning toast: "Attendance marked outside the scheduled window — it will be flagged as late."

---

## Part C — Worker Table Default Filter Fix

### C1 — Fix Workers Table Default Status Filter

Update `src/app/admin/workers/WorkersTable.tsx`:

The TanStack Table filter for `status` should default to **all statuses** on page load, not pending-only.

Find the filter initialisation — it likely looks like:

```ts
// Wrong — defaults to pending only
const [statusFilter, setStatusFilter] = useState('pending')
```

Change to:

```ts
// Correct — defaults to all statuses
const [statusFilter, setStatusFilter] = useState('all')
```

Ensure the filter logic handles `'all'` correctly:

```ts
const filtered = useMemo(() => {
  if (statusFilter === 'all') return workers
  return workers.filter((w) => w.status === statusFilter)
}, [workers, statusFilter])
```

The "X Pending Approvals" count badge at the top of the page should remain — it's a separate computed value from the filter state, not dependent on the default filter.

---

## Module 1.3-pre Gate Checklist

Do not proceed to Module 1.3 until every item below passes.

```
[ ] pnpm drizzle-kit push runs without errors after all schema changes
[ ] pnpm tsc --noEmit — zero type errors

PART A — PROFILE MANAGEMENT

Own profile (admin + supervisor):
[ ] Settings page accessible from nav for both roles
[ ] Admin can update their own name and phone
[ ] Supervisor can update their own name and phone
[ ] Name change reflects immediately in the nav bar / dashboard greeting
[ ] Admin can change their own password — correct current password required
[ ] Supervisor can change their own password — correct current password required
[ ] Wrong current password shows inline error
[ ] New password too short (< 8 chars) shows inline validation error

Admin managing supervisors:
[ ] Edit Profile dialog pre-fills current supervisor data
[ ] Admin can update supervisor name, phone, salary, city, join date
[ ] Changes reflected immediately in supervisors table
[ ] Reset Password dialog shows supervisor name and warning text
[ ] Admin can reset supervisor password
[ ] After reset: supervisor's existing session is invalidated
[ ] After reset: supervisor can log in with new password
[ ] After reset: supervisor cannot log in with old password
[ ] Remove dialog requires typing supervisor name to enable Remove button
[ ] After removal: supervisor record gone from DB (check Neon console)
[ ] After removal: supervisor cannot log in
[ ] After removal: supervisor no longer appears in site assignment dropdowns

PART B — ATTENDANCE TIME WINDOWS

Site creation:
[ ] Morning and evening time window fields appear in Create Site dialog
[ ] Fields are optional — site can be created without time windows
[ ] Providing start without end (or vice versa) for a shift is rejected
[ ] Site created with time windows saves correct HH:MM values in DB

Site editing:
[ ] Edit Time Windows option appears in site Actions column
[ ] Admin can update time windows on existing sites
[ ] Clearing both fields removes the time restriction

Attendance marking:
[ ] Marking within the configured window — isMorningLate = false
[ ] Marking outside the configured window — isMorningLate = true
[ ] Site with no time window configured — isMorningLate always false
[ ] Late badge visible in admin attendance table for late marks
[ ] Supervisor sees warning toast when marking outside window

PART C — WORKER TABLE

[ ] Workers table defaults to showing ALL workers on page load
[ ] Status filter dropdown still works — can filter to pending / active / rejected
[ ] Pending approval count badge still shows correct number independently

QUALITY
[ ] pnpm tsc --noEmit — zero type errors
[ ] pnpm lint — zero lint errors
[ ] Git commit: "feat: module 1.3-pre profile management attendance windows worker fix"
```

---

*Next: Module 1.3 — Attendance*
