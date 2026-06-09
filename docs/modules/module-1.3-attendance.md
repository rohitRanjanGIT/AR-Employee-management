# Module 1.3 — Attendance

## Objective
Supervisors can mark morning and evening attendance for workers at their assigned sites. Split shifts across two sites in the same city are handled naturally. Past-date edits follow a tiered approval flow. Admin has full visibility and control. Nothing outside this scope.

---

## Prerequisites
- Modules 1.0, 1.1, 1.1.5, and 1.2 gate checklists fully passed
- At least one active city, site, supervisor, and worker exist in the DB
- Supervisor is assigned to at least one site
- Workers are assigned to the same city as that site

---

## Scope

**Supervisor can:**
- Mark morning attendance for a site (their assigned sites only)
- Mark evening attendance for a site
- Edit yesterday's attendance — flagged as edited, no approval needed
- Submit an edit request for attendance 2+ days ago — pending admin approval
- See already-marked workers dimmed at the bottom of the marking list

**Admin can:**
- View all attendance across all sites
- Directly edit any attendance record without approval
- Review pending edit requests — approve or reject
- View attendance by site, date, worker, status

---

## Packages to Install

No new packages required.

---

## Step 1 — Schema Changes

### Add `attendance` table to `src/db/schema.ts`

Add the following enums first:

```ts
export const otEnum = pgEnum('ot_type', ['none', '2hr', '4hr'])
export const attendanceStatusEnum = pgEnum('attendance_status', ['full', 'half', 'absent'])
export const editRequestStatusEnum = pgEnum('edit_request_status', ['pending', 'approved', 'rejected'])
```

Add the attendance table:

```ts
export const attendance = pgTable(
  'attendance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.id),
    cityId: uuid('city_id')
      .notNull()
      .references(() => cities.id), // denormalized for fast rollups
    date: date('date').notNull(),   // 'YYYY-MM-DD' string in Drizzle

    // Morning mark
    morningMarkedAt: timestamp('morning_marked_at'),
    morningMarkedBy: uuid('morning_marked_by').references(() => employees.id),

    // Evening mark
    eveningMarkedAt: timestamp('evening_marked_at'),
    eveningMarkedBy: uuid('evening_marked_by').references(() => employees.id),

    // Overtime — only valid when both marks present
    ot: otEnum('ot').notNull().default('none'),

    // Rate snapshot — copied from worker at first mark time
    wageDailySnapshot: decimal('wage_daily_snapshot', { precision: 10, scale: 2 }).notNull(),
    otRateSnapshot: decimal('ot_rate_snapshot', { precision: 10, scale: 2 }),

    // Derived status — computed from marks, cached here
    // full = both marks, half = one mark, absent = no marks (no row)
    derivedStatus: attendanceStatusEnum('derived_status').notNull().default('half'),

    // Edit tracking
    isEdited: boolean('is_edited').notNull().default(false),
    editRequest: jsonb('edit_request'),         // pending edit payload
    editRequestStatus: editRequestStatusEnum('edit_request_status'),

    // Payroll lock — set to true when payroll is finalized for this site-month
    isLocked: boolean('is_locked').notNull().default(false),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // One row per worker per site per date
    workerSiteDateUnique: unique().on(table.workerId, table.siteId, table.date),
  })
)
```

### Add attendance relations to `src/db/schema.ts`

```ts
export const attendanceRelations = relations(attendance, ({ one }) => ({
  site: one(sites, { fields: [attendance.siteId], references: [sites.id] }),
  worker: one(workers, { fields: [attendance.workerId], references: [workers.id] }),
  city: one(cities, { fields: [attendance.cityId], references: [cities.id] }),
  morningMarkedByEmployee: one(employees, {
    fields: [attendance.morningMarkedBy],
    references: [employees.id],
    relationName: 'morningMarker',
  }),
  eveningMarkedByEmployee: one(employees, {
    fields: [attendance.eveningMarkedBy],
    references: [employees.id],
    relationName: 'eveningMarker',
  }),
}))
```

