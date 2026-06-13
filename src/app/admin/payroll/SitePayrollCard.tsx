'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
import { formatINR } from '@/lib/payroll'
import { MonthStatusBadge } from './MonthStatusBadge'
import { CATEGORY_LABELS, type ConsolidatedSite, type MonthBreakdown } from './types'

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
            <TableHead className="text-right">Total Wage</TableHead>
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

export function SitePayrollCard({ site }: { site: ConsolidatedSite }) {
  const [expanded, setExpanded] = useState(false)
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())

  function toggleMonth(yearMonth: string) {
    setOpenMonths((prev) => {
      const next = new Set(prev)
      if (next.has(yearMonth)) next.delete(yearMonth)
      else next.add(yearMonth)
      return next
    })
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        {/* Collapsed header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            className="flex items-center gap-2 text-left"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{site.siteName}</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  {site.siteCode}
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                {site.cityName} · {site.stateName}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-lg font-semibold">{formatINR(site.totalWageAllTime)}</p>
              <p className="text-xs text-muted-foreground">total all time</p>
            </div>
            <Link href={`/admin/payroll/sites/${site.siteId}`}>
              <Button variant="outline" size="sm">
                View Details
              </Button>
            </Link>
          </div>
        </div>

        {/* Expanded: month-by-month table */}
        {expanded && (
          <div className="rounded-md border overflow-x-auto">
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
                  <TableHead className="text-right">Total Wage</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {site.months.map((m) => {
                  const fullDays = m.workers.reduce((s, w) => s + w.fullDays, 0)
                  const halfDays = m.workers.reduce((s, w) => s + w.halfDays, 0)
                  const otTwoHr = m.workers.reduce((s, w) => s + w.otTwoHr, 0)
                  const otFourHr = m.workers.reduce((s, w) => s + w.otFourHr, 0)
                  const isOpen = openMonths.has(m.yearMonth)
                  return (
                    <Fragment key={m.yearMonth}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleMonth(m.yearMonth)}
                      >
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
                        <TableCell className="text-right font-medium">
                          {formatINR(m.totalWage)}
                        </TableCell>
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
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
