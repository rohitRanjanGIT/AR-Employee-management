# Module 1.4 — Payroll Dashboard (Read-Only)

## Objective
Admin can view live wage calculations across all sites, drill into any site's monthly breakdown, and track any worker's lifetime earnings. All numbers computed live from the attendance table. No finalization, no locking — pure financial visibility. Nothing outside this scope.

---

## Prerequisites
- Modules 1.0 through 1.3-pre and 1.3 gate checklists fully passed
- Attendance data exists in the DB (at least a few days of marked attendance across sites)
- Workers have `wage_daily_snapshot` and `ot_rate_snapshot` on their attendance rows

---

## Scope

**Admin can:**
- View current month summary cards on the dashboard
- View consolidated expenses across all sites with composable filters (site / city / state / month)
- Drill into a specific site — total spent, monthly breakdown, per-worker breakdown per month
- Drill into a specific worker — lifetime earnings, per-site breakdown, monthly breakdown
- Apply any combination of filters on all views

**Supervisor cannot:**
- Access any payroll or financial data
- This entire module is admin-only

---

## Packages to Install

```bash
pnpm add date-fns
```

date-fns is likely already installed from 1.3. Skip if already present.

---

## Step 1 — Wage Computation Utilities

Create `src/lib/payroll.ts`:

```ts
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns'

// ─── Core wage formula ────────────────────────────────────────────────────────

/**
 * Computes the wage earned for a single attendance row.
 *
 * Formula:
 * - Full day  → wage_daily_snapshot
 * - Half day  → wage_daily_snapshot / 2
 * - OT none   → +0
 * - OT 2hr    → +ot_rate_snapshot        (flat rate for 2hr session)
 * - OT 4hr    → +ot_rate_snapshot * 2    (double the 2hr rate)
 * OT only applies on full days.
 */
export function computeRowWage({
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
  const base =
    derivedStatus === 'full'
      ? wageDailySnapshot
      : wageDailySnapshot / 2

  if (derivedStatus !== 'full' || ot === 'none' || !otRateSnapshot) {
    return base
  }

  const otAmount = ot === '2hr' ? otRateSnapshot : otRateSnapshot * 2
  return base + otAmount
}

// ─── Month helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the first and last date of a given month as YYYY-MM-DD strings.
 */
export function getMonthBounds(year: number, month: number): {
  start: string
  end: string
} {
  const date = new Date(year, month - 1, 1)
  return {
    start: format(startOfMonth(date), 'yyyy-MM-dd'),
    end: format(endOfMonth(date), 'yyyy-MM-dd'),
  }
}

/**
 * Returns YYYY-MM string for a given date string.
 */
export function toYearMonth(dateStr: string): string {
  return dateStr.slice(0, 7) // 'YYYY-MM-DD' → 'YYYY-MM'
}

/**
 * Returns a human-readable month label from a YYYY-MM string.
 * e.g. '2026-06' → 'June 2026'
 */
export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  return format(new Date(year, month - 1, 1), 'MMMM yyyy')
}

/**
 * Returns true if the given YYYY-MM is the current calendar month.
 */
export function isCurrentMonth(yearMonth: string): boolean {
  return yearMonth === format(new Date(), 'yyyy-MM')
}

/**
 * Returns all YYYY-MM strings between two date strings (inclusive).
 * Used to enumerate months a site has been active.
 */
export function getMonthRange(startDate: string, endDate: string): string[] {
  const months: string[] = []
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const current = startOfMonth(start)

  while (current <= endOfMonth(end)) {
    months.push(format(current, 'yyyy-MM'))
    current.setMonth(current.getMonth() + 1)
  }
  return months
}

// ─── Aggregation types ────────────────────────────────────────────────────────

export type WorkerMonthSummary = {
  workerId: string
  workerName: string
  workerCategory: string
  fullDays: number
  halfDays: number
  otTwoHr: number
  otFourHr: number
  totalWage: number
}

export type SiteMonthSummary = {
  yearMonth: string
  label: string             // 'June 2026'
  isCurrentMonth: boolean
  isFinalized: boolean      // always false in 1.4 — finalization comes in 1.5
  totalWage: number
  workerCount: number
  workers: WorkerMonthSummary[]
}

export type SiteSummary = {
  siteId: string
  siteName: string
  siteCode: string
  cityName: string
  stateName: string
  totalWageAllTime: number
  months: SiteMonthSummary[]
}

export type WorkerSiteSummary = {
  siteId: string
  siteName: string
  siteCode: string
  cityName: string
  stateName: string
  totalWage: number
  months: {
    yearMonth: string
    label: string
    isCurrentMonth: boolean
    totalWage: number
    fullDays: number
    halfDays: number
    otTwoHr: number
    otFourHr: number
  }[]
}

export type WorkerLifetimeSummary = {
  workerId: string
  workerName: string
  workerCategory: string
  cityName: string
  totalWageAllTime: number
  sites: WorkerSiteSummary[]
}
```

