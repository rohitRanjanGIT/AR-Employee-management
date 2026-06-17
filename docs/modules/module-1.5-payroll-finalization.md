# Module 1.5 — Payroll Finalization

## Objective
Admin can finalize payroll for a site-month: review the full breakdown, edit attendance or apply per-worker adjustments, then confirm. Finalization locks attendance and writes immutable snapshots + ledger entries. Already-finalized months can receive corrections via a separate additive mechanism. Nothing outside this scope.

---

## Prerequisites
- Modules 1.0 through 1.4 gate checklists fully passed
- At least one site has a full month of attendance data for testing finalization

---

## Scope

**Admin can:**
- View a pre-finalization review for any "Not Finalized" past month at a site
- Edit attendance for that month from within the review (jumps to 1.3 admin edit)
- Apply a per-worker wage adjustment (amount + reason) before finalizing
- Confirm finalization — locks attendance, writes snapshots, writes ledger entries
- View a read-only locked snapshot for any "Finalized" month
- Add a correction to an already-finalized month — worker + amount + reason
- See a soft warning if finalizing a month while an earlier month is unfinalized

**Supervisor cannot:**
- Access any part of this module — admin only

---

## Packages to Install

No new packages required.

---

## Step 1 — Schema Changes

### Add `payroll_snapshots` table to `src/db/schema.ts`

```ts
export const payrollSnapshots = pgTable(
  'payroll_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.id),
    yearMonth: text('year_month').notNull(), // 'YYYY-MM'

    // Context snapshots — captured at finalization time, immutable after
    siteSnapshot: jsonb('site_snapshot').notNull(),     // { name, code, cityName, stateName }
    workerSnapshot: jsonb('worker_snapshot').notNull(), // { name, category, cityName }

    // Attendance aggregates for this site-worker-month
    fullDays: integer('full_days').notNull().default(0),
    halfDays: integer('half_days').notNull().default(0),
    otTwoHrCount: integer('ot_two_hr_count').notNull().default(0),
    otFourHrCount: integer('ot_four_hr_count').notNull().default(0),

    // Wage breakdown
    grossWage: decimal('gross_wage', { precision: 12, scale: 2 }).notNull(),
    adjustmentAmount: decimal('adjustment_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    adjustmentReason: text('adjustment_reason'),
    finalWage: decimal('final_wage', { precision: 12, scale: 2 }).notNull(),

    // Correction chain
    isCorrection: boolean('is_correction').notNull().default(false),
    correctionOf: uuid('correction_of'), // self-reference, FK added below

    // Audit
    hadPreFinalizationEdits: boolean('had_pre_finalization_edits').notNull().default(false),
    finalizedBy: text('finalized_by')
      .notNull()
      .references(() => users.id),
    finalizedAt: timestamp('finalized_at').notNull().defaultNow(),
  },
  (table) => ({
    // Only one "original" (non-correction) snapshot per site-worker-month
    originalUnique: uniqueIndex('payroll_snapshots_original_unique')
      .on(table.siteId, table.workerId, table.yearMonth)
      .where(sql`${table.isCorrection} = false`),
    correctionOfFk: foreignKey({
      columns: [table.correctionOf],
      foreignColumns: [table.id],
    }),
  })
)
```

> **Note on partial unique index:** Drizzle's `uniqueIndex().where()` syntax requires the `sql` helper from `drizzle-orm`. Ensure `import { sql } from 'drizzle-orm'` is present at the top of `schema.ts`. If the partial index syntax is not supported by the installed Drizzle version, fall back to enforcing this uniqueness in application code inside the `finalizePayroll` action (check for existing non-correction snapshot before insert) and add a regular non-unique index instead for query performance.

### Add `transactions` table to `src/db/schema.ts`

