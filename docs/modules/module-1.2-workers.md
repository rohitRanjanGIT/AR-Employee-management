# Module 1.2 — Workers

## Objective
Admin and supervisor can create workers. Supervisor submissions sit as pending until admin approves or rejects. Aadhaar is encrypted at rest, masked in lists, admin-only reveal with full audit logging. Supervisor sees all workers in their assigned cities. Nothing outside this scope.

---

## Prerequisites
- Module 1.0 and 1.1 gate checklists fully passed
- Cities exist in the DB (at least one active city)
- Supervisor employee records exist (at least one supervisor created and assigned to a city)
- `AADHAAR_ENCRYPTION_KEY` set in `.env.local` as a 32-byte hex string

---

## Scope

**Admin can:**
- Create a worker directly → status immediately `active`
- View all workers across all cities
- View all pending submissions from supervisors
- Edit wage and OT rate on pending workers before approving
- Approve a pending worker → status becomes `active`
- Reject a pending worker with or without a reason → status becomes `rejected`
- Reveal full Aadhaar of any worker — every reveal is logged
- Reassign a worker to a different city

**Supervisor can:**
- Submit a worker draft → status `pending`, not active
- View all workers in their assigned cities (active workers only)
- View their own pending and rejected submissions
- Resubmit a rejected worker (updates the existing record, does not create a new one)
- Cannot reveal Aadhaar — masked last-4 only, always
- Cannot approve, reject, or edit wage rates

---

## Packages to Install

No new packages required. All dependencies installed in 1.0.

---

## Step 1 — Aadhaar Encryption Utilities

Create `src/lib/aadhaar.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.AADHAAR_ENCRYPTION_KEY!, 'hex') // 32 bytes

/**
 * Encrypts a 12-digit Aadhaar number.
 * Returns a colon-separated string: iv:authTag:encryptedData (all hex)
 */
export function encryptAadhaar(aadhaar: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(aadhaar, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

/**
 * Decrypts an encrypted Aadhaar string produced by encryptAadhaar.
 */
export function decryptAadhaar(encrypted: string): string {
  const [ivHex, authTagHex, dataHex] = encrypted.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

/**
 * Returns masked Aadhaar: XXXX-XXXX-{last4}
 */
export function maskAadhaar(lastFour: string): string {
  return `XXXX-XXXX-${lastFour}`
}

/**
 * Extracts last 4 digits from a raw 12-digit Aadhaar string.
 */
export function extractLastFour(aadhaar: string): string {
  return aadhaar.slice(-4)
}
```

> **Security rule:** `decryptAadhaar` must only ever be called inside the `revealAadhaar` server action. Never call it during list queries, table renders, or any path a supervisor could trigger. If in doubt, do not decrypt.

---

## Step 2 — Server Actions

Create `src/actions/workers.ts`:

