import { Badge } from '@/components/ui/badge'

/**
 * Month finalization status badge.
 * - In Progress  → current month (orange) — numbers still changing
 * - Not Finalized → past month (yellow) — complete but not locked
 * - Finalized     → green (scaffolded for 1.5, never shown in 1.4)
 */
export function MonthStatusBadge({
  isCurrentMonth,
  isFinalized,
}: {
  isCurrentMonth: boolean
  isFinalized: boolean
}) {
  if (isFinalized) {
    return (
      <Badge className="border-transparent bg-green-500/15 text-green-700 dark:text-green-400">
        Finalized
      </Badge>
    )
  }
  if (isCurrentMonth) {
    return (
      <Badge className="border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-400">
        In Progress
      </Badge>
    )
  }
  return (
    <Badge className="border-transparent bg-yellow-500/15 text-yellow-700 dark:text-yellow-500">
      Not Finalized
    </Badge>
  )
}
