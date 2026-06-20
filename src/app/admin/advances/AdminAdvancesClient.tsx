'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  approveAdvance,
  rejectAdvance,
  createAdvanceDirect,
} from '@/actions/advances'
import { formatINR } from '@/lib/payroll'
import { formatDate, cn } from '@/lib/utils'

type Pending = {
  id: string
  workerId: string
  workerName: string
  amount: number
  reason: string | null
  requestedBy: string
  createdAt: string
  outstanding: number
}
type Ledger = {
  id: string
  workerId: string
  workerName: string
  type: 'issuance' | 'recovery'
  amount: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejectionReason: string | null
  createdBy: string
  approvedBy: string | null
  createdAt: string
  isRecovery: boolean
}
type Balance = { id: string; name: string; cityName: string; outstanding: number }

type Tab = 'pending' | 'balances' | 'history'

function StatusBadge({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  if (status === 'approved')
    return (
      <Badge className="border-transparent bg-green-500/15 text-green-700 dark:text-green-400">
        Approved
      </Badge>
    )
  if (status === 'rejected')
    return <Badge className="border-transparent bg-destructive/15 text-destructive">Rejected</Badge>
  return (
    <Badge className="border-transparent bg-yellow-500/15 text-yellow-700 dark:text-yellow-500">
      Pending
    </Badge>
  )
}

export function AdminAdvancesClient({
  pending,
  ledger,
  balances,
}: {
  pending: Pending[]
  ledger: Ledger[]
  balances: Balance[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('balances')

  // Approve (edit-approve) dialog
  const [approveTarget, setApproveTarget] = useState<Pending | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Pending | null>(null)

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'balances', label: 'Balances' },
    { key: 'pending', label: 'Pending', count: pending.length },
    { key: 'history', label: 'History' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Advances</h1>
        <DirectAdvanceDialog balances={balances} onDone={() => router.refresh()} />
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'relative px-3 py-2 text-sm font-medium -mb-px border-b-2',
              tab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs text-primary">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'pending' && (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                    No pending advance requests.
                  </TableCell>
                </TableRow>
              ) : (
                pending.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/advances/${p.workerId}`}
                        className="text-primary hover:underline"
                      >
                        {p.workerName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{formatINR(p.amount)}</TableCell>
                    <TableCell className="max-w-xs text-sm">{p.reason ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.requestedBy}</TableCell>
                    <TableCell className="text-right">{formatINR(p.outstanding)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => setApproveTarget(p)}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setRejectTarget(p)}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {tab === 'balances' && (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.filter((b) => b.outstanding !== 0).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                    No workers currently carry an advance balance.
                  </TableCell>
                </TableRow>
              ) : (
                balances
                  .filter((b) => b.outstanding !== 0)
                  .sort((a, b) => b.outstanding - a.outstanding)
                  .map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/advances/${b.id}`}
                          className="text-primary hover:underline"
                        >
                          {b.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.cityName}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatINR(b.outstanding)}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {tab === 'history' && (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                    No advance activity yet.
                  </TableCell>
                </TableRow>
              ) : (
                ledger.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/advances/${r.workerId}`}
                        className="text-primary hover:underline"
                      >
                        {r.workerName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.isRecovery ? 'Recovery' : 'Issuance'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.isRecovery ? '−' : ''}
                      {formatINR(r.amount)}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm">
                      {r.reason ?? (r.isRecovery ? 'Payroll recovery' : '—')}
                      {r.status === 'rejected' && r.rejectionReason && (
                        <span className="block text-xs text-destructive">
                          Rejected: {r.rejectionReason}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.approvedBy ?? r.createdBy}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <ApproveAdvanceDialog
        target={approveTarget}
        onClose={() => setApproveTarget(null)}
        onDone={() => {
          setApproveTarget(null)
          router.refresh()
        }}
      />
      <RejectAdvanceDialog
        target={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onDone={() => {
          setRejectTarget(null)
          router.refresh()
        }}
      />
    </div>
  )
}

// ─── Approve (edit-approve) ───────────────────────────────────────────────────

function ApproveAdvanceDialog({
  target,
  onClose,
  onDone,
}: {
  target: Pending | null
  onClose: () => void
  onDone: () => void
}) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Pre-fill from the request whenever a new target opens.
  const [lastId, setLastId] = useState<string | null>(null)
  if (target && target.id !== lastId) {
    setLastId(target.id)
    setAmount(String(target.amount))
    setReason(target.reason ?? '')
    setError('')
  }

  const parsed = Number(amount)
  const amountValid = Number.isInteger(parsed) && parsed > 0
  const canSubmit = !!target && amountValid && reason.trim() !== '' && !isPending

  function handleApprove() {
    if (!target || !canSubmit) return
    setError('')
    startTransition(async () => {
      try {
        await approveAdvance({ advanceId: target.id, amount: parsed, reason: reason.trim() })
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not approve')
      }
    })
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogTitle>Approve Advance</DialogTitle>
        {target && (
          <div className="mt-1 space-y-4">
            <p className="text-sm text-muted-foreground">
              {target.workerName} · requested {formatINR(target.amount)} · outstanding{' '}
              {formatINR(target.outstanding)}. You may adjust the amount/reason before approving.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="approve-amount">Approved Amount (₹)</Label>
              <Input
                id="approve-amount"
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approve-reason">Reason</Label>
              <Input
                id="approve-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
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
          <Button onClick={handleApprove} disabled={!canSubmit}>
            {isPending ? 'Approving…' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Reject ───────────────────────────────────────────────────────────────────

function RejectAdvanceDialog({
  target,
  onClose,
  onDone,
}: {
  target: Pending | null
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [lastId, setLastId] = useState<string | null>(null)
  if (target && target.id !== lastId) {
    setLastId(target.id)
    setReason('')
    setError('')
  }

  const canSubmit = !!target && reason.trim() !== '' && !isPending

  function handleReject() {
    if (!target || !canSubmit) return
    setError('')
    startTransition(async () => {
      try {
        await rejectAdvance({ advanceId: target.id, rejectionReason: reason.trim() })
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not reject')
      }
    })
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogTitle>Reject Advance</DialogTitle>
        {target && (
          <div className="mt-1 space-y-4">
            <p className="text-sm text-muted-foreground">
              Reject {target.workerName}&apos;s request for {formatINR(target.amount)}. A reason is
              required.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="reject-reason">Rejection Reason</Label>
              <Input
                id="reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
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
          <Button variant="destructive" onClick={handleReject} disabled={!canSubmit}>
            {isPending ? 'Rejecting…' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Direct entry ─────────────────────────────────────────────────────────────

function DirectAdvanceDialog({
  balances,
  onDone,
}: {
  balances: Balance[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [workerId, setWorkerId] = useState('')
  const [workerName, setWorkerName] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function reset() {
    setWorkerId('')
    setWorkerName('')
    setAmount('')
    setReason('')
    setError('')
  }

  const parsed = Number(amount)
  const amountValid = amount.trim() !== '' && Number.isInteger(parsed) && parsed > 0
  const canSubmit = workerId !== '' && amountValid && reason.trim() !== '' && !isPending

  function handleSubmit() {
    if (!canSubmit) return
    setError('')
    startTransition(async () => {
      try {
        await createAdvanceDirect({ workerId, amount: parsed, reason: reason.trim() })
        setOpen(false)
        reset()
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not record advance')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        setOpen(o)
      }}
    >
      <DialogTrigger render={<Button>Record Advance</Button>} />
      <DialogContent showCloseButton={false}>
        <DialogTitle>Record Advance</DialogTitle>
        <div className="mt-1 space-y-4">
          <p className="text-sm text-muted-foreground">
            Directly record an advance you have already paid a worker. It counts toward their
            balance immediately (no approval needed).
          </p>
          <div className="space-y-1.5">
            <Label>Worker</Label>
            <Select
              value={workerId}
              onValueChange={(v: string | null) => {
                setWorkerId(v ?? '')
                setWorkerName(balances.find((b) => b.id === v)?.name ?? '')
              }}
            >
              <SelectTrigger className="w-full">
                <span className={workerName ? 'text-foreground' : 'text-muted-foreground'}>
                  {workerName || 'Select a worker'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {balances.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} · {b.cityName}
                    {b.outstanding !== 0 ? ` · owes ${formatINR(b.outstanding)}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="direct-amount">Amount (₹)</Label>
            <Input
              id="direct-amount"
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 3000"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="direct-reason">Reason</Label>
            <Input
              id="direct-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Cash advance"
              autoComplete="off"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="mt-2">
          <DialogClose render={<Button variant="outline" type="button" disabled={isPending} />}>
            Cancel
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? 'Recording…' : 'Record Advance'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