```ts
'use server'

import { db } from '@/db'
import { workers, employees, cities, siteSupervisorAssignments } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq, and, inArray, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  encryptAadhaar,
  decryptAadhaar,
  maskAadhaar,
  extractLastFour,
} from '@/lib/aadhaar'

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

// ─── Get employee record for current user ─────────────────────────────────────

async function getCurrentEmployee(userId: string) {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.userId, userId),
  })
  if (!employee) throw new Error('Employee record not found')
  return employee
}

// ─── Worker validation schema ─────────────────────────────────────────────────

const workerSchema = z.object({
  cityId: z.string().uuid(),
  name: z.string().min(1).max(200),
  age: z.number().int().min(18).max(80).optional(),
  phone: z.string().max(15).optional(),
  address: z.string().max(500).optional(),
  joinDate: z.string().optional(), // ISO date string
  emergencyContact: z.string().max(200).optional(),
  category: z.enum(['skilled', 'semi_skilled', 'helper']),
  wageDaily: z.string().min(1), // stored as decimal string
  otRate: z.string().optional(),
  aadhaar: z.string().length(12).regex(/^\d{12}$/, 'Aadhaar must be 12 digits').optional(),
})

// ─── Create Worker (Admin) ────────────────────────────────────────────────────
// Admin-created workers are immediately active.

export async function createWorkerAsAdmin(input: z.infer<typeof workerSchema>) {
  const session = await requireAdmin()
  const data = workerSchema.parse(input)

  const city = await db.query.cities.findFirst({ where: eq(cities.id, data.cityId) })
  if (!city) throw new Error('City not found')
  if (city.status === 'inactive') throw new Error('Cannot assign worker to an inactive city')

  let aadhaarEncrypted: string | null = null
  let aadhaarLastFour: string | null = null

  if (data.aadhaar) {
    aadhaarEncrypted = encryptAadhaar(data.aadhaar)
    aadhaarLastFour = extractLastFour(data.aadhaar)
  }

  await db.insert(workers).values({
    cityId: data.cityId,
    submittedBy: null, // admin direct creation
    name: data.name,
    age: data.age ?? null,
    phone: data.phone ?? null,
    address: data.address ?? null,
    joinDate: data.joinDate ? new Date(data.joinDate) : null,
    emergencyContact: data.emergencyContact ?? null,
    category: data.category,
    wageDaily: data.wageDaily,
    otRate: data.otRate ?? null,
    aadhaarEncrypted,
    aadhaarLastFour,
    status: 'active',
    resubmitted: false,
  })

  revalidatePath('/admin/workers')
}

// ─── Submit Worker Draft (Supervisor) ────────────────────────────────────────
// Supervisor-created workers are pending until admin approves.

export async function submitWorkerAsSupervisor(input: z.infer<typeof workerSchema>) {
  const session = await requireAuth()
  if (session.user.role !== 'supervisor') throw new Error('Unauthorised')

  const data = workerSchema.parse(input)
  const employee = await getCurrentEmployee(session.user.id)

  // Supervisor can only submit workers for cities they have a site in
  const assignments = await db.query.siteSupervisorAssignments.findMany({
    where: eq(siteSupervisorAssignments.employeeId, employee.id),
    with: { site: { with: { city: true } } },
  })
  const assignedCityIds = [...new Set(assignments.map((a) => a.site.cityId))]
  if (!assignedCityIds.includes(data.cityId)) {
    throw new Error('You can only submit workers for cities where you have an assigned site')
  }

  let aadhaarEncrypted: string | null = null
  let aadhaarLastFour: string | null = null

  if (data.aadhaar) {
    aadhaarEncrypted = encryptAadhaar(data.aadhaar)
    aadhaarLastFour = extractLastFour(data.aadhaar)
  }

  await db.insert(workers).values({
    cityId: data.cityId,
    submittedBy: employee.id,
    name: data.name,
    age: data.age ?? null,
    phone: data.phone ?? null,
    address: data.address ?? null,
    joinDate: data.joinDate ? new Date(data.joinDate) : null,
    emergencyContact: data.emergencyContact ?? null,
    category: data.category,
    wageDaily: data.wageDaily,
    otRate: data.otRate ?? null,
    aadhaarEncrypted,
    aadhaarLastFour,
    status: 'pending',
    resubmitted: false,
  })

  revalidatePath('/supervisor/workers')
}

// ─── Get All Workers (Admin) ──────────────────────────────────────────────────
// Returns all workers. Aadhaar is masked — never decrypted here.

export async function getAllWorkers() {
  await requireAdmin()
  const rows = await db.query.workers.findMany({
    with: { city: true, submittedByEmployee: true },
    orderBy: (w, { desc }) => [desc(w.createdAt)],
  })
  return rows.map((w) => ({
    ...w,
    aadhaarEncrypted: undefined, // strip from response
    aadhaarDisplay: w.aadhaarLastFour ? maskAadhaar(w.aadhaarLastFour) : null,
  }))
}

// ─── Get Workers for Supervisor ───────────────────────────────────────────────
// Returns active workers in supervisor's cities + their own pending/rejected submissions.

export async function getWorkersForSupervisor() {
  const session = await requireAuth()
  if (session.user.role !== 'supervisor') throw new Error('Unauthorised')

  const employee = await getCurrentEmployee(session.user.id)

  const assignments = await db.query.siteSupervisorAssignments.findMany({
    where: eq(siteSupervisorAssignments.employeeId, employee.id),
    with: { site: true },
  })
  const assignedCityIds = [...new Set(assignments.map((a) => a.site.cityId))]

  if (assignedCityIds.length === 0) return []

  const rows = await db.query.workers.findMany({
    where: or(
      // Active workers in their cities
      and(
        inArray(workers.cityId, assignedCityIds),
        eq(workers.status, 'active')
      ),
      // Their own pending or rejected submissions
      and(
        eq(workers.submittedBy, employee.id),
        inArray(workers.status, ['pending', 'rejected'])
      )
    ),
    with: { city: true },
    orderBy: (w, { desc }) => [desc(w.createdAt)],
  })

  return rows.map((w) => ({
    ...w,
    aadhaarEncrypted: undefined,
    aadhaarDisplay: w.aadhaarLastFour ? maskAadhaar(w.aadhaarLastFour) : null,
  }))
}

// ─── Approve Worker ───────────────────────────────────────────────────────────

const approveWorkerSchema = z.object({
  workerId: z.string().uuid(),
  wageDaily: z.string().min(1),
  otRate: z.string().optional(),
})

export async function approveWorker(input: z.infer<typeof approveWorkerSchema>) {
  await requireAdmin()
  const data = approveWorkerSchema.parse(input)

  const worker = await db.query.workers.findFirst({
    where: eq(workers.id, data.workerId),
  })
  if (!worker) throw new Error('Worker not found')
  if (worker.status !== 'pending') throw new Error('Worker is not pending')

  await db
    .update(workers)
    .set({
      status: 'active',
      wageDaily: data.wageDaily,
      otRate: data.otRate ?? worker.otRate,
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(workers.id, data.workerId))

  revalidatePath('/admin/workers')
}

// ─── Reject Worker ────────────────────────────────────────────────────────────

const rejectWorkerSchema = z.object({
  workerId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

export async function rejectWorker(input: z.infer<typeof rejectWorkerSchema>) {
  await requireAdmin()
  const data = rejectWorkerSchema.parse(input)

  const worker = await db.query.workers.findFirst({
    where: eq(workers.id, data.workerId),
  })
  if (!worker) throw new Error('Worker not found')
  if (worker.status !== 'pending') throw new Error('Worker is not pending')

  await db
    .update(workers)
    .set({
      status: 'rejected',
      rejectionReason: data.reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(workers.id, data.workerId))

  revalidatePath('/admin/workers')
}

// ─── Resubmit Rejected Worker (Supervisor) ────────────────────────────────────
// Updates the existing record in place. Does not create a new record.

export async function resubmitWorker(
  workerId: string,
  input: z.infer<typeof workerSchema>
) {
  const session = await requireAuth()
  if (session.user.role !== 'supervisor') throw new Error('Unauthorised')

  const data = workerSchema.parse(input)
  const employee = await getCurrentEmployee(session.user.id)

  const worker = await db.query.workers.findFirst({
    where: and(
      eq(workers.id, workerId),
      eq(workers.submittedBy, employee.id)
    ),
  })
  if (!worker) throw new Error('Worker not found or not your submission')
  if (worker.status !== 'rejected') throw new Error('Only rejected workers can be resubmitted')

  let aadhaarEncrypted = worker.aadhaarEncrypted
  let aadhaarLastFour = worker.aadhaarLastFour

  if (data.aadhaar) {
    aadhaarEncrypted = encryptAadhaar(data.aadhaar)
    aadhaarLastFour = extractLastFour(data.aadhaar)
  }

  await db
    .update(workers)
    .set({
      cityId: data.cityId,
      name: data.name,
      age: data.age ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      joinDate: data.joinDate ? new Date(data.joinDate) : null,
      emergencyContact: data.emergencyContact ?? null,
      category: data.category,
      wageDaily: data.wageDaily,
      otRate: data.otRate ?? null,
      aadhaarEncrypted,
      aadhaarLastFour,
      status: 'pending',
      rejectionReason: null,
      resubmitted: true,
      updatedAt: new Date(),
    })
    .where(eq(workers.id, workerId))

  revalidatePath('/supervisor/workers')
}

// ─── Reveal Aadhaar (Admin Only) ──────────────────────────────────────────────
// Decrypts and returns full Aadhaar. Logs the reveal with who/when.

export async function revealAadhaar(workerId: string): Promise<string> {
  const session = await requireAdmin()

  const worker = await db.query.workers.findFirst({
    where: eq(workers.id, workerId),
  })
  if (!worker) throw new Error('Worker not found')
  if (!worker.aadhaarEncrypted) throw new Error('No Aadhaar on record')

  const decrypted = decryptAadhaar(worker.aadhaarEncrypted)

  // Append reveal log entry
  const existingLogs = (worker.aadhaarRevealLogs as any[]) ?? []
  const newLog = {
    revealedBy: session.user.id,
    revealedByName: session.user.name,
    revealedAt: new Date().toISOString(),
  }

  await db
    .update(workers)
    .set({
      aadhaarRevealLogs: [...existingLogs, newLog],
      updatedAt: new Date(),
    })
    .where(eq(workers.id, workerId))

  return decrypted
}

// ─── Reassign Worker City (Admin Only) ────────────────────────────────────────

export async function reassignWorkerCity(workerId: string, newCityId: string) {
  await requireAdmin()

  const city = await db.query.cities.findFirst({ where: eq(cities.id, newCityId) })
  if (!city) throw new Error('City not found')
  if (city.status === 'inactive') throw new Error('Cannot assign worker to an inactive city')

  await db
    .update(workers)
    .set({ cityId: newCityId, updatedAt: new Date() })
    .where(eq(workers.id, workerId))

  revalidatePath('/admin/workers')
}
```