---

## Step 2 — Server Actions

Create `src/actions/payroll.ts`:

```ts
'use server'

import { db } from '@/db'
import { attendance, workers, sites, cities, states } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { and, eq, gte, lte, inArray, sql } from 'drizzle-orm'
import {
  computeRowWage,
  toYearMonth,
  formatYearMonth,
  isCurrentMonth,
  getMonthBounds,
} from '@/lib/payroll'
import { format } from 'date-fns'

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

// ─── Filter input type ────────────────────────────────────────────────────────

type PayrollFilters = {
  siteId?: string
  cityId?: string
  stateId?: string
  yearMonth?: string   // 'YYYY-MM'
}

// ─── Get all attendance rows matching filters ─────────────────────────────────
// Internal helper — fetches raw attendance with all relations needed for computation.

async function getFilteredAttendanceRows(filters: PayrollFilters) {
  // Build site ID list from filters
  let filteredSiteIds: string[] | null = null

  if (filters.siteId) {
    filteredSiteIds = [filters.siteId]
  } else if (filters.cityId || filters.stateId) {
    // Find sites matching city or state filter
    const allSites = await db.query.sites.findMany({
      with: { city: { with: { state: true } } },
    })

    const matchingSites = allSites.filter((s) => {
      if (filters.cityId && s.cityId !== filters.cityId) return false
      if (filters.stateId && s.city.stateId !== filters.stateId) return false
      return true
    })

    filteredSiteIds = matchingSites.map((s) => s.id)
    if (filteredSiteIds.length === 0) return []
  }

  // Build date range from yearMonth filter
  let dateStart: string | null = null
  let dateEnd: string | null = null

  if (filters.yearMonth) {
    const [year, month] = filters.yearMonth.split('-').map(Number)
    const bounds = getMonthBounds(year, month)
    dateStart = bounds.start
    dateEnd = bounds.end
  }

  // Build query conditions
  const conditions = []
  if (filteredSiteIds) conditions.push(inArray(attendance.siteId, filteredSiteIds))
  if (dateStart) conditions.push(gte(attendance.date, dateStart))
  if (dateEnd) conditions.push(lte(attendance.date, dateEnd))

  return db.query.attendance.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      worker: true,
      site: {
        with: {
          city: {
            with: { state: true },
          },
        },
      },
    },
  })
}

// ─── Dashboard summary cards ──────────────────────────────────────────────────
// Returns four summary values for the current calendar month.

export async function getDashboardSummary() {
  await requireAdmin()

  const currentYearMonth = format(new Date(), 'yyyy-MM')
  const [year, month] = currentYearMonth.split('-').map(Number)
  const { start, end } = getMonthBounds(year, month)

  const rows = await db.query.attendance.findMany({
    where: and(
      gte(attendance.date, start),
      lte(attendance.date, end)
    ),
    with: { site: true, worker: true },
  })

  // Total wage cost this month
  const totalWageCost = rows.reduce((sum, row) => {
    return sum + computeRowWage({
      derivedStatus: row.derivedStatus as 'full' | 'half',
      wageDailySnapshot: Number(row.wageDailySnapshot),
      otRateSnapshot: row.otRateSnapshot ? Number(row.otRateSnapshot) : null,
      ot: row.ot as 'none' | '2hr' | '4hr',
    })
  }, 0)

  // Unique workers with at least one attendance mark this month
  const activeWorkerIds = new Set(rows.map((r) => r.workerId))
  const totalActiveWorkers = activeWorkerIds.size

  // Top spending site
  const siteTotals: Record<string, { name: string; code: string; total: number }> = {}
  for (const row of rows) {
    const wage = computeRowWage({
      derivedStatus: row.derivedStatus as 'full' | 'half',
      wageDailySnapshot: Number(row.wageDailySnapshot),
      otRateSnapshot: row.otRateSnapshot ? Number(row.otRateSnapshot) : null,
      ot: row.ot as 'none' | '2hr' | '4hr',
    })
    if (!siteTotals[row.siteId]) {
      siteTotals[row.siteId] = {
        name: row.site.name,
        code: row.site.code,
        total: 0,
      }
    }
    siteTotals[row.siteId].total += wage
  }

  const topSite = Object.entries(siteTotals).sort(
    (a, b) => b[1].total - a[1].total
  )[0] ?? null

  // Pending attendance edit requests
  const pendingEdits = await db.query.attendance.findMany({
    where: eq(attendance.editRequestStatus, 'pending'),
  })

  return {
    currentMonth: format(new Date(), 'MMMM yyyy'),
    totalWageCost,
    totalActiveWorkers,
    topSite: topSite
      ? { name: topSite[1].name, code: topSite[1].code, total: topSite[1].total }
      : null,
    pendingAttendanceEdits: pendingEdits.length,
  }
}

// ─── Consolidated payroll view ────────────────────────────────────────────────
// Used by /admin/payroll — returns site-level totals matching the filters.
// Each site entry contains monthly breakdown and worker breakdown per month.

export async function getConsolidatedPayroll(filters: PayrollFilters) {
  await requireAdmin()

  const rows = await getFilteredAttendanceRows(filters)
  if (rows.length === 0) return []

  // Group rows by siteId → yearMonth → workerId
  const grouped: Record<
    string,
    {
      site: typeof rows[0]['site']
      months: Record<
        string,
        {
          workers: Record<
            string,
            {
              worker: typeof rows[0]['worker']
              rows: typeof rows
            }
          >
        }
      >
    }
  > = {}

  for (const row of rows) {
    const siteId = row.siteId
    const yearMonth = toYearMonth(row.date)
    const workerId = row.workerId

    if (!grouped[siteId]) {
      grouped[siteId] = { site: row.site, months: {} }
    }
    if (!grouped[siteId].months[yearMonth]) {
      grouped[siteId].months[yearMonth] = { workers: {} }
    }
    if (!grouped[siteId].months[yearMonth].workers[workerId]) {
      grouped[siteId].months[yearMonth].workers[workerId] = {
        worker: row.worker,
        rows: [],
      }
    }
    grouped[siteId].months[yearMonth].workers[workerId].rows.push(row)
  }

  // Compute aggregates
  return Object.entries(grouped).map(([siteId, siteData]) => {
    const months = Object.entries(siteData.months)
      .sort(([a], [b]) => b.localeCompare(a)) // newest first
      .map(([yearMonth, monthData]) => {
        const workers = Object.entries(monthData.workers).map(
          ([workerId, workerData]) => {
            let fullDays = 0
            let halfDays = 0
            let otTwoHr = 0
            let otFourHr = 0
            let totalWage = 0

            for (const row of workerData.rows) {
              const wage = computeRowWage({
                derivedStatus: row.derivedStatus as 'full' | 'half',
                wageDailySnapshot: Number(row.wageDailySnapshot),
                otRateSnapshot: row.otRateSnapshot
                  ? Number(row.otRateSnapshot)
                  : null,
                ot: row.ot as 'none' | '2hr' | '4hr',
              })
              totalWage += wage
              if (row.derivedStatus === 'full') fullDays++
              else halfDays++
              if (row.ot === '2hr') otTwoHr++
              if (row.ot === '4hr') otFourHr++
            }

            return {
              workerId,
              workerName: workerData.worker.name,
              workerCategory: workerData.worker.category,
              fullDays,
              halfDays,
              otTwoHr,
              otFourHr,
              totalWage,
            }
          }
        )

        const monthTotal = workers.reduce((s, w) => s + w.totalWage, 0)

        return {
          yearMonth,
          label: formatYearMonth(yearMonth),
          isCurrentMonth: isCurrentMonth(yearMonth),
          isFinalized: false, // 1.5 will set this
          totalWage: monthTotal,
          workerCount: workers.length,
          workers,
        }
      })

    const totalWageAllTime = months.reduce((s, m) => s + m.totalWage, 0)

    return {
      siteId,
      siteName: siteData.site.name,
      siteCode: siteData.site.code,
      cityName: siteData.site.city.name,
      stateName: siteData.site.city.state?.name ?? '—',
      totalWageAllTime,
      months,
    }
  })
}

// ─── Single site payroll overview ─────────────────────────────────────────────
// Used by /admin/payroll/sites/[siteId]

export async function getSitePayrollOverview(siteId: string, yearMonth?: string) {
  await requireAdmin()

  const result = await getConsolidatedPayroll({
    siteId,
    yearMonth,
  })

  return result[0] ?? null
}

// ─── Worker lifetime earnings ─────────────────────────────────────────────────
// Used by /admin/payroll/workers/[workerId]

export async function getWorkerLifetimeEarnings(
  workerId: string,
  filters: Omit<PayrollFilters, 'siteId'> = {}
) {
  await requireAdmin()

  const worker = await db.query.workers.findFirst({
    where: eq(workers.id, workerId),
    with: { city: true },
  })
  if (!worker) throw new Error('Worker not found')

  // Get all attendance rows for this worker, with optional filters
  const rows = await getFilteredAttendanceRows({ ...filters })
  const workerRows = rows.filter((r) => r.workerId === workerId)

  if (workerRows.length === 0) {
    return {
      workerId,
      workerName: worker.name,
      workerCategory: worker.category,
      cityName: worker.city?.name ?? '—',
      totalWageAllTime: 0,
      sites: [],
    }
  }

  // Group by siteId → yearMonth
  const siteGroups: Record<
    string,
    {
      site: typeof workerRows[0]['site']
      monthGroups: Record<string, typeof workerRows>
    }
  > = {}

  for (const row of workerRows) {
    const siteId = row.siteId
    const yearMonth = toYearMonth(row.date)

    if (!siteGroups[siteId]) {
      siteGroups[siteId] = { site: row.site, monthGroups: {} }
    }
    if (!siteGroups[siteId].monthGroups[yearMonth]) {
      siteGroups[siteId].monthGroups[yearMonth] = []
    }
    siteGroups[siteId].monthGroups[yearMonth].push(row)
  }

  const sites = Object.entries(siteGroups).map(([siteId, siteData]) => {
    const months = Object.entries(siteData.monthGroups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([yearMonth, monthRows]) => {
        let fullDays = 0
        let halfDays = 0
        let otTwoHr = 0
        let otFourHr = 0
        let totalWage = 0

        for (const row of monthRows) {
          const wage = computeRowWage({
            derivedStatus: row.derivedStatus as 'full' | 'half',
            wageDailySnapshot: Number(row.wageDailySnapshot),
            otRateSnapshot: row.otRateSnapshot
              ? Number(row.otRateSnapshot)
              : null,
            ot: row.ot as 'none' | '2hr' | '4hr',
          })
          totalWage += wage
          if (row.derivedStatus === 'full') fullDays++
          else halfDays++
          if (row.ot === '2hr') otTwoHr++
          if (row.ot === '4hr') otFourHr++
        }

        return {
          yearMonth,
          label: formatYearMonth(yearMonth),
          isCurrentMonth: isCurrentMonth(yearMonth),
          totalWage,
          fullDays,
          halfDays,
          otTwoHr,
          otFourHr,
        }
      })

    const siteTotalWage = months.reduce((s, m) => s + m.totalWage, 0)

    return {
      siteId,
      siteName: siteData.site.name,
      siteCode: siteData.site.code,
      cityName: siteData.site.city.name,
      stateName: siteData.site.city.state?.name ?? '—',
      totalWage: siteTotalWage,
      months,
    }
  })

  const totalWageAllTime = sites.reduce((s, site) => s + site.totalWage, 0)

  return {
    workerId,
    workerName: worker.name,
    workerCategory: worker.category,
    cityName: worker.city?.name ?? '—',
    totalWageAllTime,
    sites,
  }
}

// ─── Filter options ───────────────────────────────────────────────────────────
// Returns all states, cities, sites, and available months for filter dropdowns.

export async function getPayrollFilterOptions() {
  await requireAdmin()

  const [allStates, allCities, allSites, allMonths] = await Promise.all([
    db.query.states.findMany({ orderBy: (s, { asc }) => [asc(s.name)] }),
    db.query.cities.findMany({
      with: { state: true },
      orderBy: (c, { asc }) => [asc(c.name)],
    }),
    db.query.sites.findMany({
      with: { city: { with: { state: true } } },
      orderBy: (s, { asc }) => [asc(s.name)],
    }),
    // Distinct months from attendance data
    db
      .selectDistinct({ date: attendance.date })
      .from(attendance)
      .orderBy(attendance.date),
  ])

  // Extract unique YYYY-MM values from attendance dates
  const monthSet = new Set(allMonths.map((r) => toYearMonth(r.date)))
  const months = Array.from(monthSet)
    .sort((a, b) => b.localeCompare(a))
    .map((ym) => ({ value: ym, label: formatYearMonth(ym) }))

  return { states: allStates, cities: allCities, sites: allSites, months }
}
```

