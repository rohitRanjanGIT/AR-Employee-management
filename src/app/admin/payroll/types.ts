// Shared display types for the payroll UI — mirror the server action return shapes.

export type WorkerBreakdown = {
  workerId: string
  workerName: string
  workerCategory: string
  fullDays: number
  halfDays: number
  otTwoHr: number
  otFourHr: number
  totalWage: number
}

export type MonthBreakdown = {
  yearMonth: string
  label: string
  isCurrentMonth: boolean
  isFinalized: boolean
  totalWage: number
  workerCount: number
  workers: WorkerBreakdown[]
}

export type ConsolidatedSite = {
  siteId: string
  siteName: string
  siteCode: string
  cityName: string
  stateName: string
  totalWageAllTime: number
  months: MonthBreakdown[]
}

export const CATEGORY_LABELS: Record<string, string> = {
  skilled: 'Skilled',
  semi_skilled: 'Semi-Skilled',
  helper: 'Helper',
}