Also update `sitesRelations` to include attendance:

```ts
export const sitesRelations = relations(sites, ({ one, many }) => ({
  city: one(cities, { fields: [sites.cityId], references: [cities.id] }),
  siteWorkTypes: many(siteWorkTypes),
  siteSupervisorAssignments: many(siteSupervisorAssignments),
  siteSnapshots: many(siteSnapshots),
  attendance: many(attendance),   // ← add this
}))
```

After updating schema, run:
```bash
pnpm drizzle-kit push
pnpm tsc --noEmit
```

---

## Step 2 — Attendance Utilities

Create `src/lib/attendance.ts`:

```ts
import { differenceInCalendarDays, format } from 'date-fns'

/**
 * Returns today's date as a YYYY-MM-DD string (IST-aware).
 * Always use this function instead of new Date() for attendance dates.
 */
export function todayIST(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Classifies a date relative to today:
 * - 'today'     → same day marking, allowed freely
 * - 'yesterday' → 1 day back, allowed with edited flag
 * - 'edit_request' → 2-7 days back, requires admin approval
 * - 'too_old'   → 8+ days back, blocked entirely
 */
export type DateContext = 'today' | 'yesterday' | 'edit_request' | 'too_old'

export function classifyDate(dateStr: string): DateContext {
  const days = differenceInCalendarDays(new Date(), new Date(dateStr))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days >= 2 && days <= 7) return 'edit_request'
  return 'too_old'
}

/**
 * Computes derived attendance status from morning and evening marks.
 */
export function derivedStatus(
  morningMarkedAt: Date | null,
  eveningMarkedAt: Date | null
): 'full' | 'half' {
  if (morningMarkedAt && eveningMarkedAt) return 'full'
  return 'half'
}

/**
 * Computes wage earned for one attendance row.
 * Full day = wageDailySnapshot
 * Half day = wageDailySnapshot / 2
 * OT: 2hr = otRateSnapshot * 2, 4hr = otRateSnapshot * 4
 * OT only applies on full days.
 */
export function computeWageForRow({
  derivedStatus,
  wageDailySnapshot,
  otRateSnapshot,
  ot,
}: {
  derivedStatus: 'full' | 'half'
  wageDailySnapshot: number
  otRateSnapshot: number | null
  ot: 'none' | '2hr' | '4hr'
}): number {
  const base = derivedStatus === 'full' ? wageDailySnapshot : wageDailySnapshot / 2
  if (derivedStatus !== 'full' || ot === 'none' || !otRateSnapshot) return base
  const otHours = ot === '2hr' ? 2 : 4
  return base + otRateSnapshot * otHours
}
```

Install date-fns if not already present:
```bash
pnpm add date-fns
```

---

## Step 3 — Server Actions

Create `src/actions/attendance.ts`:

