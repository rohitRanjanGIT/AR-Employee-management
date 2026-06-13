'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatINR } from '@/lib/payroll'
import { MonthStatusBadge } from '../../MonthStatusBadge'
import { CATEGORY_LABELS, type ConsolidatedSite, type MonthBreakdown } from '../../types'

const selectClass =
  'rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30'

function WorkerBreakdownTable({ month }: { month: MonthBreakdown }) {
  return (
    <div className="rounded-md border bg-muted/30 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Worker</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Full Days</TableHead>
            <TableHead className="text-right">Half Days</TableHead>
            <TableHead className="text-right">OT 2hr</TableHead>
            <TableHead className="text-right">OT 4hr</TableHead>
            <TableHead className="text-right">Wages</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {month.workers.map((w) => (
            <TableRow key={w.workerId}>
              <TableCell>
                <Link
                  href={`/admin/payroll/workers/${w.workerId}`}
                  className="text-primary hover:underline"
                >
                  {w.workerName}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {CATEGORY_LABELS[w.workerCategory] ?? w.workerCategory}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{w.fullDays}</TableCell>
              <TableCell className="text-right">{w.halfDays}</TableCell>
              <TableCell className="text-right">{w.otTwoHr}</TableCell>
              <TableCell className="text-right">{w.otFourHr}</TableCell>
              <TableCell className="text-right font-medium">{formatINR(w.totalWage)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function SitePayrollOverview({
  site,
  months,
}: {
  site: ConsolidatedSite
  months: { value: string; label: string }[]
}) {
  const [monthFilter, setMonthFilter] = useState('')
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())

  function toggleMonth(yearMonth: string) {
    setOpenMonths((prev) => {
      const next = new Set(prev)
      if (next.has(yearMonth)) next.delete(yearMonth)
      else next.add(yearMonth)
      return next
    })
  }

  const visibleMonths = monthFilter
    ? site.months.filter((m) => m.yearMonth === monthFilter)
    : site.months

  return (
    <div className="space-y-4">
      <Link href="/admin/payroll" className="text-sm text-primary hover:underline">
        ← Back to Payroll
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{site.siteName}</h1>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
              {site.siteCode}
            </code>
          </div>
          <p className="text-sm text-muted-foreground">
            {site.cityName} · {site.stateName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">{formatINR(site.totalWageAllTime)}</p>
          <p className="text-xs text-muted-foreground">Worker wages across all months</p>
        </div>
      </div>

      <div className="flex justify-end">
        <select
          className={selectClass}
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        >
          <option value="">All Months</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Workers</TableHead>
              <TableHead className="text-right">Full Days</TableHead>
              <TableHead className="text-right">Half Days</TableHead>
              <TableHead className="text-right">OT 2hr</TableHead>
              <TableHead className="text-right">OT 4hr</TableHead>
              <TableHead
                className="text-right"
                title="More expense categories (advances, materials) will appear here in future modules."
              >
                Worker Wages
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleMonths.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-20 text-center text-muted-foreground">
                  No data for the selected month.
                </TableCell>
              </TableRow>
            ) : (
              visibleMonths.map((m) => {
                const fullDays = m.workers.reduce((s, w) => s + w.fullDays, 0)
                const halfDays = m.workers.reduce((s, w) => s + w.halfDays, 0)
                const otTwoHr = m.workers.reduce((s, w) => s + w.otTwoHr, 0)
                const otFourHr = m.workers.reduce((s, w) => s + w.otFourHr, 0)
                const isOpen = openMonths.has(m.yearMonth)
                return (
                  <Fragment key={m.yearMonth}>
                    <TableRow className="cursor-pointer" onClick={() => toggleMonth(m.yearMonth)}>
                      <TableCell>
                        {isOpen ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-right">{m.workerCount}</TableCell>
                      <TableCell className="text-right">{fullDays}</TableCell>
                      <TableCell className="text-right">{halfDays}</TableCell>
                      <TableCell className="text-right">{otTwoHr}</TableCell>
                      <TableCell className="text-right">{otFourHr}</TableCell>
                      <TableCell className="text-right font-medium">{formatINR(m.totalWage)}</TableCell>
                      <TableCell>
                        <MonthStatusBadge
                          isCurrentMonth={m.isCurrentMonth}
                          isFinalized={m.isFinalized}
                        />
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={9} className="p-2">
                          <WorkerBreakdownTable month={m} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