---

## Step 3 — Drizzle Relations Update

Add the following to the relations block in `src/db/schema.ts`:

```ts
export const workersRelations = relations(workers, ({ one }) => ({
  city: one(cities, { fields: [workers.cityId], references: [cities.id] }),
  submittedByEmployee: one(employees, {
    fields: [workers.submittedBy],
    references: [employees.id],
  }),
}))
```

After adding, run:
```bash
pnpm drizzle-kit push
pnpm tsc --noEmit
```

---

## Step 4 — Admin Navigation Update

Add "Workers" to `src/components/AdminNav.tsx`:

- Workers → `/admin/workers`

---

## Step 5 — Admin: Workers Page

Create `src/app/admin/workers/` with the following structure:

```
src/app/admin/workers/
  page.tsx                   ← server component, fetches all workers + cities
  WorkersTable.tsx           ← TanStack Table, client component
  CreateWorkerDialog.tsx     ← admin direct create form
  ApproveWorkerDialog.tsx    ← edit rates + approve
  RejectWorkerDialog.tsx     ← reject with optional reason
  ReassignCityDialog.tsx     ← reassign worker to different city
  AadhaarRevealButton.tsx    ← reveal button + display
```

### `page.tsx` (server component)
- Session check: admin only
- Fetch all workers via `getAllWorkers()`
- Fetch all active cities for create + reassign dialogs
- Pass as props to `WorkersTable`

