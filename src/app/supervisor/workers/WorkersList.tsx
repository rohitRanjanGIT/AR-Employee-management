'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SubmitWorkerDialog } from './SubmitWorkerDialog'
import { ResubmitWorkerDialog } from './ResubmitWorkerDialog'

type City = { id: string; name: string }
type Worker = {
  id: string
  name: string
  category: 'skilled' | 'semi_skilled' | 'helper'
  wageDaily: string
  otRate2hr: string | null
  otRate4hr: string | null
  otRate6hr: string | null
  aadhaarDisplay: string | null
  aadhaarLastFour: string | null
  status: 'pending' | 'active' | 'rejected'
  rejectionReason: string | null
  resubmitted: boolean
  cityId: string
  age: number | null
  phone: string | null
  emergencyContact: string | null
  city: { id: string; name: string }
  createdAt: Date
}

const CATEGORY_LABELS: Record<string, string> = {
  skilled: 'Skilled',
  semi_skilled: 'Semi-Skilled',
  helper: 'Helper',
}

const col = createColumnHelper<Worker>()

function otSummary(w: Worker) {
  const parts = [w.otRate2hr, w.otRate4hr, w.otRate6hr]
    .map((v, i) => v ? `${['2','4','6'][i]}h:₹${Number(v).toLocaleString('en-IN')}` : null)
    .filter(Boolean)
  return parts.length ? parts.join(' / ') : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WorkerTable({ data, extraColumns }: { data: Worker[]; extraColumns?: ColumnDef<Worker, any>[] }) {
  const baseColumns = useMemo(
    () => [
      col.accessor('name', { header: 'Name' }),
      col.accessor('category', {
        header: 'Category',
        cell: (info) => (
          <Badge variant="outline">{CATEGORY_LABELS[info.getValue()] ?? info.getValue()}</Badge>
        ),
      }),
      col.accessor('city', {
        header: 'City',
        cell: (info) => info.getValue().name,
      }),
      col.accessor('wageDaily', {
        header: 'Daily Wage',
        cell: (info) => `₹${Number(info.getValue()).toLocaleString('en-IN')}`,
      }),
      col.display({
        id: 'otRates',
        header: 'OT Rates',
        cell: ({ row }) => {
          const summary = otSummary(row.original)
          return summary
            ? <span className="text-sm text-muted-foreground">{summary}</span>
            : <span className="text-muted-foreground">—</span>
        },
      }),
      col.accessor('aadhaarDisplay', {
        header: 'Aadhaar',
        cell: (info) => {
          const v = info.getValue()
          return <span className="font-mono text-sm">{v ?? 'Not provided'}</span>
        },
      }),
      ...(extraColumns ?? []),
    ],
    [extraColumns]
  )

  const table = useReactTable({ data, columns: baseColumns, getCoreRowModel: getCoreRowModel() })

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={baseColumns.length} className="h-24 text-center text-muted-foreground">
                No workers found.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

const TABS = ['active', 'pending', 'rejected'] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = {
  active: 'Active',
  pending: 'My Submissions',
  rejected: 'Rejected',
}

export function WorkersList({
  workers,
  assignedCities,
}: {
  workers: Worker[]
  assignedCities: City[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('active')
  const [resubmitTarget, setResubmitTarget] = useState<Worker | null>(null)

  const activeWorkers = useMemo(() => workers.filter((w) => w.status === 'active'), [workers])
  const pendingWorkers = useMemo(() => workers.filter((w) => w.status === 'pending'), [workers])
  const rejectedWorkers = useMemo(() => workers.filter((w) => w.status === 'rejected'), [workers])

  const counts: Record<Tab, number> = {
    active: activeWorkers.length,
    pending: pendingWorkers.length,
    rejected: rejectedWorkers.length,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rejectedColumns = useMemo<ColumnDef<Worker, any>[]>(
    () => [
      col.accessor('rejectionReason', {
        header: 'Rejection Reason',
        cell: (info) => {
          const reason = info.getValue()
          if (!reason) return <span className="text-muted-foreground text-sm">No reason given</span>
          return <span className="text-sm text-destructive">{reason}</span>
        },
      }),
      col.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button variant="outline" size="sm" onClick={() => setResubmitTarget(row.original)}>
            Resubmit
          </Button>
        ),
      }),
    ],
    []
  )

  const currentData =
    activeTab === 'active' ? activeWorkers : activeTab === 'pending' ? pendingWorkers : rejectedWorkers

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentExtraColumns: ColumnDef<Worker, any>[] | undefined =
    activeTab === 'rejected' ? rejectedColumns : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Workers</h1>
        <SubmitWorkerDialog assignedCities={assignedCities} />
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {TAB_LABELS[tab]}
            {counts[tab] > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {counts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      <WorkerTable data={currentData} extraColumns={currentExtraColumns} />

      <ResubmitWorkerDialog
        worker={resubmitTarget}
        assignedCities={assignedCities}
        open={!!resubmitTarget}
        onOpenChange={(o) => { if (!o) setResubmitTarget(null) }}
      />
    </div>
  )
}
