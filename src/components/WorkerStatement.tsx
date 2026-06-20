'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getWorkerStatement, type WorkerStatement as Statement } from '@/actions/advances'
import { formatINR, formatYearMonth } from '@/lib/payroll'
import { formatDate } from '@/lib/utils'

const selectClass =
  'rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30'

const CATEGORY_LABELS: Record<string, string> = {
  skilled: 'Skilled',
  semi_skilled: 'Semi-Skilled',
  helper: 'Helper',
}

export function WorkerStatement({
  initialData,
  backHref,
  backLabel = 'Back to Advances',
}: {
  initialData: Statement
  backHref: string
  backLabel?: string
}) {
  const [data, setData] = useState<Statement>(initialData)
  const [selected, setSelected] = useState<string>(initialData.selectedMonth ?? 'all')
  const [isPending, startTransition] = useTransition()

  // Ensure the currently-selected month is offered even if it has no activity.
  const options = [...data.months]
  if (selected !== 'all' && !options.some((m) => m.value === selected)) {
    options.unshift({ value: selected, label: formatYearMonth(selected) })
  }

  function onChange(value: string) {
    setSelected(value)
    startTransition(async () => {
      const next = await getWorkerStatement(data.workerId, value === 'all' ? undefined : value)
      setData(next)
    })
  }

  const periodLabel = selected === 'all' ? 'All-time' : formatYearMonth(selected)
  const due = data.due
  const duePositive = due >= 0

  return (
    <div className="space-y-4">
      <Link href={backHref} className="text-sm text-primary hover:underline">
        ← {backLabel}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{data.workerName}</h1>
            <Badge variant="outline">
              {CATEGORY_LABELS[data.workerCategory] ?? data.workerCategory}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{data.cityName}</p>
        </div>
        <select
          className={selectClass}
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          disabled={isPending}
        >
          <option value="all">All-time</option>
          {options.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Total Earned</p>
          <p className="mt-1 text-2xl font-semibold">{formatINR(data.earned)}</p>
          <p className="text-xs text-muted-foreground">{periodLabel} wages</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Advance Taken</p>
          <p className="mt-1 text-2xl font-semibold">{formatINR(data.advanceTaken)}</p>
          <p className="text-xs text-muted-foreground">{periodLabel} approved advances</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Due {selected !== 'all' && '(running)'}</p>
          <p
            className={
              'mt-1 text-2xl font-semibold ' +
              (duePositive
                ? 'text-green-700 dark:text-green-400'
                : 'text-destructive')
            }
          >
            {duePositive ? '' : '−'}
            {formatINR(Math.abs(due))}
          </p>
          <p className="text-xs text-muted-foreground">
            {duePositive ? 'Payable to worker' : 'Over-advanced (worker owes)'}
          </p>
        </div>
      </div>

      {/* Detail ledger */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Reason / Recovered against</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.lineItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  No advance activity for {periodLabel.toLowerCase()}.
                </TableCell>
              </TableRow>
            ) : (
              data.lineItems.map((r) => {
                const isRecovery = r.type === 'recovery'
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{isRecovery ? 'Recovery' : 'Advance'}</Badge>
                    </TableCell>
                    <TableCell
                      className={
                        'text-right font-medium ' +
                        (isRecovery ? 'text-amber-600 dark:text-amber-500' : '')
                      }
                    >
                      {isRecovery ? '−' : '+'}
                      {formatINR(r.amount)}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm">
                      {isRecovery ? (r.recoveredAgainst ?? 'Payroll recovery') : (r.reason ?? '—')}
                    </TableCell>
                    <TableCell>
                      {isRecovery ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : r.status === 'approved' ? (
                        <Badge className="border-transparent bg-green-500/15 text-green-700 dark:text-green-400">
                          Approved
                        </Badge>
                      ) : r.status === 'rejected' ? (
                        <Badge className="border-transparent bg-destructive/15 text-destructive">
                          Rejected
                        </Badge>
                      ) : (
                        <Badge className="border-transparent bg-yellow-500/15 text-yellow-700 dark:text-yellow-500">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Due = Total Earned − Advance Taken
        {selected !== 'all' && ' (cumulative through the selected month)'}. Rejected and pending
        advances are excluded from the totals.
      </p>
    </div>
  )
}