---

## Step 3 — Admin Navigation Update

Add "Payroll" to `src/components/AdminNav.tsx`:

- Dashboard → `/admin/dashboard`
- Cities → `/admin/cities`
- Sites → `/admin/sites`
- Supervisors → `/admin/supervisors`
- Workers → `/admin/workers`
- Attendance → `/admin/attendance`
- **Payroll → `/admin/payroll`** ← new
- Work Types → `/admin/work-types`

---

## Step 4 — Admin Dashboard Update

Update `src/app/admin/dashboard/page.tsx`:

- Call `getDashboardSummary()` server-side
- Replace or extend the existing welcome card with four summary cards:

```
┌─────────────────────┐  ┌─────────────────────┐
│ Total Wage Cost     │  │ Active Workers      │
│ ₹2,45,000           │  │ 84                  │
│ June 2026           │  │ this month          │
└─────────────────────┘  └─────────────────────┘
┌─────────────────────┐  ┌─────────────────────┐
│ Top Spending Site   │  │ Pending Edits       │
│ DELS1SU             │  │ 3                   │
│ ₹98,000 this month  │  │ awaiting review     │
└─────────────────────┘  └─────────────────────┘
```

- All four cards use shadcn `Card`
- Wage amounts formatted with `₹` and Indian locale (`toLocaleString('en-IN')`)
- Pending Edits card links to `/admin/attendance?tab=edit-requests`
- Top Spending Site card links to `/admin/payroll/sites/{siteId}`