```ts
'use server'

import { db } from '@/db'
import {
  attendance,
  workers,
  employees,
  sites,
  siteSupervisorAssignments,
} from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq, and, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { todayIST, classifyDate, derivedStatus } from '@/lib/attendance'

// ─── Auth guards ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

async function requireSupervisor() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'supervisor') throw new Error('Unauthorised')
  return session
}

async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Unauthorised')
  return session
}

// ─── Get current employee record ──────────────────────────────────────────────

async function getCurrentEmployee(userId: string) {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.userId, userId),
  })
  if (!employee) throw new Error('Employee record not found')
  return employee
}

// ─── Get supervisor's assigned sites ─────────────────────────────────────────

async function getSupervisorSiteIds(employeeId: string): Promise<string[]> {
  const assignments = await db.query.siteSupervisorAssignments.findMany({
    where: eq(siteSupervisorAssignments.employeeId, employeeId),
  })
  return assignments.map((a) => a.siteId)
}

// ─── Get workers for attendance marking ───────────────────────────────────────
// Returns all active workers in a site's city.
// Also returns existing attendance rows for that site+date so UI can dim already-marked workers.

export async function getWorkersForAttendance(siteId: string, date: string) {
  const session = await requireAuth()
  const employee = await getCurrentEmployee(session.user.id)

  // Supervisor must be assigned to this site
  if (session.user.role === 'supervisor') {
    const siteIds = await getSupervisorSiteIds(employee.id)
    if (!siteIds.includes(siteId)) throw new Error('Not assigned to this site')
  }

  // Get the site to find its city
  const site = await db.query.sites.findFirst({
    where: eq(sites.id, siteId),
    with: { city: true },
  })
  if (!site) throw new Error('Site not found')
  if (site.status === 'inactive') throw new Error('Site is inactive')

  // Get all active workers in the city
  const cityWorkers = await db.query.workers.findMany({
    where: and(
      eq(workers.cityId, site.cityId),
      eq(workers.status, 'active')
    ),
  })

  // Get all attendance rows for this city on this date (across ALL sites in the city)
  // Used to determine which workers are already marked — shown dimmed in UI
  const allSitesInCity = await db.query.sites.findMany({
    where: eq(sites.cityId, site.cityId),
  })
  const allSiteIds = allSitesInCity.map((s) => s.id)

  const existingAttendance = await db.query.attendance.findMany({
    where: and(
      inArray(attendance.siteId, allSiteIds),
      eq(attendance.date, date)
    ),
  })

  // Get attendance specifically for THIS site+date (for pre-filling)
  const thisSiteAttendance = existingAttendance.filter((a) => a.siteId === siteId)

  return {
    site,
    workers: cityWorkers,
    thisSiteAttendance,    // existing rows for this site — used to pre-fill marks
    allCityAttendance: existingAttendance, // all city rows — used to dim already-marked workers
  }
}

// ─── Mark Morning Attendance ──────────────────────────────────────────────────

const markMorningSchema = z.object({
  siteId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  presentWorkerIds: z.array(z.string().uuid()),
})

export async function markMorningAttendance(input: z.infer<typeof markMorningSchema>) {
  const session = await requireSupervisor()
  const employee = await getCurrentEmployee(session.user.id)
  const data = markMorningSchema.parse(input)

  // Verify supervisor is assigned to this site
  const siteIds = await getSupervisorSiteIds(employee.id)
  if (!siteIds.includes(data.siteId)) throw new Error('Not assigned to this site')

  // Classify date
  const dateContext = classifyDate(data.date)
  if (dateContext === 'too_old') throw new Error('Date is too far in the past')
  if (dateContext === 'edit_request') {
    throw new Error('Use submitAttendanceEditRequest for dates older than 1 day')
  }

  // Get site for cityId
  const site = await db.query.sites.findFirst({ where: eq(sites.id, data.siteId) })
  if (!site) throw new Error('Site not found')

  // Check site is not locked for payroll
  const lockedCheck = await db.query.attendance.findFirst({
    where: and(
      eq(attendance.siteId, data.siteId),
      eq(attendance.isLocked, true),
      eq(attendance.date, data.date)
    ),
  })
  if (lockedCheck) throw new Error('Attendance is locked — payroll has been finalized')

  const now = new Date()

  for (const workerId of data.presentWorkerIds) {
    const worker = await db.query.workers.findFirst({
      where: eq(workers.id, workerId),
    })
    if (!worker || worker.status !== 'active') continue

    const existing = await db.query.attendance.findFirst({
      where: and(
        eq(attendance.workerId, workerId),
        eq(attendance.siteId, data.siteId),
        eq(attendance.date, data.date)
      ),
    })

    if (existing) {
      // Update existing row — add morning mark
      await db
        .update(attendance)
        .set({
          morningMarkedAt: now,
          morningMarkedBy: employee.id,
          derivedStatus: derivedStatus(now, existing.eveningMarkedAt),
          isEdited: dateContext === 'yesterday' ? true : existing.isEdited,
          updatedAt: now,
        })
        .where(eq(attendance.id, existing.id))
    } else {
      // Insert new row — morning only, snapshot rates from worker
      await db.insert(attendance).values({
        siteId: data.siteId,
        workerId,
        cityId: site.cityId,
        date: data.date,
        morningMarkedAt: now,
        morningMarkedBy: employee.id,
        wageDailySnapshot: worker.wageDaily,
        otRateSnapshot: worker.otRate ?? null,
        derivedStatus: 'half',
        isEdited: dateContext === 'yesterday',
      })
    }
  }

  revalidatePath('/supervisor/attendance')
  revalidatePath('/admin/attendance')
}

// ─── Mark Evening Attendance ──────────────────────────────────────────────────

const markEveningSchema = z.object({
  siteId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  presentWorkerIds: z.array(z.string().uuid()),
  otMap: z.record(z.string().uuid(), z.enum(['none', '2hr', '4hr'])).optional(),
})

export async function markEveningAttendance(input: z.infer<typeof markEveningSchema>) {
  const session = await requireSupervisor()
  const employee = await getCurrentEmployee(session.user.id)
  const data = markEveningSchema.parse(input)

  const siteIds = await getSupervisorSiteIds(employee.id)
  if (!siteIds.includes(data.siteId)) throw new Error('Not assigned to this site')

  const dateContext = classifyDate(data.date)
  if (dateContext === 'too_old') throw new Error('Date is too far in the past')
  if (dateContext === 'edit_request') {
    throw new Error('Use submitAttendanceEditRequest for dates older than 1 day')
  }

  const site = await db.query.sites.findFirst({ where: eq(sites.id, data.siteId) })
  if (!site) throw new Error('Site not found')

  const now = new Date()

  for (const workerId of data.presentWorkerIds) {
    const worker = await db.query.workers.findFirst({
      where: eq(workers.id, workerId),
    })
    if (!worker || worker.status !== 'active') continue

    const ot = data.otMap?.[workerId] ?? 'none'

    const existing = await db.query.attendance.findFirst({
      where: and(
        eq(attendance.workerId, workerId),
        eq(attendance.siteId, data.siteId),
        eq(attendance.date, data.date)
      ),
    })

    if (existing) {
      const status = derivedStatus(existing.morningMarkedAt, now)
      // OT only valid on full days
      const finalOt = status === 'full' ? ot : 'none'

      await db
        .update(attendance)
        .set({
          eveningMarkedAt: now,
          eveningMarkedBy: employee.id,
          ot: finalOt,
          derivedStatus: status,
          isEdited: dateContext === 'yesterday' ? true : existing.isEdited,
          updatedAt: now,
        })
        .where(eq(attendance.id, existing.id))
    } else {
      // Evening only — no morning mark for this site
      await db.insert(attendance).values({
        siteId: data.siteId,
        workerId,
        cityId: site.cityId,
        date: data.date,
        eveningMarkedAt: now,
        eveningMarkedBy: employee.id,
        wageDailySnapshot: worker.wageDaily,
        otRateSnapshot: worker.otRate ?? null,
        derivedStatus: 'half',
        isEdited: dateContext === 'yesterday',
      })
    }
  }

  revalidatePath('/supervisor/attendance')
  revalidatePath('/admin/attendance')
}

// ─── Submit Edit Request (2+ days back) ───────────────────────────────────────

const editRequestSchema = z.object({
  attendanceId: z.string().uuid(),
  proposedMorningPresent: z.boolean(),
  proposedEveningPresent: z.boolean(),
  proposedOt: z.enum(['none', '2hr', '4hr']),
  reason: z.string().min(1).max(500),
})

export async function submitAttendanceEditRequest(
  input: z.infer<typeof editRequestSchema>
) {
  const session = await requireSupervisor()
  const employee = await getCurrentEmployee(session.user.id)
  const data = editRequestSchema.parse(input)

  const row = await db.query.attendance.findFirst({
    where: eq(attendance.id, data.attendanceId),
  })
  if (!row) throw new Error('Attendance record not found')
  if (row.isLocked) throw new Error('Attendance is locked — payroll has been finalized')

  const dateContext = classifyDate(row.date)
  if (dateContext === 'today' || dateContext === 'yesterday') {
    throw new Error('Use direct edit for today or yesterday')
  }
  if (dateContext === 'too_old') throw new Error('Date is too far in the past to edit')

  // Verify supervisor is assigned to this site
  const siteIds = await getSupervisorSiteIds(employee.id)
  if (!siteIds.includes(row.siteId)) throw new Error('Not assigned to this site')

  if (row.editRequestStatus === 'pending') {
    throw new Error('An edit request is already pending for this record')
  }

  await db
    .update(attendance)
    .set({
      editRequest: {
        proposedMorningPresent: data.proposedMorningPresent,
        proposedEveningPresent: data.proposedEveningPresent,
        proposedOt: data.proposedOt,
        reason: data.reason,
        submittedBy: employee.id,
        submittedByName: employee.name,
        submittedAt: new Date().toISOString(),
      },
      editRequestStatus: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(attendance.id, data.attendanceId))

  revalidatePath('/admin/attendance')
}

// ─── Resolve Edit Request (Admin) ─────────────────────────────────────────────

export async function resolveAttendanceEditRequest(
  attendanceId: string,
  decision: 'approved' | 'rejected'
) {
  await requireAdmin()

  const row = await db.query.attendance.findFirst({
    where: eq(attendance.id, attendanceId),
  })
  if (!row) throw new Error('Attendance record not found')
  if (row.editRequestStatus !== 'pending') throw new Error('No pending edit request')

  const editRequest = row.editRequest as any

  if (decision === 'approved') {
    const now = new Date()
    const morningAt = editRequest.proposedMorningPresent ? now : null
    const eveningAt = editRequest.proposedEveningPresent ? now : null
    const status = derivedStatus(morningAt, eveningAt)
    const finalOt = status === 'full' ? editRequest.proposedOt : 'none'

    await db
      .update(attendance)
      .set({
        morningMarkedAt: morningAt,
        eveningMarkedAt: eveningAt,
        ot: finalOt,
        derivedStatus: status,
        editRequestStatus: 'approved',
        isEdited: true,
        updatedAt: now,
      })
      .where(eq(attendance.id, attendanceId))
  } else {
    await db
      .update(attendance)
      .set({
        editRequestStatus: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(attendance.id, attendanceId))
  }

  revalidatePath('/admin/attendance')
}

// ─── Admin Direct Edit ────────────────────────────────────────────────────────

const adminEditSchema = z.object({
  attendanceId: z.string().uuid(),
  morningPresent: z.boolean(),
  eveningPresent: z.boolean(),
  ot: z.enum(['none', '2hr', '4hr']),
})

export async function adminEditAttendance(input: z.infer<typeof adminEditSchema>) {
  await requireAdmin()
  const data = adminEditSchema.parse(input)

  const row = await db.query.attendance.findFirst({
    where: eq(attendance.id, data.attendanceId),
  })
  if (!row) throw new Error('Attendance record not found')
  if (row.isLocked) throw new Error('Attendance is locked — payroll has been finalized')

  const now = new Date()
  const morningAt = data.morningPresent ? (row.morningMarkedAt ?? now) : null
  const eveningAt = data.eveningPresent ? (row.eveningMarkedAt ?? now) : null
  const status = derivedStatus(morningAt, eveningAt)
  const finalOt = status === 'full' ? data.ot : 'none'

  await db
    .update(attendance)
    .set({
      morningMarkedAt: morningAt,
      eveningMarkedAt: eveningAt,
      ot: finalOt,
      derivedStatus: status,
      isEdited: true,
      updatedAt: now,
    })
    .where(eq(attendance.id, data.attendanceId))

  revalidatePath('/admin/attendance')
}

// ─── Get Attendance for Admin ─────────────────────────────────────────────────

export async function getAttendanceForAdmin(filters: {
  siteId?: string
  date?: string
  workerId?: string
}) {
  await requireAdmin()

  const conditions = []
  if (filters.siteId) conditions.push(eq(attendance.siteId, filters.siteId))
  if (filters.date) conditions.push(eq(attendance.date, filters.date))
  if (filters.workerId) conditions.push(eq(attendance.workerId, filters.workerId))

  return db.query.attendance.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      worker: true,
      site: { with: { city: true } },
      morningMarkedByEmployee: true,
      eveningMarkedByEmployee: true,
    },
    orderBy: (a, { desc }) => [desc(a.date)],
  })
}

// ─── Get Attendance for Supervisor ───────────────────────────────────────────

export async function getAttendanceForSupervisor(siteId: string, date: string) {
  const session = await requireSupervisor()
  const employee = await getCurrentEmployee(session.user.id)

  const siteIds = await getSupervisorSiteIds(employee.id)
  if (!siteIds.includes(siteId)) throw new Error('Not assigned to this site')

  return db.query.attendance.findMany({
    where: and(eq(attendance.siteId, siteId), eq(attendance.date, date)),
    with: { worker: true },
  })
}

// ─── Get Pending Edit Requests (Admin) ───────────────────────────────────────

export async function getPendingEditRequests() {
  await requireAdmin()

  return db.query.attendance.findMany({
    where: eq(attendance.editRequestStatus, 'pending'),
    with: {
      worker: true,
      site: { with: { city: true } },
    },
    orderBy: (a, { asc }) => [asc(a.date)],
  })
}
```