```ts
export const transactionTypeEnum = pgEnum('transaction_type', [
  'payroll_worker',
  'payroll_correction',
  // 'advance' and 'site_expense' reserved for future modules
])

export const transactionDirectionEnum = pgEnum('transaction_direction', ['debit', 'credit'])

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: transactionTypeEnum('type').notNull(),
  referenceId: uuid('reference_id').notNull(), // points to payroll_snapshots.id
  workerId: uuid('worker_id').references(() => workers.id),
  siteId: uuid('site_id')
    .notNull()
    .references(() => sites.id),
  cityId: uuid('city_id')
    .notNull()
    .references(() => cities.id), // denormalized for fast rollups
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(), // always positive
  direction: transactionDirectionEnum('direction').notNull(),
  description: text('description').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

### Add relations

```ts
export const payrollSnapshotsRelations = relations(payrollSnapshots, ({ one, many }) => ({
  site: one(sites, { fields: [payrollSnapshots.siteId], references: [sites.id] }),
  worker: one(workers, { fields: [payrollSnapshots.workerId], references: [workers.id] }),
  finalizedByUser: one(users, { fields: [payrollSnapshots.finalizedBy], references: [users.id] }),
  parent: one(payrollSnapshots, {
    fields: [payrollSnapshots.correctionOf],
    references: [payrollSnapshots.id],
    relationName: 'corrections',
  }),
  corrections: many(payrollSnapshots, { relationName: 'corrections' }),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  site: one(sites, { fields: [transactions.siteId], references: [sites.id] }),
  worker: one(workers, { fields: [transactions.workerId], references: [workers.id] }),
  city: one(cities, { fields: [transactions.cityId], references: [cities.id] }),
  createdByUser: one(users, { fields: [transactions.createdBy], references: [users.id] }),
}))
```

After all schema changes, run:
```bash
pnpm drizzle-kit push
pnpm tsc --noEmit
```

---

## Step 2 — Server Actions

Create `src/actions/payroll-finalization.ts`:

```ts
'use server'

import { db } from '@/db'
import {
  attendance,
  payrollSnapshots,
  transactions,
  workers,
  sites,
  cities,
} from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq, and, gte, lte, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { computeRowWage, getMonthBounds, toYearMonth } from '@/lib/payroll'

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

// ─── Check if a site-month is already finalized ──────────────────────────────

export async function isMonthFinalized(siteId: string, yearMonth: string): Promise<boolean> {
  await requireAdmin()

  const existing = await db.query.payrollSnapshots.findFirst({
    where: and(
      eq(payrollSnapshots.siteId, siteId),
      eq(payrollSnapshots.yearMonth, yearMonth),
      eq(payrollSnapshots.isCorrection, false)
    ),
  })
  return !!existing
}

// ─── Check earlier months for soft warning ────────────────────────────────────

export async function getUnfinalizedEarlierMonths(
  siteId: string,
  yearMonth: string
): Promise<string[]> {
  await requireAdmin()

  // Get all months with attendance for this site, earlier than yearMonth
  const rows = await db.query.attendance.findMany({
    where: eq(attendance.siteId, siteId),
  })

  const monthsWithData = new Set(
    rows.map((r) => toYearMonth(r.date)).filter((ym) => ym < yearMonth)
  )

  const finalized = await db.query.payrollSnapshots.findMany({
    where: and(
      eq(payrollSnapshots.siteId, siteId),
      eq(payrollSnapshots.isCorrection, false)
    ),
  })
  const finalizedMonths = new Set(finalized.map((f) => f.yearMonth))

  return Array.from(monthsWithData)
    .filter((ym) => !finalizedMonths.has(ym))
    .sort()
}

// ─── Get finalization preview ─────────────────────────────────────────────────
// Returns the same shape as 1.4's site overview, scoped to one month,
// plus per-worker adjustment fields (defaulted to 0/empty).

