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

// ─── Formatting ─────────────────────────────────────────────────────────────────

/**
 * Formats a number as an Indian-locale rupee string with no paise.
 * e.g. 245000 → '₹2,45,000'
 */
export function formatINR(value: number): string {
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
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