---

## Step 4 — Admin Navigation Update

Add "Attendance" to `src/components/AdminNav.tsx`:

- Dashboard → `/admin/dashboard`
- Cities → `/admin/cities`
- Sites → `/admin/sites`
- Supervisors → `/admin/supervisors`
- Workers → `/admin/workers`
- **Attendance → `/admin/attendance`** ← new
- Work Types → `/admin/work-types`

---

## Step 5 — Supervisor Navigation Update

Add "Attendance" to `src/components/SupervisorNav.tsx`:

- Dashboard → `/supervisor/dashboard`
- Sites → `/supervisor/sites`
- Workers → `/supervisor/workers`
- **Attendance → `/supervisor/attendance`** ← new

---

## Step 6 — Supervisor: Attendance Page

File structure:
```
src/app/supervisor/attendance/
  page.tsx                        ← server component, site selector
  [siteId]/page.tsx               ← server component, date selector + marking UI
  [siteId]/AttendanceMarking.tsx  ← client component, the main marking interface
```

### `page.tsx` — Site selector
- Session check: supervisor only
- Fetch supervisor's assigned sites via `getSupervisorSites()`
- Render a card grid of assigned sites
- Each card links to `/supervisor/attendance/{siteId}`
- Empty state: "You have no assigned sites."

