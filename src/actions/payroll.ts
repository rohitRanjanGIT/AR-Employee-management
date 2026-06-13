'use server'

import { db } from '@/db'
import { attendance, workers } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { and, eq, gte, lte, inArray } from 'drizzle-orm'
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
  yearMonth?: string // 'YYYY-MM'
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
    where: and(gte(attendance.date, start), lte(attendance.date, end)),
    with: { site: true, worker: true },
  })

  // Total wage cost this month
  const totalWageCost = rows.reduce((sum, row) => {
    return (
      sum +
      computeRowWage({
        derivedStatus: row.derivedStatus as 'full' | 'half',
        wageDailySnapshot: Number(row.wageDailySnapshot),
        otRateSnapshot: row.otRateSnapshot ? Number(row.otRateSnapshot) : null,
        ot: row.ot as 'none' | '2hr' | '4hr',
      })
    )
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

  const topSiteEntry =
    Object.entries(siteTotals).sort((a, b) => b[1].total - a[1].total)[0] ?? null

  // Pending attendance edit requests
  const pendingEdits = await db.query.attendance.findMany({
    where: eq(attendance.editRequestStatus, 'pending'),
  })

  return {
    currentMonth: format(new Date(), 'MMMM yyyy'),
    totalWageCost,
    totalActiveWorkers,
    topSite: topSiteEntry
      ? {
          siteId: topSiteEntry[0],
          name: topSiteEntry[1].name,
          code: topSiteEntry[1].code,
          total: topSiteEntry[1].total,
        }
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
      site: (typeof rows)[0]['site']
      months: Record<
        string,
        {
          workers: Record<
            string,
            {
              worker: (typeof rows)[0]['worker']
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
        const workersList = Object.entries(monthData.workers).map(
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

        // Sorted by total wage descending
        workersList.sort((a, b) => b.totalWage - a.totalWage)

        const monthTotal = workersList.reduce((s, w) => s + w.totalWage, 0)

        return {
          yearMonth,
          label: formatYearMonth(yearMonth),
          isCurrentMonth: isCurrentMonth(yearMonth),
          isFinalized: false, // 1.5 will set this
          totalWage: monthTotal,
          workerCount: workersList.length,
          workers: workersList,
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
      site: (typeof workerRows)[0]['site']
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
    db.selectDistinct({ date: attendance.date }).from(attendance).orderBy(attendance.date),
  ])

  // Extract unique YYYY-MM values from attendance dates
  const monthSet = new Set(allMonths.map((r) => toYearMonth(r.date)))
  const months = Array.from(monthSet)
    .sort((a, b) => b.localeCompare(a))
    .map((ym) => ({ value: ym, label: formatYearMonth(ym) }))

  return { states: allStates, cities: allCities, sites: allSites, months }
}
