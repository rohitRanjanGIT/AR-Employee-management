import { differenceInCalendarDays, format } from 'date-fns'

export function todayIST(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export type DateContext = 'today' | 'yesterday' | 'edit_request' | 'too_old'

export function classifyDate(dateStr: string): DateContext {
  const days = differenceInCalendarDays(new Date(), new Date(dateStr))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days >= 2 && days <= 7) return 'edit_request'
  return 'too_old'
}

export function derivedStatus(
  morningMarkedAt: Date | null,
  eveningMarkedAt: Date | null
): 'full' | 'half' {
  if (morningMarkedAt && eveningMarkedAt) return 'full'
  return 'half'
}

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