---

## Step 5 — Consolidated Payroll Page

File structure:
```
src/app/admin/payroll/
  page.tsx                    ← server component
  PayrollClient.tsx           ← client component, filters + results
  PayrollFilters.tsx          ← filter bar
  SitePayrollCard.tsx         ← collapsible site row with month + worker breakdown
```

### `page.tsx` (server component)
- Role check: admin only
- Fetch filter options via `getPayrollFilterOptions()`
- Fetch initial consolidated payroll via `getConsolidatedPayroll({})` (no filters)
- Render `<PayrollClient />`

### `PayrollClient.tsx` (client component)
- Holds filter state: `{ siteId, cityId, stateId, yearMonth }`
- When any filter changes: calls `getConsolidatedPayroll(filters)` via server action
- Renders `<PayrollFilters />` and a list of `<SitePayrollCard />`
- Summary bar above the list: "Showing X sites — Total: ₹Y"
- Empty state: "No attendance data matches the selected filters."

### `PayrollFilters.tsx`
Four filter dropdowns in a row (stack on mobile):
- **State** — Select from all states
- **City** — Select filtered to selected state (if state selected), else all cities
- **Site** — Select filtered to selected city (if city selected), else all sites
- **Month** — Select from available months in attendance data

Filters are cascading: selecting a state narrows the city dropdown, selecting a city narrows the site dropdown. Clearing a parent filter clears child filters too.

