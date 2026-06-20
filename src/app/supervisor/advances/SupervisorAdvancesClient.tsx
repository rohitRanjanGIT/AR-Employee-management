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
import { submitAdvanceRequest } from '@/actions/advances'
import { formatINR } from '@/lib/payroll'
import { formatDate, cn } from '@/lib/utils'

type Worker = { id: string; name: string; cityName: string; outstanding: number }
type Request = {
  id: string
  workerName: string
  amount: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejectionReason: string | null
  createdAt: string
}
type Tab = 'balances' | 'requests'

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

export function SupervisorAdvancesClient({
  workers,
  requests,
}: {
  workers: Worker[]
  requests: Request[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('balances')

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
        await submitAdvanceRequest({ workerId, amount: parsed, reason: reason.trim() })
        setOpen(false)
        reset()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not submit request')
      }
    })
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'balances', label: 'Balances' },
    { key: 'requests', label: 'My Requests' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Advances</h1>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            if (!o) reset()
            setOpen(o)
          }}
        >
          <DialogTrigger render={<Button disabled={workers.length === 0}>Request Advance</Button>} />
          <DialogContent showCloseButton={false}>
            <DialogTitle>Request Advance</DialogTitle>
            <div className="mt-1 space-y-4">
              <div className="space-y-1.5">
                <Label>Worker</Label>
                <Select
                  value={workerId}
                  onValueChange={(v: string | null) => {
                    setWorkerId(v ?? '')
                    setWorkerName(workers.find((w) => w.id === v)?.name ?? '')
                  }}
                >
                  <SelectTrigger className="w-full">
                    <span className={workerName ? 'text-foreground' : 'text-muted-foreground'}>
                      {workerName || 'Select a worker'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} · {w.cityName}
                        {w.outstanding !== 0 ? ` · owes ${formatINR(w.outstanding)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {workerId && (
                  <p className="text-xs text-muted-foreground">
                    Current outstanding:{' '}
                    {formatINR(workers.find((w) => w.id === workerId)?.outstanding ?? 0)}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adv-amount">Amount (₹)</Label>
                <Input
                  id="adv-amount"
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adv-reason">Reason</Label>
                <Input
                  id="adv-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Medical, festival advance"
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
                {isPending ? 'Submitting…' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-2 text-sm font-medium -mb-px border-b-2',
              tab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

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
              {workers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                    No workers at your sites yet.
                  </TableCell>
                </TableRow>
              ) : (
                workers.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/supervisor/advances/${w.id}`}
                        className="text-primary hover:underline"
                      >
                        {w.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{w.cityName}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatINR(w.outstanding)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {tab === 'requests' && (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    No advance requests yet.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.workerName}</TableCell>
                    <TableCell className="text-right">{formatINR(r.amount)}</TableCell>
                    <TableCell className="max-w-xs">
                      <span className="text-sm">{r.reason ?? '—'}</span>
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
                      {formatDate(r.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
