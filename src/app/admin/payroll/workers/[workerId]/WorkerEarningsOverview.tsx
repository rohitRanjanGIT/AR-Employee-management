'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getWorkerLifetimeEarnings } from '@/actions/payroll'
import { formatINR } from '@/lib/payroll'
import { PayrollFilters, type FilterOptions, type Filters } from '../../PayrollFilters'
import { MonthStatusBadge } from '../../MonthStatusBadge'
import { CATEGORY_LABELS } from '../../types'

type WorkerEarnings = {
  workerId: string
  workerName: string
  workerCategory: string
  cityName: string
  totalWageAllTime: number
  sites: {
    siteId: string
    siteName: string
    siteCode: string
    cityName: string
    stateName: string
    totalWage: number
    months: {
      yearMonth: string
      label: string
      isCurrentMonth: boolean
      totalWage: number
      fullDays: number
      halfDays: number
      otTwoHr: number
      otFourHr: number
    }[]
  }[]
}

function SiteCard({ site }: { site: WorkerEarnings['sites'][0] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <CardContent className="space-y-3">
        <button
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="flex items-center gap-2">
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
              <p className="text-xs text-muted-foreground">{site.cityName}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{formatINR(site.totalWage)}</p>
            <p className="text-xs text-muted-foreground">from this site</p>
          </div>
        </button>

        {expanded && (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Full Days</TableHead>
                  <TableHead className="text-right">Half Days</TableHead>
                  <TableHead className="text-right">OT 2hr</TableHead>
                  <TableHead className="text-right">OT 4hr</TableHead>
                  <TableHead className="text-right">Wages</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {site.months.map((m) => (
                  <TableRow key={m.yearMonth}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    <TableCell className="text-right">{m.fullDays}</TableCell>
                    <TableCell className="text-right">{m.halfDays}</TableCell>
                    <TableCell className="text-right">{m.otTwoHr}</TableCell>
                    <TableCell className="text-right">{m.otFourHr}</TableCell>
                    <TableCell className="text-right font-medium">{formatINR(m.totalWage)}</TableCell>
                    <TableCell>
                      <MonthStatusBadge isCurrentMonth={m.isCurrentMonth} isFinalized={false} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function WorkerEarningsOverview({
  workerId,
  initialData,
  filterOptions,
}: {
  workerId: string
  initialData: WorkerEarnings
  filterOptions: FilterOptions
}) {
  const [filters, setFilters] = useState<Filters>({})
  const [data, setData] = useState<WorkerEarnings>(initialData)
  const [isPending, startTransition] = useTransition()

  function applyFilters(next: Filters) {
    setFilters(next)
    startTransition(async () => {
      const result = await getWorkerLifetimeEarnings(workerId, {
        stateId: next.stateId,
        cityId: next.cityId,
        yearMonth: next.yearMonth,
      })
      setData(result)
    })
  }

  return (
    <div className="space-y-4">
      <Link href="/admin/workers" className="text-sm text-primary hover:underline">
        ← Back to Workers
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
        <div className="text-right">
          <p className="text-2xl font-semibold">{formatINR(data.totalWageAllTime)}</p>
          <p className="text-xs text-muted-foreground">Total wages across all sites and months</p>
        </div>
      </div>

      <PayrollFilters
        options={filterOptions}
        filters={filters}
        onChange={applyFilters}
        hideSite
      />

      {isPending ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data.sites.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No earnings match the selected filters.
        </p>
      ) : (
        <div className="space-y-3">
          {data.sites.map((site) => (
            <SiteCard key={site.siteId} site={site} />
          ))}
        </div>
      )}

      {/* Summary totals bar */}
      <div className="sticky bottom-0 flex items-center justify-between border-t bg-background py-3">
        <p className="text-sm text-muted-foreground">
          Showing {data.sites.length} site{data.sites.length !== 1 ? 's' : ''}
        </p>
        <p className="text-sm font-medium">
          Total: <span className="font-semibold">{formatINR(data.totalWageAllTime)}</span>
        </p>
      </div>
    </div>
  )
}