export async function getFinalizationPreview(siteId: string, yearMonth: string) {
  await requireAdmin()

  if (await isMonthFinalized(siteId, yearMonth)) {
    throw new Error('This month is already finalized. View the locked snapshot instead.')
  }

  const [year, month] = yearMonth.split('-').map(Number)
  const { start, end } = getMonthBounds(year, month)

  const rows = await db.query.attendance.findMany({
    where: and(
      eq(attendance.siteId, siteId),
      gte(attendance.date, start),
      lte(attendance.date, end)
    ),
    with: { worker: true, site: { with: { city: { with: { state: true } } } } },
  })

  if (rows.length === 0) {
    throw new Error('No attendance data for this site in this month')
  }

  const site = rows[0].site

  // Group by worker
  const workerGroups: Record<string, typeof rows> = {}
  for (const row of rows) {
    if (!workerGroups[row.workerId]) workerGroups[row.workerId] = []
    workerGroups[row.workerId].push(row)
  }

  const workerBreakdowns = Object.entries(workerGroups).map(([workerId, workerRows]) => {
    let fullDays = 0
    let halfDays = 0
    let otTwoHrCount = 0
    let otFourHrCount = 0
    let grossWage = 0
    let hasEditedRows = false

    for (const row of workerRows) {
      const wage = computeRowWage({
        derivedStatus: row.derivedStatus as 'full' | 'half',
        wageDailySnapshot: Number(row.wageDailySnapshot),
        otRateSnapshot: row.otRateSnapshot ? Number(row.otRateSnapshot) : null,
        ot: row.ot as 'none' | '2hr' | '4hr',
      })
      grossWage += wage
      if (row.derivedStatus === 'full') fullDays++
      else halfDays++
      if (row.ot === '2hr') otTwoHrCount++
      if (row.ot === '4hr') otFourHrCount++
      if (row.isEdited) hasEditedRows = true
    }

    return {
      workerId,
      workerName: workerRows[0].worker.name,
      workerCategory: workerRows[0].worker.category,
      fullDays,
      halfDays,
      otTwoHrCount,
      otFourHrCount,
      grossWage,
      hasEditedRows,
      // Adjustment fields — admin fills these in on the review page
      adjustmentAmount: 0,
      adjustmentReason: '',
    }
  })

  return {
    siteId,
    siteName: site.name,
    siteCode: site.code,
    cityId: site.cityId,
    cityName: site.city.name,
    stateName: site.city.state?.name ?? '—',
    yearMonth,
    workers: workerBreakdowns,
    totalGrossWage: workerBreakdowns.reduce((s, w) => s + w.grossWage, 0),
  }
}

// ─── Finalize Payroll ──────────────────────────────────────────────────────────

