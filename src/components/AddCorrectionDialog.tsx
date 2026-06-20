'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import { addPayrollCorrection } from '@/actions/payroll-finalization'
import { formatINR } from '@/lib/payroll'

export type CorrectionContext = {
  siteId: string
  workerId: string
  yearMonth: string
  workerName: string
  siteLabel: string // e.g. "Skyline Towers (SKY01)"
  monthLabel: string // e.g. "June 2026"
}

export function AddCorrectionDialog({
  context,
  open,
  onOpenChange,
}: {
  context: CorrectionContext | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function reset() {
    setAmount('')
    setReason('')
    setError('')
  }

  const parsed = Number(amount)
  const amountValid = amount.trim() !== '' && Number.isFinite(parsed) && parsed !== 0
  const canSubmit = !!context && amountValid && reason.trim() !== '' && !isPending

  function handleSubmit() {
    if (!context || !canSubmit) return
    setError('')
    startTransition(async () => {
      try {
        await addPayrollCorrection({
          siteId: context.siteId,
          workerId: context.workerId,
          yearMonth: context.yearMonth,
          amount: parsed,
          reason: reason.trim(),
        })
        onOpenChange(false)
        reset()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not add correction')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogTitle>Add Correction</DialogTitle>
        {context && (
          <div className="mt-1 space-y-4">
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium">{context.workerName}</p>
              <p className="text-muted-foreground">
                {context.siteLabel} · {context.monthLabel}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="correction-amount">Amount</Label>
              <Input
                id="correction-amount"
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Positive adds to the payout, negative deducts.
                {amountValid && (
                  <span className="ml-1 text-foreground">
                    ({parsed >= 0 ? '+' : '−'}
                    {formatINR(Math.abs(parsed))})
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="correction-reason">Reason</Label>
              <Input
                id="correction-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Bonus, tool damage recovery"
                autoComplete="off"
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter className="mt-2">
          <DialogClose render={<Button variant="outline" type="button" disabled={isPending} />}>
            Cancel
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? 'Saving…' : 'Add Correction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