"Clear all filters" button — resets all four to empty.

### `SitePayrollCard.tsx`
Collapsible card per site:

**Collapsed (default):**
- Site name + code (monospace badge)
- City + State
- Total wage all time: ₹X
- "View Details" link → `/admin/payroll/sites/{siteId}`
- Expand chevron

**Expanded:**
- Month-by-month table:
  - Month | Workers | Full Days | Half Days | OT 2hr | OT 4hr | Total Wage | Status badge
  - Status badge: "In Progress" (current month, orange) | "Not Finalized" (past month, yellow) | "Finalized" (future 1.5, green)
  - Each month row is expandable → shows per-worker breakdown table within it

**Per-worker breakdown (inside month row):**
- Worker Name | Category | Full Days | Half Days | OT 2hr | OT 4hr | Total Wage
- Worker name links to `/admin/payroll/workers/{workerId}`
- Sorted by total wage descending

---

## Step 6 — Site Payroll Overview Page

File structure:
```
src/app/admin/payroll/sites/
  [siteId]/
    page.tsx                  ← server component
    SitePayrollOverview.tsx   ← client component
```

### `page.tsx` (server component)
- Role check: admin only
- Fetch site overview via `getSitePayrollOverview(siteId)`
- Fetch site details for the header
- If no data found: show "No attendance data recorded for this site yet."
- Render `<SitePayrollOverview />`