const finalizePayrollSchema = z.object({
  siteId: z.string().uuid(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  adjustments: z.array(
    z.object({
      workerId: z.string().uuid(),
      adjustmentAmount: z.number(),
      adjustmentReason: z.string().optional(),
    })
  ),
})

export async function finalizePayroll(input: z.infer<typeof finalizePayrollSchema>) {
  const session = await requireAdmin()
  const data = finalizePayrollSchema.parse(input)

  if (await isMonthFinalized(data.siteId, data.yearMonth)) {
    throw new Error('This month is already finalized')
  }

  // Recompute the breakdown server-side — never trust client-sent totals
  const preview = await getFinalizationPreview(data.siteId, data.yearMonth)

  const [year, month] = data.yearMonth.split('-').map(Number)
  const { start, end } = getMonthBounds(year, month)

  const adjustmentMap = new Map(
    data.adjustments.map((a) => [a.workerId, a])
  )

  const now = new Date()

  for (const workerBreakdown of preview.workers) {
    const adjustment = adjustmentMap.get(workerBreakdown.workerId)
    const adjustmentAmount = adjustment?.adjustmentAmount ?? 0
    const adjustmentReason = adjustment?.adjustmentReason || null

    if (adjustmentAmount !== 0 && !adjustmentReason) {
      throw new Error(
        `Adjustment reason required for worker ${workerBreakdown.workerName}`
      )
    }

    const finalWage = workerBreakdown.grossWage + adjustmentAmount

    const worker = await db.query.workers.findFirst({
      where: eq(workers.id, workerBreakdown.workerId),
    })

    // Insert snapshot
    const [snapshot] = await db
      .insert(payrollSnapshots)
      .values({
        siteId: data.siteId,
        workerId: workerBreakdown.workerId,
        yearMonth: data.yearMonth,
        siteSnapshot: {
          name: preview.siteName,
          code: preview.siteCode,
          cityName: preview.cityName,
          stateName: preview.stateName,
        },
        workerSnapshot: {
          name: workerBreakdown.workerName,
          category: workerBreakdown.workerCategory,
          cityName: worker?.cityId ? preview.cityName : '—',
        },
        fullDays: workerBreakdown.fullDays,
        halfDays: workerBreakdown.halfDays,
        otTwoHrCount: workerBreakdown.otTwoHrCount,
        otFourHrCount: workerBreakdown.otFourHrCount,
        grossWage: workerBreakdown.grossWage.toFixed(2),
        adjustmentAmount: adjustmentAmount.toFixed(2),
        adjustmentReason,
        finalWage: finalWage.toFixed(2),
        isCorrection: false,
        hadPreFinalizationEdits: workerBreakdown.hasEditedRows,
        finalizedBy: session.user.id,
      })
      .returning()

    // Write ledger transaction
    await db.insert(transactions).values({
      type: 'payroll_worker',
      referenceId: snapshot.id,
      workerId: workerBreakdown.workerId,
      siteId: data.siteId,
      cityId: preview.cityId,
      amount: Math.abs(finalWage).toFixed(2),
      direction: finalWage >= 0 ? 'debit' : 'credit',
      description: `Payroll for ${workerBreakdown.workerName} — ${data.yearMonth} at ${preview.siteCode}`,
      createdBy: session.user.id,
    })
  }

  // Lock all attendance rows for this site-month
  await db
    .update(attendance)
    .set({ isLocked: true })
    .where(
      and(
        eq(attendance.siteId, data.siteId),
        gte(attendance.date, start),
        lte(attendance.date, end)
      )
    )

  revalidatePath(`/admin/payroll/sites/${data.siteId}`)
  revalidatePath('/admin/payroll')
}

// ─── Get Finalized Snapshot (read-only view) ──────────────────────────────────

export async function getFinalizedSnapshot(siteId: string, yearMonth: string) {
  await requireAdmin()

  const originals = await db.query.payrollSnapshots.findMany({
    where: and(
      eq(payrollSnapshots.siteId, siteId),
      eq(payrollSnapshots.yearMonth, yearMonth),
      eq(payrollSnapshots.isCorrection, false)
    ),
    with: { worker: true, finalizedByUser: true },
  })

  if (originals.length === 0) return null

  // For each original, fetch its corrections
  const withCorrections = await Promise.all(
    originals.map(async (snap) => {
      const corrections = await db.query.payrollSnapshots.findMany({
        where: and(
          eq(payrollSnapshots.correctionOf, snap.id),
          eq(payrollSnapshots.isCorrection, true)
        ),
        with: { finalizedByUser: true },
        orderBy: (s, { asc }) => [asc(s.finalizedAt)],
      })

      const correctionsTotal = corrections.reduce(
        (sum, c) => sum + Number(c.finalWage),
        0
      )

      return {
        ...snap,
        corrections,
        currentTotal: Number(snap.finalWage) + correctionsTotal,
      }
    })
  )

  return {
    siteId,
    yearMonth,
    finalizedAt: originals[0].finalizedAt,
    finalizedBy: originals[0].finalizedByUser?.name ?? 'Unknown',
    siteSnapshot: originals[0].siteSnapshot,
    workers: withCorrections,
    grandTotal: withCorrections.reduce((sum, w) => sum + w.currentTotal, 0),
  }
}

// ─── Add Correction ─────────────────────────────────────────────────────────

const addCorrectionSchema = z.object({
  siteId: z.string().uuid(),
  workerId: z.string().uuid(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().refine((v) => v !== 0, 'Amount cannot be zero'),
  reason: z.string().min(1).max(500),
})

export async function addPayrollCorrection(input: z.infer<typeof addCorrectionSchema>) {
  const session = await requireAdmin()
  const data = addCorrectionSchema.parse(input)

  // Find the original snapshot
  const original = await db.query.payrollSnapshots.findFirst({
    where: and(
      eq(payrollSnapshots.siteId, data.siteId),
      eq(payrollSnapshots.workerId, data.workerId),
      eq(payrollSnapshots.yearMonth, data.yearMonth),
      eq(payrollSnapshots.isCorrection, false)
    ),
    with: { worker: true, site: { with: { city: true } } },
  })

  if (!original) {
    throw new Error('No finalized payroll found for this worker in this site-month')
  }

  // Insert correction snapshot
  const [correction] = await db
    .insert(payrollSnapshots)
    .values({
      siteId: data.siteId,
      workerId: data.workerId,
      yearMonth: data.yearMonth,
      siteSnapshot: original.siteSnapshot,
      workerSnapshot: original.workerSnapshot,
      fullDays: 0,
      halfDays: 0,
      otTwoHrCount: 0,
      otFourHrCount: 0,
      grossWage: '0',
      adjustmentAmount: data.amount.toFixed(2),
      adjustmentReason: data.reason,
      finalWage: data.amount.toFixed(2),
      isCorrection: true,
      correctionOf: original.id,
      hadPreFinalizationEdits: false,
      finalizedBy: session.user.id,
    })
    .returning()

  // Write ledger transaction
  await db.insert(transactions).values({
    type: 'payroll_correction',
    referenceId: correction.id,
    workerId: data.workerId,
    siteId: data.siteId,
    cityId: original.site.cityId,
    amount: Math.abs(data.amount).toFixed(2),
    direction: data.amount >= 0 ? 'debit' : 'credit',
    description: `Correction for ${original.worker.name} — ${data.yearMonth}: ${data.reason}`,
    createdBy: session.user.id,
  })

  revalidatePath(`/admin/payroll/sites/${data.siteId}`)
  revalidatePath(`/admin/payroll/workers/${data.workerId}`)
}

// ─── Get all finalized months for a site (for the overview page) ─────────────

export async function getFinalizedMonthsForSite(siteId: string): Promise<string[]> {
  await requireAdmin()

  const rows = await db.query.payrollSnapshots.findMany({
    where: and(
      eq(payrollSnapshots.siteId, siteId),
      eq(payrollSnapshots.isCorrection, false)
    ),
  })

  return Array.from(new Set(rows.map((r) => r.yearMonth)))
}
```

---

## Step 3 — Update 1.4's Site Overview Page

Update `src/app/admin/payroll/sites/[siteId]/page.tsx`:

- Call `getFinalizedMonthsForSite(siteId)` alongside the existing `getSitePayrollOverview()` call
- Pass the finalized months list to `SitePayrollOverview`

Update `SitePayrollOverview.tsx`:

- For each month row, check if it's in the finalized months list
- **If finalized:** show green "Finalized" badge instead of "Not Finalized". Clicking the row navigates to a read-only snapshot view (not the live computation)
- **If current month:** "In Progress" badge, no finalize button
- **If not finalized and not current month:** "Not Finalized" badge + "Finalize Payroll" button → navigates to `/admin/payroll/sites/{siteId}/finalize/{yearMonth}`

---

## Step 4 — Finalization Review Page

File structure:
```
src/app/admin/payroll/sites/[siteId]/finalize/[yearMonth]/
  page.tsx                    ← server component
  FinalizationReview.tsx      ← client component
```

### `page.tsx` (server component)
- Role check: admin only
- Call `isMonthFinalized()` — if true, redirect to the snapshot view instead
- Call `getFinalizationPreview(siteId, yearMonth)`
- Call `getUnfinalizedEarlierMonths(siteId, yearMonth)`
- Render `<FinalizationReview />`

### `FinalizationReview.tsx` (client component)

**Header:**
- Site name, code, city, state
- Month label (e.g. "June 2026")
- Back link → `/admin/payroll/sites/{siteId}`

**Soft warning banner** (if earlier unfinalized months exist):
- "The following months for this site have not been finalized yet: {list}. You can still proceed."
- Dismissible, non-blocking

**Worker breakdown table:**

| Worker | Category | Full Days | Half Days | OT 2hr | OT 4hr | Gross Wage | Edited? | Adjustment | Reason | Final Wage |
|---|---|---|---|---|---|---|---|---|---|---|
| Ramesh Kumar | Skilled | 20 | 2 | 3 | 1 | ₹14,500 | — | [+/- input] | [text input] | ₹14,500 (live) |

- "Edited?" column shows a small badge if `hasEditedRows = true` for that worker — links to `/admin/attendance?siteId={siteId}&workerId={workerId}&month={yearMonth}` for review
- Adjustment column: numeric input, can be negative, defaults to 0
- Reason column: text input, required only if adjustment ≠ 0, disabled if adjustment = 0
- Final Wage column: live-computed as `grossWage + adjustment`, updates as admin types

**Summary footer (sticky):**
- "Total Gross: ₹X | Total Adjustments: ₹Y | Total Final: ₹Z"
- "Confirm Finalization" button (destructive style — orange/red)

**Confirmation dialog on button click:**
- "You are about to finalize payroll for {site name} — {month}. This will lock all attendance records for this period and cannot be undone except via corrections. Total payout: ₹Z across {n} workers."
- Two buttons: Cancel | Confirm & Finalize
- On confirm: calls `finalizePayroll()` with the full adjustments array
- On success: redirect to `/admin/payroll/sites/{siteId}` — month now shows "Finalized"

---

## Step 5 — Finalized Snapshot View Page

File structure:
```
src/app/admin/payroll/sites/[siteId]/snapshot/[yearMonth]/
  page.tsx                  ← server component
  FinalizedSnapshotView.tsx ← client component
```

### `page.tsx` (server component)
- Role check: admin only
- Call `getFinalizedSnapshot(siteId, yearMonth)` — 404 if null
- Render `<FinalizedSnapshotView />`

### `FinalizedSnapshotView.tsx` (client component)

**Header:**
- Site name, code, city, state (from `siteSnapshot` — historical, not live)
- Month label
- "Finalized by {name} on {date}"
- Back link → `/admin/payroll/sites/{siteId}`
- Green "Finalized" badge

**Worker breakdown table (read-only):**

| Worker | Category | Full Days | Half Days | OT 2hr | OT 4hr | Gross | Adjustment | Final | Corrections | Current Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Ramesh Kumar | Skilled | 20 | 2 | 3 | 1 | ₹14,500 | ₹0 | ₹14,500 | — | ₹14,500 |
| Suresh Yadav | Helper | 18 | 4 | 0 | 0 | ₹9,000 | -₹500 (Tool damage) | ₹8,500 | +₹200 (Bonus, 2026-07-03) | ₹8,700 |

- "Corrections" column shows each correction as a chip: amount + reason + date, hover for full details
- "Current Total" = `finalWage` + sum of all correction `finalWage`s
- "Add Correction" button per row → opens `AddCorrectionDialog`

**Grand total footer:**
- "Grand Total (current): ₹X"

---

## Step 6 — Add Correction Dialog

Create `src/components/AddCorrectionDialog.tsx` — shared component used on both the snapshot view and the worker earnings page.

Fields:
- Worker (pre-filled, read-only if opened from snapshot view; selectable if opened from worker earnings page with multiple finalized sites)
- Site + Month (pre-filled, read-only)
- Amount — numeric, can be negative, helper text: "Positive adds to payout, negative deducts"
- Reason — required textarea

On submit: calls `addPayrollCorrection()`
On success: close dialog, `router.refresh()` — new correction appears in the Corrections column

---

## Step 7 — Worker Earnings Page Update

Update `src/app/admin/payroll/workers/[workerId]/WorkerEarningsOverview.tsx`:

For each site-month in the worker's history:
- If finalized: show "Finalized" badge + "Add Correction" button → opens `AddCorrectionDialog` pre-filled with that site/worker/month
- If not finalized: show "Not Finalized" badge as before (from 1.4)
- Finalized months show `currentTotal` (final + corrections) instead of live-computed total — fetch via `getFinalizedSnapshot` per site-month as needed, or extend `getWorkerLifetimeEarnings` to check finalization status

> **Implementation note:** Extending `getWorkerLifetimeEarnings` to merge in snapshot data for finalized months is preferred over N+1 calls to `getFinalizedSnapshot`. Add a single query for all `payrollSnapshots` matching the worker's `(siteId, yearMonth)` combinations found in their attendance history, and use snapshot `finalWage` + corrections instead of live computation wherever a snapshot exists.

---

## Key Logic Notes

**Server-side recomputation on finalize:**
`finalizePayroll` calls `getFinalizationPreview` internally and recomputes everything from attendance — it never trusts gross wage values sent from the client. Only the `adjustments` array (workerId + amount + reason) is client input. This prevents tampering with the gross calculation.

**Adjustment reason enforcement:**
If `adjustmentAmount !== 0`, `adjustmentReason` is required — enforced both client-side (disabled Confirm button) and server-side (throws error).

**Partial unique index fallback:**
If `uniqueIndex().where()` isn't supported by the Drizzle version installed, `finalizePayroll` must check for an existing non-correction snapshot before inserting, inside the same logical operation. Since Neon HTTP driver doesn't support transactions in the traditional sense, perform the check immediately before the insert loop and accept the small race window — payroll finalization is an infrequent, admin-only, single-operator action.

**Locking scope:**
`isLocked = true` is set on attendance rows for the site-month being finalized — this affects 1.3's edit actions (`adminEditAttendance`, `markMorningAttendance`, etc.), which already check `isLocked` and throw. No changes needed to 1.3 code, just confirm the check is in place.

**Correction does not touch attendance:**
Corrections are pure ledger/snapshot entries. They do not modify `attendance` rows, do not change `fullDays`/`halfDays`/OT counts on the original snapshot, and do not unlock anything. They are purely additive financial records.

**`workerSnapshot.cityName` computation:**
In `finalizePayroll`, `worker?.cityId ? preview.cityName : '—'` is a placeholder — this assumes the worker's current city matches the site's city (true in the common case). If a worker was reassigned to a different city mid-month, this could be technically inaccurate for historical record purposes. Acceptable for 1.5; can be refined later by snapshotting the worker's `cityId` at the time of each attendance row if precision becomes important.

**Site state relation dependency:**
`getFinalizationPreview` accesses `site.city.state.name` — same dependency as 1.4. Confirm `citiesRelations` includes the `state` relation (added in 1.4, verify it's present).

---

## Module 1.5 Gate Checklist

```
[ ] Schema: payroll_snapshots and transactions tables created
[ ] Schema: partial unique index (or app-level check) for non-correction snapshots
[ ] Schema: self-referencing correctionOf FK works
[ ] pnpm drizzle-kit push runs without errors
[ ] pnpm tsc --noEmit — zero type errors

SITE OVERVIEW INTEGRATION
[ ] Not-yet-finalized past months show "Finalize Payroll" button
[ ] Current month shows "In Progress" — no finalize button
[ ] Already-finalized months show green "Finalized" badge

FINALIZATION REVIEW PAGE
[ ] Page loads with correct worker breakdown for the selected month
[ ] Soft warning banner appears if earlier months are unfinalized
[ ] Soft warning does not block proceeding
[ ] Edited rows show "Edited?" badge linking to attendance filter
[ ] Adjustment input accepts positive and negative numbers
[ ] Reason field becomes required when adjustment ≠ 0
[ ] Final Wage column updates live as adjustment is typed
[ ] Summary footer totals update live
[ ] Confirm dialog shows correct total payout and worker count

FINALIZATION EXECUTION
[ ] Confirming finalization creates one payroll_snapshots row per worker
[ ] Each snapshot has correct fullDays, halfDays, OT counts, grossWage, finalWage
[ ] siteSnapshot and workerSnapshot JSONB populated correctly
[ ] hadPreFinalizationEdits = true for workers with edited attendance rows
[ ] One transactions row created per worker, type = 'payroll_worker'
[ ] transaction.amount matches abs(finalWage), direction correct for sign
[ ] All attendance rows for that site-month now have isLocked = true
[ ] Attempting to finalize the same month again throws an error
[ ] Attempting to edit locked attendance (via 1.3 admin edit) is blocked

FINALIZED SNAPSHOT VIEW
[ ] Clicking a "Finalized" month shows the read-only snapshot view
[ ] Header shows historical site info from siteSnapshot (not live)
[ ] "Finalized by {admin name} on {date}" displays correctly
[ ] Worker table shows gross, adjustment, final correctly
[ ] Grand total matches sum of finalWage across workers

CORRECTIONS
[ ] "Add Correction" button visible on finalized snapshot rows
[ ] Correction dialog requires reason
[ ] Correction with amount = 0 is rejected
[ ] Submitting correction creates a new payroll_snapshots row with isCorrection = true
[ ] correctionOf correctly references the original snapshot
[ ] New transactions row created, type = 'payroll_correction'
[ ] Corrections column shows the new correction chip
[ ] Current Total = original finalWage + correction finalWage
[ ] Multiple corrections on the same worker-month all appear and sum correctly
[ ] Correction does NOT modify attendance rows or original snapshot

WORKER EARNINGS PAGE
[ ] Finalized site-months show "Finalized" badge instead of "Not Finalized"
[ ] Finalized site-months show currentTotal (with corrections) not live computation
[ ] "Add Correction" available from worker earnings page for finalized months
[ ] Correction added from worker page reflects on both worker page and site snapshot view

EDGE CASES
[ ] Site-month with zero attendance cannot be finalized (error shown)
[ ] Adjustment of exactly 0 does not require a reason
[ ] Finalizing a month, then trying to mark/edit attendance for that month via 1.3 is blocked

QUALITY
[ ] pnpm tsc --noEmit — zero type errors
[ ] pnpm lint — zero lint errors
[ ] Git commit: "feat: module 1.5 payroll finalization"
```

---

*Next: Module 1.6 — Advances & Site Expenses*
