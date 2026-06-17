'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { computeRowWage, formatINR } from '@/lib/payroll'

export type AttendanceRecord = {
  id: string
  date: string
  morningMarkedAt: Date | null
  eveningMarkedAt: Date | null
  ot: 'none' | '2hr' | '4hr'
  derivedStatus: 'full' | 'half' | 'absent'
  isMorningLate: boolean
  isEveningLate: boolean
  isEdited: boolean
  isLocked: boolean
  wageDailySnapshot: string
  otRateSnapshot: string | null
  worker: { id: string; name: string; category: string }
  site: { id: string; name: string; city: { name: string } }
  morningMarkedByEmployee: { name: string } | null
  eveningMarkedByEmployee: { name: string } | null
}

export const CATEGORY_LABELS: Record<string, string> = {
  skilled: 'Skilled',
  semi_skilled: 'Semi-Skilled',
  helper: 'Helper',
}

/** Wage earned for a single attendance row (payroll formula). 'absent' → 0. */
export function rowWage(r: AttendanceRecord): number {
  if (r.derivedStatus === 'absent') return 0
  return computeRowWage({
    derivedStatus: r.derivedStatus,
    wageDailySnapshot: Number(r.wageDailySnapshot),
    otRateSnapshot: r.otRateSnapshot != null ? Number(r.otRateSnapshot) : null,
    ot: r.ot,
  })
}

function MarkCell({ at, late }: { at: Date | null; late: boolean }) {
  if (!at) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-green-600">✓</span>
      {late && (
        <Badge variant="outline" className="text-xs text-amber-600">
          Late
        </Badge>
      )}
    </span>
  )
}

function StatusBadge({ status }: { status: 'full' | 'half' | 'absent' }) {
  if (status === 'full') return <Badge variant="default" className="text-xs">Full</Badge>
  if (status === 'half') return <Badge variant="outline" className="text-xs">Half</Badge>
  return <Badge variant="destructive" className="text-xs">Absent</Badge>
}

/**
 * Per-worker attendance detail for a single site-day.
 * Shared by the Records ledger and the Overview site-wise expansion.
 */
export function DayDetail({
  records,
  onEdit,
}: {
  records: AttendanceRecord[]
  onEdit: (r: AttendanceRecord) => void
}) {
  return (
    <div className="px-4 py-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Worker</TableHead>
            <TableHead className="text-xs">Category</TableHead>
            <TableHead className="text-xs">Morning</TableHead>
            <TableHead className="text-xs">Evening</TableHead>
            <TableHead className="text-xs">OT</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Flags</TableHead>
            <TableHead className="text-xs text-right">Pay</TableHead>
            <TableHead className="text-xs text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="py-2 text-sm font-medium">{r.worker.name}</TableCell>
              <TableCell className="py-2">
                <Badge variant="outline" className="text-xs">
                  {CATEGORY_LABELS[r.worker.category] ?? r.worker.category}
                </Badge>
              </TableCell>
              <TableCell className="py-2">
                <MarkCell at={r.morningMarkedAt} late={r.isMorningLate} />
              </TableCell>
              <TableCell className="py-2">
                <MarkCell at={r.eveningMarkedAt} late={r.isEveningLate} />
              </TableCell>
              <TableCell className="py-2">
                {r.ot === 'none' ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    {r.ot}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="py-2">
                <StatusBadge status={r.derivedStatus} />
              </TableCell>
              <TableCell className="py-2">
                <div className="flex gap-1">
                  {r.isEdited && (
                    <Badge variant="outline" className="text-xs text-yellow-600">
                      Edited
                    </Badge>
                  )}
                  {r.isLocked && (
                    <Badge variant="outline" className="text-xs text-blue-600">
                      Locked
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-2 text-right text-sm tabular-nums">
                {formatINR(rowWage(r))}
              </TableCell>
              <TableCell className="py-2 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={r.isLocked}
                  onClick={() => onEdit(r)}
                >
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