### `[siteId]/page.tsx` — Date + marking
- Session check: supervisor only
- Accepts optional `?date=YYYY-MM-DD` query param — defaults to today
- Calls `getWorkersForAttendance(siteId, date)`
- Passes all data to `AttendanceMarking` client component

### `AttendanceMarking.tsx` — Client component

This is the core supervisor UI. Design for mobile-first — supervisors use phones on site.

**Header:**
- Site name + city
- Date display with prev/next arrows (limit to today and 1 day back for free edit; show warning for older dates)
- "Morning" / "Evening" tab toggle — determines which shift is being marked

**Worker list:**
Split into two visual sections:

1. **Unmarked workers** (top) — full opacity rows, checkbox to mark present
2. **Already marked workers** (bottom, dimmed) — greyed out, visually separated with a divider and label "Already marked today"

A worker is dimmed if they already have a mark for the selected shift in ANY site in the city on the selected date.

Each unmarked worker row shows:
- Worker name
- Category badge
- Checkbox: "Present"
- If Evening tab: OT selector (none / 2hr / 4hr) — shown only when worker is checked present AND morning mark exists (full day)

**Submit button:**
- "Mark Morning" or "Mark Evening" depending on active tab
- Shows count: "Marking X workers present"
- On submit: calls `markMorningAttendance()` or `markEveningAttendance()`
- On success: refresh page, show toast "Attendance marked"