### `SitePayrollOverview.tsx` (client component)

**Header section:**
- Site name, code, city, state
- Back link → `/admin/payroll`
- Total spent all time: large ₹ figure
- Subtext: "Worker wages across all months"

**Monthly breakdown table:**

| Month | Workers | Full Days | Half Days | OT 2hr | OT 4hr | Worker Wages | Status |
|---|---|---|---|---|---|---|---|
| June 2026 | 12 | 180 | 24 | 8 | 3 | ₹1,20,000 | In Progress |
| May 2026 | 10 | 200 | 10 | 5 | 1 | ₹1,05,000 | Not Finalized |

- Each month row is expandable → per-worker breakdown
- "Worker Wages" column header tooltip: "More expense categories (advances, materials) will appear here in future modules."

**Per-worker breakdown (expandable per month):**
| Worker | Category | Full Days | Half Days | OT 2hr | OT 4hr | Wages |
|---|---|---|---|---|---|---|
| Ramesh Kumar | Skilled | 20 | 2 | 3 | 1 | ₹14,500 |

- Worker name is a link → `/admin/payroll/workers/{workerId}`

**Month filter:**
- Single month Select at the top right of the page — filters the table to one month
- Clearing the filter shows all months

---

## Step 7 — Worker Lifetime Earnings Page

