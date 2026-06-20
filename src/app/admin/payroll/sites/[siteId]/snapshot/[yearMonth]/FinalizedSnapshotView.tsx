'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { AddCorrectionDialog, type CorrectionContext } from '@/components/AddCorrectionDialog'
import { formatINR, formatYearMonth } from '@/lib/payroll'
import { formatDate, formatDateTime } from '@/lib/utils'
import { CATEGORY_LABELS } from '../../../../types'

type Correction = {
  id: string
  amount: number
  reason: string | null
  finalizedAt: string
  finalizedBy: string
}

type SnapshotWorker = {
  snapshotId: string
  workerId: string
  workerName: string
  workerCategory: string
  fullDays: number
  halfDays: number
  otTwoHrCount: number
  otFourHrCount: number
  grossWage: number
  adjustmentAmount: number
  adjustmentReason: string | null
  finalWage: number
  advanceRecovered: number
  netPaid: number
  currentTotal: number
  corrections: Correction[]
}

export type SnapshotViewModel = {
  siteId: string
  yearMonth: string
  finalizedAt: string
  finalizedBy: string
  site: { name: string; code: string; cityName: string; stateName: string }
  grandTotal: number
  workers: SnapshotWorker[]
}

export function FinalizedSnapshotView({ model }: { model: SnapshotViewModel }) {
  const [correctionCtx, setCorrectionCtx] = useState<CorrectionContext | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const siteLabel = `${model.site.name} (${model.site.code})`
  const monthLabel = formatYearMonth(model.yearMonth)

  function openCorrection(w: SnapshotWorker) {
    setCorrectionCtx({
      siteId: model.siteId,
      workerId: w.workerId,
      yearMonth: model.yearMonth,
      workerName: w.workerName,
      siteLabel,
      monthLabel,
    })
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <Link
        href={`/admin/payroll/sites/${model.siteId}`}
        className="text-sm text-primary hover:underline"
      >
        ← Back to Site Payroll
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{model.site.name}</h1>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
              {model.site.code}
            </code>
            <Badge className="border-transparent bg-green-500/15 text-green-700 dark:text-green-400">
              Finalized
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {model.site.cityName} · {model.site.stateName} · {monthLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            Finalized by {model.finalizedBy} on {formatDateTime(model.finalizedAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">{formatINR(model.grandTotal)}</p>
          <p className="text-xs text-muted-foreground">Grand total (current)</p>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Worker</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Full</TableHead>
              <TableHead className="text-right">Half</TableHead>
              <TableHead className="text-right">OT 2hr</TableHead>
              <TableHead className="text-right">OT 4hr</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Adjustment</TableHead>
              <TableHead className="text-right">Final</TableHead>
              <TableHead className="text-right">Recovered</TableHead>
              <TableHead className="text-right">Net Paid</TableHead>
              <TableHead>Corrections</TableHead>
              <TableHead className="text-right">Current Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {model.workers.map((w) => (
              <TableRow key={w.snapshotId}>
                <TableCell className="font-medium">{w.workerName}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {CATEGORY_LABELS[w.workerCategory] ?? w.workerCategory}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{w.fullDays}</TableCell>
                <TableCell className="text-right">{w.halfDays}</TableCell>
                <TableCell className="text-right">{w.otTwoHrCount}</TableCell>
                <TableCell className="text-right">{w.otFourHrCount}</TableCell>
                <TableCell className="text-right">{formatINR(w.grossWage)}</TableCell>
                <TableCell className="text-right">
                  {w.adjustmentAmount === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span title={w.adjustmentReason ?? undefined}>
                      {w.adjustmentAmount > 0 ? '+' : '−'}
                      {formatINR(Math.abs(w.adjustmentAmount))}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">{formatINR(w.finalWage)}</TableCell>
                <TableCell className="text-right">
                  {w.advanceRecovered === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-500">
                      −{formatINR(w.advanceRecovered)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">{formatINR(w.netPaid)}</TableCell>
                <TableCell>
                  {w.corrections.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {w.corrections.map((c) => (
                        <Popover key={c.id}>
                          <PopoverTrigger
                            nativeButton={false}
                            render={
                              <span className="cursor-pointer rounded bg-muted px-1.5 py-0.5 text-xs font-medium" />
                            }
                          >
                            {c.amount > 0 ? '+' : '−'}
                            {formatINR(Math.abs(c.amount))}
                          </PopoverTrigger>
                          <PopoverContent className="w-60 text-xs">
                            <p className="font-medium">
                              {c.amount > 0 ? '+' : '−'}
                              {formatINR(Math.abs(c.amount))}
                            </p>
                            {c.reason && <p className="mt-1 text-muted-foreground">{c.reason}</p>}
                            <p className="mt-1 text-muted-foreground">
                              {c.finalizedBy} · {formatDate(c.finalizedAt)}
                            </p>
                          </PopoverContent>
                        </Popover>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatINR(w.currentTotal)}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => openCorrection(w)}>
                    Add Correction
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end border-t py-3 text-sm">
        Grand Total (current):{' '}
        <span className="ml-2 font-semibold">{formatINR(model.grandTotal)}</span>
      </div>

      <AddCorrectionDialog
        context={correctionCtx}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  )
}