**Edit request flow (2+ days back):**
- If date is classified as `edit_request`, show a banner: "Editing attendance for this date requires admin approval."
- Worker rows show current status (morning/evening marks)
- "Request Edit" button per row → opens a small dialog: proposed morning present (toggle), proposed evening present (toggle), proposed OT, reason (required)
- On submit: calls `submitAttendanceEditRequest()`
- Shows pending badge on that row after submission

---

## Step 7 — Admin: Attendance Page

File structure:
```
src/app/admin/attendance/
  page.tsx                     ← server component
  AttendanceClient.tsx         ← client component, tabbed view
  AttendanceTable.tsx          ← TanStack Table
  EditRequestsTable.tsx        ← pending edit requests table
  AdminEditDialog.tsx          ← direct edit form
```

### `page.tsx` (server component)
- Role check: admin only
- Fetch pending edit requests via `getPendingEditRequests()`
- Fetch all sites and workers for filter dropdowns
- Render `<AttendanceClient />`

### `AttendanceClient.tsx` (client component)
Two tabs:
- **Attendance Records** — full attendance table with filters
- **Edit Requests** — pending edit requests with approve/reject

### `AttendanceTable.tsx`
TanStack Table columns:
- Date
- Site
- City
- Worker Name
- Category
- Morning (✓ or —, with marked-by name on hover)
- Evening (✓ or —, with marked-by name on hover)
- OT
- Status badge (full / half)
- Edited badge (shown if `isEdited = true`)
- Locked badge (shown if `isLocked = true`)
- Actions: Edit (disabled if locked)