File structure:
```
src/app/admin/payroll/workers/
  [workerId]/
    page.tsx                     ← server component
    WorkerEarningsOverview.tsx   ← client component
```

### `page.tsx` (server component)
- Role check: admin only
- Fetch worker earnings via `getWorkerLifetimeEarnings(workerId)`
- Render `<WorkerEarningsOverview />`

### `WorkerEarningsOverview.tsx` (client component)

**Header section:**
- Worker name, category badge, city
- Back link → `/admin/workers`
- Lifetime earnings: large ₹ figure
- Subtext: "Total wages across all sites and months"

**Filter bar:**
- State, City, Month dropdowns (same cascading logic as consolidated view)
- When filters applied: calls `getWorkerLifetimeEarnings(workerId, filters)` → re-renders

**Per-site breakdown:**

Collapsible card per site the worker has worked at:

**Collapsed:**
- Site name + code + city
- Total wages from this site: ₹X

**Expanded — month breakdown per site:**
| Month | Full Days | Half Days | OT 2hr | OT 4hr | Wages | Status |
|---|---|---|---|---|---|---|
| June 2026 | 18 | 2 | 1 | 0 | ₹11,000 | In Progress |

**Summary totals bar** (bottom of page, sticky):
- "Showing X sites — Total: ₹Y" — updates live with filters

---

## Step 8 — Worker Page: Add Earnings Link

Update `src/app/admin/workers/WorkersTable.tsx`:

Add a "View Earnings" link in the Actions column for each active worker:
- Links to `/admin/payroll/workers/{workerId}`
- Only shown for active workers (pending/rejected workers have no attendance data)

---

## Step 9 — Sites Page: Add Payroll Link

Update `src/app/admin/sites/SitesTable.tsx`:

Add a "View Payroll" link in the Actions column for each site:
- Links to `/admin/payroll/sites/{siteId}`
- Shown for both active and inactive sites (historical data still viewable)

---

## Key Logic Notes

**All computation is in application code, not SQL:**
`getFilteredAttendanceRows` fetches raw rows and computation happens in JS via `computeRowWage`. This is intentional for 1.4 — the dataset is manageable and keeping logic in `payroll.ts` makes it easy to verify, test, and reuse in 1.5. If performance becomes an issue at scale, move aggregation to SQL window functions in a future optimization pass.

**Decimal precision:**
Drizzle returns `decimal` columns as strings from Neon. Always wrap in `Number()` before arithmetic. Final display values should use `toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })` for clean ₹ formatting — no paise display needed.

**"Not Finalized" vs "In Progress" badge:**
- Current month → "In Progress" (orange) — numbers will change as attendance is marked
- Past months → "Not Finalized" (yellow) — numbers are complete but not locked
- Both are computed from `isCurrentMonth(yearMonth)` in `payroll.ts`
- "Finalized" (green) badge is scaffolded but never shown in 1.4 — it activates in 1.5

**Cascading filter state:**
When state filter changes → clear city and site filters.
When city filter changes → clear site filter.
Month filter is independent — never cleared by other filters.
Implement with a single `filters` state object and a helper that clears downstream fields.

**`states` relation on `cities`:**
The `cities` table has a `stateId` FK added in Module 1.1. Make sure the `citiesRelations` in `schema.ts` includes the `state` relation — required for `getFilteredAttendanceRows` to work. If missing, add:
```ts
export const citiesRelations = relations(cities, ({ one, many }) => ({
  state: one(states, { fields: [cities.stateId], references: [states.id] }),
  sites: many(sites),
  employees: many(employees),
}))
```

**Split-shift attribution:**
A worker with two attendance rows on the same date (different sites) will appear in both sites' breakdowns with `derivedStatus = 'half'` on each row. Each site is charged half a day's wage. This is correct — the 50-50 split emerges naturally from the data.