### `WorkersTable.tsx` (client component)
TanStack Table with columns:
- Name
- Category (badge: skilled / semi-skilled / helper)
- City
- Daily Wage
- OT Rate
- Aadhaar (masked display + reveal button — see `AadhaarRevealButton`)
- Status (badge: pending / active / rejected)
- Submitted By (employee name, or "Admin" if null)
- Actions (vary by status — see below)

**Filters:** by status, by city, by category

**Actions per status:**
- `pending` → Approve | Reject
- `active` → Reassign City
- `rejected` → (no actions — record is read-only for admin)

**Pending workers section:** Show a count badge "X Pending Approvals" at the top of the page. Default filter to show pending first.

### `CreateWorkerDialog.tsx`
Fields (all from worker schema):
- City (required) — Select, active cities only
- Name (required)
- Age
- Phone
- Address
- Join Date
- Emergency Contact
- Category (required) — Select: Skilled / Semi-Skilled / Helper
- Daily Wage (required)
- OT Rate
- Aadhaar (12-digit, optional) — input type text, not number (leading zeros)

On submit: call `createWorkerAsAdmin()`. Worker immediately active.

### `ApproveWorkerDialog.tsx`
- Shows worker name and current proposed rates
- Editable fields: Daily Wage, OT Rate (pre-filled with supervisor's proposed values)
- Admin can change rates before approving
- Submit button: "Approve Worker"
- On submit: call `approveWorker({ workerId, wageDaily, otRate })`

### `RejectWorkerDialog.tsx`
- Shows worker name
- Optional textarea: "Reason for rejection (visible to supervisor)"
- Submit button: "Reject" (destructive)
- On submit: call `rejectWorker({ workerId, reason })`

### `ReassignCityDialog.tsx`
- Shows worker name and current city
- Select: new city (active cities only, excluding current)
- On submit: call `reassignWorkerCity(workerId, newCityId)`

### `AadhaarRevealButton.tsx` (client component)
- Displays masked Aadhaar by default: `XXXX-XXXX-{last4}`
- "Reveal" button next to it
- On click: calls `revealAadhaar(workerId)` server action
- Replaces masked display with full 12-digit number for 30 seconds, then re-masks
- Shows a small tooltip: "This reveal is being logged"
- If no Aadhaar on record: show "Not provided" — no reveal button

---

## Step 6 — Supervisor Navigation Update

Add "Workers" to supervisor nav:

- Workers → `/supervisor/workers`

---

## Step 7 — Supervisor: Workers Page

Create `src/app/supervisor/workers/` with the following structure:

```
src/app/supervisor/workers/
  page.tsx                   ← server component
  WorkersList.tsx            ← client component, tabbed view
  SubmitWorkerDialog.tsx     ← new worker submission form
  ResubmitWorkerDialog.tsx   ← edit + resubmit rejected worker
```

### `page.tsx` (server component)
- Session check: supervisor only
- Fetch workers via `getWorkersForSupervisor()`
- Fetch assigned cities for the submission form city dropdown
- Pass as props to `WorkersList`

### `WorkersList.tsx` (client component)
Three tabs:
- **Active** — all active workers in supervisor's cities
- **My Submissions** — their own pending workers
- **Rejected** — their own rejected workers with rejection reason shown

Each tab renders a table (TanStack Table) with columns:
- Name, Category, City, Daily Wage, OT Rate, Aadhaar (masked only — no reveal button ever), Status

**My Submissions tab** — no actions, read only (admin is reviewing)

**Rejected tab** — "Resubmit" button per row → opens `ResubmitWorkerDialog`

"Add Worker" button in page header → opens `SubmitWorkerDialog`

### `SubmitWorkerDialog.tsx`
Same fields as `CreateWorkerDialog` in admin, with one difference:
- City dropdown only shows cities where supervisor has an assigned site
- On submit: call `submitWorkerAsSupervisor()`
- On success: show "Submitted for approval" — worker appears in My Submissions tab

### `ResubmitWorkerDialog.tsx`
- Pre-filled with current worker data
- All fields editable
- Aadhaar field: empty (supervisor re-enters if they want to update it; if left blank, existing encrypted value is preserved)
- On submit: call `resubmitWorker(workerId, input)`
- On success: worker moves back to My Submissions tab with status `pending`

---

## Step 8 — Supervisor Dashboard Update

Update `src/app/supervisor/dashboard/page.tsx`:

Add a second summary line: "X workers pending approval in your cities" — pulled from active city worker counts. Keep it brief, linked to `/supervisor/workers`.

---

## Key Logic Notes

**Aadhaar security — absolute rules:**
- `decryptAadhaar()` is called ONLY inside `revealAadhaar()` server action
- `aadhaarEncrypted` column is stripped from every query response before returning to the client (set to `undefined`)
- Supervisor routes never call `revealAadhaar()` — enforce this at the action level, not just the UI
- The 30-second auto-mask in `AadhaarRevealButton` is UX only — the decrypted value is never stored in component state beyond that render

**Worker resubmission — record identity:**
- Resubmitting updates the existing row in place (`resubmitted: true`, status back to `pending`)
- The `workers.id` stays the same — supervisor's submission history is preserved
- `rejectionReason` is cleared on resubmit

**Supervisor city scope:**
- A supervisor's city access is derived from their site assignments, not a direct city FK on the employee record
- `getWorkersForSupervisor()` computes assigned city IDs from `siteSupervisorAssignments → sites → cityId`
- If a supervisor is unassigned from all sites in a city, they lose visibility of that city's workers automatically

**Pending count badge:**
- Compute in `page.tsx` server component — `workers.filter(w => w.status === 'pending').length`
- Pass as prop to `WorkersTable` — no separate query needed

**Wage display:**
- Daily wage and OT rate are `decimal` columns in Postgres, returned as strings by Drizzle
- Format for display: `₹{amount}` — use `Number(wageDaily).toLocaleString('en-IN')` for Indian formatting

---

## Module 1.2 Gate Checklist

Do not proceed to Module 1.3 until every item below passes manual verification.

```
[ ] Relations updated in schema.ts and `pnpm tsc --noEmit` passes

ADMIN — CREATE WORKER
[ ] Admin can open Create Worker dialog
[ ] All fields render correctly
[ ] Aadhaar field accepts only 12-digit numeric input
[ ] Worker created by admin has status = 'active' immediately
[ ] Worker appears in the workers table with correct data
[ ] Worker created under inactive city is blocked with error

ADMIN — PENDING APPROVALS
[ ] Pending workers count badge shows correct number
[ ] Pending filter applied by default
[ ] Approve dialog shows supervisor's proposed wage and OT rate
[ ] Admin can edit wage and OT rate before approving
[ ] Approved worker status changes to 'active' in table
[ ] Rejected worker status changes to 'rejected' in table
[ ] Rejection reason is optional — works with and without
[ ] Rejected workers show rejection reason in the table row

ADMIN — AADHAAR
[ ] Masked Aadhaar shown as XXXX-XXXX-{last4} in table
[ ] Reveal button visible only on admin workers page
[ ] Clicking reveal calls server action and shows full 12 digits
[ ] After 30 seconds, Aadhaar re-masks automatically
[ ] Reveal is logged: check workers.aadhaar_reveal_logs in Neon console
[ ] Log entry contains: revealedBy, revealedByName, revealedAt
[ ] Worker with no Aadhaar shows "Not provided" — no reveal button
[ ] Supervisor cannot call revealAadhaar — action throws Unauthorised

ADMIN — REASSIGN CITY
[ ] Reassign dialog shows worker name and current city
[ ] New city dropdown excludes current city
[ ] Inactive cities not shown in dropdown
[ ] Worker city updates correctly after reassign

SUPERVISOR — SUBMIT WORKER
[ ] Supervisor can open Submit Worker dialog
[ ] City dropdown shows only cities with supervisor's assigned sites
[ ] Submitted worker appears in My Submissions tab with status 'pending'
[ ] Submitted worker does NOT appear in Active tab
[ ] Supervisor cannot submit worker for city they have no site in

SUPERVISOR — WORKER VISIBILITY
[ ] Active tab shows active workers from all supervisor's assigned cities
[ ] My Submissions tab shows only this supervisor's pending workers
[ ] Rejected tab shows only this supervisor's rejected workers with reason
[ ] Aadhaar shows as masked only — no reveal button anywhere in supervisor UI
[ ] Supervisor cannot see pending workers submitted by other supervisors

SUPERVISOR — RESUBMIT
[ ] Resubmit dialog pre-fills current worker data
[ ] Leaving Aadhaar blank preserves existing encrypted value
[ ] Entering new Aadhaar replaces encrypted value
[ ] After resubmit: status changes to 'pending', resubmitted flag = true
[ ] After resubmit: worker moves from Rejected tab to My Submissions tab
[ ] Rejection reason is cleared after resubmit

SUPERVISOR DASHBOARD
[ ] Dashboard shows correct pending count for supervisor's cities

QUALITY
[ ] `aadhaarEncrypted` never appears in any API response or client component
[ ] `pnpm tsc --noEmit` — zero type errors
[ ] `pnpm lint` — zero lint errors
[ ] Git commit: "feat: module 1.2 workers"
```

---

*Next: Module 1.3 — Attendance*