Filters: by site, by date range, by worker, by status, by edited flag

### `EditRequestsTable.tsx`
TanStack Table columns:
- Date
- Site
- Worker Name
- Current Status (morning/evening marks)
- Proposed Changes (morning present, evening present, OT)
- Reason
- Submitted By
- Submitted At
- Actions: Approve | Reject

On Approve: calls `resolveAttendanceEditRequest(id, 'approved')`
On Reject: calls `resolveAttendanceEditRequest(id, 'rejected')` — confirm dialog first

### `AdminEditDialog.tsx`
- Triggered from Actions column in AttendanceTable
- Shows worker name, site, date
- Toggle: Morning Present
- Toggle: Evening Present
- OT selector (shown only if both toggles on)
- On submit: calls `adminEditAttendance()`

---

## Step 8 — Admin Dashboard Update

Update `src/app/admin/dashboard/page.tsx`:

Add a summary card: "X pending attendance edit requests" — linked to `/admin/attendance?tab=edit-requests`.

---

## Key Logic Notes

**Rate snapshotting happens at INSERT, not update:**
`wageDailySnapshot` and `otRateSnapshot` are set only when creating a new attendance row. If a row already exists (e.g. morning was already marked and evening is being added), the snapshot values are NOT updated — they stay as they were at morning mark time. This is intentional: the rate for the day is locked at first mark.

**OT enforcement:**
OT is only stored when `derivedStatus === 'full'`. Any code path that sets OT must check this. If evening is removed from a full-day row (via admin edit), OT must be reset to `none`.

**Split shift dimming query:**
`getWorkersForAttendance` queries ALL sites in the city for the selected date to compute the dimmed list. This is intentional — a worker marked at Site A must appear dimmed at Site B. The `cityId` denormalization on the attendance row makes this query fast.

**Edit request JSONB structure:**
```ts
{
  proposedMorningPresent: boolean,
  proposedEveningPresent: boolean,
  proposedOt: 'none' | '2hr' | '4hr',
  reason: string,
  submittedBy: string,      // employee UUID
  submittedByName: string,
  submittedAt: string,      // ISO timestamp
}
```