**Indian number formatting:**
Use `Number(value).toLocaleString('en-IN')` throughout — this formats 245000 as "2,45,000" which is the Indian lakh/crore format your client expects.

---

## Module 1.4 Gate Checklist

Do not proceed to Module 1.5 until every item below passes.

```
[ ] pnpm tsc --noEmit — zero type errors after adding payroll.ts

DASHBOARD CARDS
[ ] Four summary cards render on /admin/dashboard
[ ] Total Wage Cost shows correct sum for current month
[ ] Active Workers count is correct (unique workers with attendance this month)
[ ] Top Spending Site shows correct site name and amount
[ ] Pending Edits count matches actual pending edit requests
[ ] Pending Edits card links to /admin/attendance?tab=edit-requests
[ ] Top Spending Site card links to correct site payroll page
[ ] All amounts formatted in Indian locale (₹2,45,000 not ₹245000)

CONSOLIDATED PAYROLL PAGE
[ ] Page loads with all sites shown (no filters)
[ ] Summary bar shows correct site count and total
[ ] State filter narrows city dropdown correctly
[ ] City filter narrows site dropdown correctly
[ ] Month filter works independently
[ ] Clearing state filter also clears city and site filters
[ ] "Clear all filters" resets all four dropdowns
[ ] Empty filter result shows empty state message

SITE PAYROLL CARDS
[ ] Each site card shows name, code, city, state, total wage
[ ] Expanding a card shows month-by-month table
[ ] Current month shows "In Progress" badge (orange)
[ ] Past months show "Not Finalized" badge (yellow)
[ ] Month totals are mathematically correct
  (verify manually: pick a worker, count their attendance rows, compute expected wage)
[ ] Expanding a month row shows per-worker breakdown
[ ] Worker names in breakdown link to worker earnings page
[ ] "View Details" links to /admin/payroll/sites/{siteId}

SITE PAYROLL OVERVIEW PAGE
[ ] Header shows site name, code, city, state
[ ] Total all-time wage is correct
[ ] Monthly table renders all months with attendance data
[ ] Month filter on this page works correctly
[ ] Expanding a month shows per-worker breakdown
[ ] Worker links navigate to correct worker earnings page
[ ] "Worker Wages" column header tooltip visible

WORKER EARNINGS PAGE
[ ] Header shows worker name, category, city, lifetime earnings
[ ] All sites the worker has worked at are shown
[ ] Site cards collapse/expand correctly
[ ] Month breakdown per site is correct
[ ] State/city/month filters work and update results
[ ] Summary totals bar updates with filter changes
[ ] Back link returns to /admin/workers

SPLIT SHIFT VERIFICATION
[ ] Worker with a split-shift day appears in BOTH sites' breakdowns
[ ] Each site shows derivedStatus = half for that day
[ ] Each site is charged half wage — not full wage
[ ] Worker's lifetime earnings page shows both site entries

WORKERS PAGE INTEGRATION
[ ] "View Earnings" link appears on active worker rows
[ ] Link navigates to correct worker earnings page

SITES PAGE INTEGRATION
[ ] "View Payroll" link appears on all site rows (active + inactive)
[ ] Link navigates to correct site payroll page

FORMULA VERIFICATION (manual check)
[ ] Full day, no OT: wage = wage_daily_snapshot ✓
[ ] Half day, no OT: wage = wage_daily_snapshot / 2 ✓
[ ] Full day, 2hr OT: wage = wage_daily_snapshot + ot_rate_snapshot ✓
[ ] Full day, 4hr OT: wage = wage_daily_snapshot + (ot_rate_snapshot * 2) ✓
[ ] Half day with OT marked: OT ignored, wage = wage_daily_snapshot / 2 ✓

QUALITY
[ ] pnpm tsc --noEmit — zero type errors
[ ] pnpm lint — zero lint errors
[ ] Git commit: "feat: module 1.4 payroll dashboard"
```

---

*Next: Module 1.5 — Payroll Finalization*
