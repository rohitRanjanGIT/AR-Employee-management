'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import { finalizePayroll } from '@/actions/payroll-finalization'
import { computeMaxRecoverable, formatINR, formatYearMonth } from '@/lib/payroll'

type WorkerPreview = {
  workerId: string
  workerName: string
  workerCategory: string
  fullDays: number
  halfDays: number
  otTwoHrCount: number
  otFourHrCount: number
  grossWage: number
  hasEditedRows: boolean
  outstanding: number
}

type Preview = {
  siteId: string
  siteName: string
  siteCode: string
  cityId: string
  cityName: string
  stateName: string
  yearMonth: string
  workers: WorkerPreview[]
  totalGrossWage: number
  pendingAdvances: { workerId: string; workerName: string }[]
}

type RowState = { amount: string; reason: string; recovery: string }
type AdjustmentState = Record<string, RowState>

function parseNum(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function FinalizationReview({
  preview,
  earlierUnfinalized,
}: {
  preview: Preview
  earlierUnfinalized: string[]
}) {
  const router = useRouter()
  // Initialize recovery pre-filled to max-recoverable at zero adjustment.
  const [adjustments, setAdjustments] = useState<AdjustmentState>(() => {
    const init: AdjustmentState = {}
    for (const w of preview.workers) {
      const maxRec = computeMaxRecoverable(w.grossWage, w.outstanding)
      init[w.workerId] = { amount: '', reason: '', recovery: maxRec > 0 ? String(maxRec) : '' }
    }
    return init
  })
  const [warningDismissed, setWarningDismissed] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const backHref = `/admin/payroll/sites/${preview.siteId}`
  const pendingBlock = preview.pendingAdvances.length > 0

  function setRow(workerId: string, patch: Partial<RowState>) {
    setAdjustments((prev) => {
      const cur = prev[workerId] ?? { amount: '', reason: '', recovery: '' }
      return { ...prev, [workerId]: { ...cur, ...patch } }
    })
  }

  const rows = useMemo(
    () =>
      preview.workers.map((w) => {
        const st = adjustments[w.workerId]
        const amount = parseNum(st?.amount ?? '')
        const reason = st?.reason ?? ''
        const adjustedWage = w.grossWage + amount
        const adjustedNegative = adjustedWage < 0
        const maxRecoverable = computeMaxRecoverable(Math.max(0, adjustedWage), w.outstanding)
        const recoveryRaw = parseNum(st?.recovery ?? '')
        const recoveryError = recoveryRaw < 0 || recoveryRaw > maxRecoverable
        const recovery = Math.min(Math.max(0, recoveryRaw), maxRecoverable)
        const netPaid = adjustedWage - recovery
        const carryForward = w.outstanding - recovery
        const reasonMissing = amount !== 0 && reason.trim() === ''
        return {
          worker: w,
          amount,
          reason,
          adjustedWage,
          adjustedNegative,
          maxRecoverable,
          recoveryRaw,
          recovery,
          recoveryError,
          netPaid,
          carryForward,
          reasonMissing,
        }
      }),
    [preview.workers, adjustments]
  )

  const totals = useMemo(() => {
    const gross = rows.reduce((s, r) => s + r.worker.grossWage, 0)
    const adjustment = rows.reduce((s, r) => s + r.amount, 0)
    const recovery = rows.reduce((s, r) => s + r.recovery, 0)
    const net = rows.reduce((s, r) => s + r.netPaid, 0)
    return { gross, adjustment, recovery, net }
  }, [rows])

  const hasReasonError = rows.some((r) => r.reasonMissing)
  const hasRecoveryError = rows.some((r) => r.recoveryError)
  const hasNegativeAdjusted = rows.some((r) => r.adjustedNegative)
  const canFinalize =
    !pendingBlock &&
    !hasReasonError &&
    !hasRecoveryError &&
    !hasNegativeAdjusted &&
    !isPending

  function handleConfirm() {
    setError('')
    startTransition(async () => {
      try {
        await finalizePayroll({
          siteId: preview.siteId,
          yearMonth: preview.yearMonth,
          adjustments: rows
            .filter((r) => r.amount !== 0 || r.recovery > 0)
            .map((r) => ({
              workerId: r.worker.workerId,
              adjustmentAmount: r.amount,
              adjustmentReason: r.reason.trim() || undefined,
              recovery: r.recovery,
            })),
        })
        setConfirmOpen(false)
        router.push(backHref)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Finalization failed')
      }
    })
  }

  return (
    <div className="space-y-4">
      <Link href={backHref} className="text-sm text-primary hover:underline">
        ← Back to Site Payroll
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{preview.siteName}</h1>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
              {preview.siteCode}
            </code>
          </div>
          <p className="text-sm text-muted-foreground">
            {preview.cityName} · {preview.stateName} · Finalizing{' '}
            <span className="font-medium text-foreground">
              {formatYearMonth(preview.yearMonth)}
            </span>
          </p>
        </div>
      </div>

      {/* Pending-advance HARD BLOCK (§5.2) */}
      {pendingBlock && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">
            Finalization is blocked: {preview.pendingAdvances.length} worker(s) in this cycle have a
            pending advance request (
            {preview.pendingAdvances.map((p) => p.workerName).join(', ')}). Resolve them in the{' '}
            <Link href="/admin/advances" className="font-medium underline">
              advances queue
            </Link>{' '}
            (approve or reject) before finalizing.
          </p>
        </div>
      )}

      {earlierUnfinalized.length > 0 && !warningDismissed && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            The following earlier months for this site have not been finalized yet:{' '}
            <span className="font-medium">
              {earlierUnfinalized.map((ym) => formatYearMonth(ym)).join(', ')}
            </span>
            . You can still proceed.
          </p>
          <button
            type="button"
            onClick={() => setWarningDismissed(true)}
            className="shrink-0 text-yellow-800/70 hover:text-yellow-800 dark:text-yellow-300/70 dark:hover:text-yellow-300"
            aria-label="Dismiss warning"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Worker</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead>Edited?</TableHead>
              <TableHead className="text-right">Adjustment</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="text-right">Recovery</TableHead>
              <TableHead className="text-right">Net Pay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.worker.workerId}>
                <TableCell className="font-medium">
                  {r.worker.workerName}
                  <span className="block text-xs text-muted-foreground">
                    {r.worker.fullDays}F / {r.worker.halfDays}H · OT {r.worker.otTwoHrCount}×2h{' '}
                    {r.worker.otFourHrCount}×4h
                  </span>
                </TableCell>
                <TableCell className="text-right">{formatINR(r.worker.grossWage)}</TableCell>
                <TableCell>
                  {r.worker.hasEditedRows ? (
                    <Link
                      href={`/admin/attendance?siteId=${preview.siteId}&workerId=${r.worker.workerId}&month=${preview.yearMonth}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Edited
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={adjustments[r.worker.workerId]?.amount ?? ''}
                    onChange={(e) => setRow(r.worker.workerId, { amount: e.target.value })}
                    placeholder="0"
                    className="h-8 w-24 text-right"
                    aria-invalid={r.adjustedNegative}
                  />
                  {r.adjustedNegative && (
                    <span className="block text-xs text-destructive">wage negative</span>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    value={adjustments[r.worker.workerId]?.reason ?? ''}
                    onChange={(e) => setRow(r.worker.workerId, { reason: e.target.value })}
                    placeholder={r.amount !== 0 ? 'Required' : '—'}
                    disabled={r.amount === 0}
                    aria-invalid={r.reasonMissing}
                    className="h-8 w-36"
                  />
                </TableCell>
                <TableCell className="text-right">{formatINR(r.worker.outstanding)}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={adjustments[r.worker.workerId]?.recovery ?? ''}
                    onChange={(e) => setRow(r.worker.workerId, { recovery: e.target.value })}
                    placeholder="0"
                    disabled={r.maxRecoverable === 0}
                    aria-invalid={r.recoveryError}
                    className="h-8 w-24 text-right"
                  />
                  <span className="block text-xs text-muted-foreground">
                    max {formatINR(r.maxRecoverable)}
                  </span>
                  {r.carryForward > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      {formatINR(r.carryForward)} carries
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">{formatINR(r.netPaid)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hasReasonError && (
        <p className="text-xs text-destructive">
          A reason is required for every worker with a non-zero adjustment.
        </p>
      )}
      {hasRecoveryError && (
        <p className="text-xs text-destructive">
          Recovery must be between 0 and the max recoverable for each worker.
        </p>
      )}
      {hasNegativeAdjusted && (
        <p className="text-xs text-destructive">
          A worker&apos;s adjusted wage is negative — reduce the deduction before finalizing.
        </p>
      )}

      {/* Sticky summary footer */}
      <div className="sticky bottom-0 rounded-lg border bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              Gross: <span className="font-medium text-foreground">{formatINR(totals.gross)}</span>
            </span>
            <span className="text-muted-foreground">
              Adjustments:{' '}
              <span className="font-medium text-foreground">{formatINR(totals.adjustment)}</span>
            </span>
            <span className="text-muted-foreground">
              Recovery:{' '}
              <span className="font-medium text-foreground">{formatINR(totals.recovery)}</span>
            </span>
            <span className="text-muted-foreground">
              Net Pay: <span className="font-semibold text-foreground">{formatINR(totals.net)}</span>
            </span>
          </div>
          <Button
            variant="destructive"
            disabled={!canFinalize}
            onClick={() => {
              setError('')
              setConfirmOpen(true)
            }}
          >
            Confirm Finalization
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(o) => !isPending && setConfirmOpen(o)}>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Finalize Payroll</DialogTitle>
          <div className="mt-1 space-y-3">
            <p className="text-sm text-muted-foreground">
              You are about to finalize payroll for{' '}
              <span className="font-medium text-foreground">{preview.siteName}</span> —{' '}
              <span className="font-medium text-foreground">
                {formatYearMonth(preview.yearMonth)}
              </span>
              . This locks all attendance records for this period and cannot be undone except via
              corrections.
            </p>
            <p className="text-sm">
              Net payout: <span className="font-semibold">{formatINR(totals.net)}</span> across{' '}
              {preview.workers.length} worker{preview.workers.length !== 1 ? 's' : ''}
              {totals.recovery > 0 && (
                <>
                  {' '}
                  (after {formatINR(totals.recovery)} advance recovery)
                </>
              )}
              .
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter className="mt-2">
            <DialogClose render={<Button variant="outline" type="button" disabled={isPending} />}>
              Cancel
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
              {isPending ? 'Finalizing…' : 'Confirm & Finalize'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