**Locked rows:**
`isLocked` is set to `true` by the payroll finalization action in Module 1.4. Once locked, no action in this module can modify the row. All update paths check `isLocked` before proceeding.

**`date` column type:**
Drizzle's `date()` column returns a string in `'YYYY-MM-DD'` format when using `neon-http`. Always compare dates as strings, never cast to Date objects for equality checks.

---

## Module 1.3 Gate Checklist

Do not proceed to Module 1.4 until every item below passes.

```
[ ] Schema: attendance table created with all columns
[ ] Schema: unique constraint (worker_id, site_id, date) exists
[ ] pnpm drizzle-kit push runs without errors
[ ] All attendance relations added
[ ] pnpm tsc --noEmit — zero type errors

SUPERVISOR — SITE SELECTION
[ ] Supervisor sees only their assigned sites on /supervisor/attendance
[ ] Clicking a site opens the attendance marking screen

SUPERVISOR — MORNING MARKING
[ ] Worker list shows all active workers in the site's city
[ ] Supervisor can select present workers and submit morning attendance
[ ] Submitted rows appear in DB with morningMarkedAt set
[ ] wageDailySnapshot and otRateSnapshot copied from worker record
[ ] derivedStatus = 'half' after morning-only mark

SUPERVISOR — EVENING MARKING
[ ] Evening tab shows same worker list
[ ] OT selector appears only for workers who have a morning mark (full day)
[ ] Submitting evening marks updates existing rows
[ ] derivedStatus = 'full' when both marks present
[ ] OT value saved correctly on full-day rows
[ ] derivedStatus = 'half' when evening-only (no morning)

SPLIT SHIFT
[ ] Worker marked morning at Site A appears dimmed at Site B evening list
[ ] Supervisor at Site B can still mark evening for that worker
[ ] Two attendance rows exist for that worker on that date (different siteIds)
[ ] Each row has derivedStatus = 'half'

DIMMING BEHAVIOUR
[ ] Workers with morning mark already: dimmed in morning list of other supervisors in same city
[ ] Workers with evening mark already: dimmed in evening list of other supervisors in same city
[ ] Workers with both marks: dimmed in both lists
[ ] Dimmed workers appear at the bottom, separated by a divider

YESTERDAY EDIT
[ ] Supervisor can switch to yesterday's date
[ ] Editing yesterday's attendance updates isEdited = true on the row
[ ] Edited rows show an "Edited" badge in admin attendance table

EDIT REQUEST (2+ DAYS)
[ ] Trying to mark attendance for 2+ days ago shows "requires admin approval" banner
[ ] Supervisor can submit an edit request with reason
[ ] editRequest JSONB and editRequestStatus = 'pending' saved in DB
[ ] Row shows "Pending" badge after submission
[ ] Supervisor cannot submit a second request if one is already pending

ADMIN — ATTENDANCE TABLE
[ ] Admin can view all attendance records
[ ] Filters by site, date, worker, status all work
[ ] Edited badge visible on edited rows
[ ] Admin can open edit dialog on unlocked rows
[ ] Admin direct edit updates morning/evening marks and recomputes derivedStatus
[ ] OT resets to 'none' if admin removes evening mark from a full-day row

ADMIN — EDIT REQUESTS
[ ] Pending edit requests appear in Edit Requests tab
[ ] Count badge on admin dashboard shows correct number
[ ] Admin can approve an edit request → attendance row updated, status = approved
[ ] Admin can reject an edit request → status = rejected, row unchanged
[ ] Approved/rejected requests no longer appear in pending list

EDGE CASES
[ ] Marking attendance for an inactive site is blocked
[ ] Marking attendance for a date classified as too_old is blocked
[ ] Locked rows cannot be edited by supervisor or admin
[ ] OT not saved on half-day rows

QUALITY
[ ] pnpm tsc --noEmit — zero type errors
[ ] pnpm lint — zero lint errors
[ ] Git commit: "feat: module 1.3 attendance"
```

---

*Next: Module 1.4 — Wages & Payroll*
