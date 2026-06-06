'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { CreateWorkerDialog } from './CreateWorkerDialog'
import { ApproveWorkerDialog } from './ApproveWorkerDialog'
import { RejectWorkerDialog } from './RejectWorkerDialog'
import { ReassignCityDialog } from './ReassignCityDialog'
import { AadhaarRevealButton } from './AadhaarRevealButton'

type City = { id: string; name: string }
type Worker = {
  id: string
  name: string
  category: 'skilled' | 'semi_skilled' | 'helper'
  wageDaily: string
  otRate: string | null
  aadhaarLastFour: string | null
  aadhaarDisplay: string | null
  status: 'pending' | 'active' | 'rejected'
  rejectionReason: string | null
  resubmitted: boolean
  cityId: string
  city: { id: string; name: string }
  submittedByEmployee: { id: string; name: string } | null
  submittedBy: string | null
  createdAt: Date
}

const CATEGORY_LABELS: Record<string, string> = {
  skilled: 'Skilled',
  semi_skilled: 'Semi-Skilled',
  helper: 'Helper',
}

const col = createColumnHelper<Worker>()

function StatusBadge({ status }: { status: Worker['status'] }) {
  if (status === 'active') return <Badge variant="default">Active</Badge>
  if (status === 'pending') return <Badge variant="outline">Pending</Badge>
  return <Badge variant="destructive">Rejected</Badge>
}

export function WorkersTable({
  workers,
  cities,
}: {
  workers: Worker[]
  cities: City[]
}) {
  const [statusFilter, setStatusFilter] = useState('pending')
  const [statusFilterName, setStatusFilterName] = useState('Pending')
  const [cityFilter, setCityFilter] = useState('all')
  const [cityFilterName, setCityFilterName] = useState('All Cities')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categoryFilterName, setCategoryFilterName] = useState('All Categories')

  const [approveTarget, setApproveTarget] = useState<Worker | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Worker | null>(null)
  const [reassignTarget, setReassignTarget] = useState<Worker | null>(null)

  const pendingCount = useMemo(() => workers.filter((w) => w.status === 'pending').length, [workers])

  const filtered = useMemo(() => {
    return workers.filter((w) => {
      if (statusFilter !== 'all' && w.status !== statusFilter) return false
      if (cityFilter !== 'all' && w.city.id !== cityFilter) return false
      if (categoryFilter !== 'all' && w.category !== categoryFilter) return false
      return true
    })
  }, [workers, statusFilter, cityFilter, categoryFilter])

  const columns = useMemo(
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
      col.accessor('otRate', {
        header: 'OT Rate',
        cell: (info) => {
          const v = info.getValue()
          if (!v) return <span className="text-muted-foreground">—</span>
          return `₹${Number(v).toLocaleString('en-IN')}`
        },
      }),
      col.display({
        id: 'aadhaar',
        header: 'Aadhaar',
        cell: ({ row }) => (
          <AadhaarRevealButton
            workerId={row.original.id}
            maskedDisplay={row.original.aadhaarDisplay}
          />
        ),
      }),
      col.accessor('status', {
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      col.display({
        id: 'submittedBy',
        header: 'Submitted By',
        cell: ({ row }) => {
          const emp = row.original.submittedByEmployee
          if (!emp) return <span className="text-muted-foreground text-sm">Admin</span>
          return <span className="text-sm">{emp.name}</span>
        },
      }),
      col.display({
        id: 'rejectionReason',
        header: 'Rejection Reason',
        cell: ({ row }) => {
          const reason = row.original.rejectionReason
          if (!reason) return <span className="text-muted-foreground">—</span>
          return <span className="text-sm text-destructive max-w-xs truncate block">{reason}</span>
        },
      }),
      col.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const w = row.original
          if (w.status === 'pending') {
            return (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setApproveTarget(w)}>
                  Approve
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setRejectTarget(w)}>
                  Reject
                </Button>
              </div>
            )
          }
          if (w.status === 'active') {
            return (
              <Button variant="outline" size="sm" onClick={() => setReassignTarget(w)}>
                Reassign City
              </Button>
            )
          }
          return <span className="text-muted-foreground text-sm">—</span>
        },
      }),
    ],
    []
  )

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const uniqueCities = useMemo(() => {
    const seen = new Set<string>()
    return workers
      .map((w) => ({ id: w.city.id, name: w.city.name }))
      .filter((c) => {
        if (seen.has(c.id)) return false
        seen.add(c.id)
        return true
      })
  }, [workers])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Workers</h1>
          {pendingCount > 0 && (
            <Badge variant="destructive">{pendingCount} Pending Approval{pendingCount !== 1 ? 's' : ''}</Badge>
          )}
        </div>
        <CreateWorkerDialog cities={cities} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            const val = v ?? 'all'
            setStatusFilter(val)
            const labels: Record<string, string> = { all: 'All Status', pending: 'Pending', active: 'Active', rejected: 'Rejected' }
            setStatusFilterName(labels[val] ?? val)
          }}
        >
          <SelectTrigger className="w-36">
            <span className="text-sm">{statusFilterName}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={cityFilter}
          onValueChange={(v) => {
            const val = v ?? 'all'
            setCityFilter(val)
            setCityFilterName(uniqueCities.find((c) => c.id === val)?.name ?? 'All Cities')
          }}
        >
          <SelectTrigger className="w-40">
            <span className="text-sm">{cityFilterName}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {uniqueCities.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={categoryFilter}
          onValueChange={(v) => {
            const val = v ?? 'all'
            setCategoryFilter(val)
            setCategoryFilterName(CATEGORY_LABELS[val] ?? 'All Categories')
          }}
        >
          <SelectTrigger className="w-44">
            <span className="text-sm">{categoryFilterName}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="skilled">Skilled</SelectItem>
            <SelectItem value="semi_skilled">Semi-Skilled</SelectItem>
            <SelectItem value="helper">Helper</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">
          {filtered.length} worker{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No workers found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ApproveWorkerDialog
        worker={approveTarget}
        open={!!approveTarget}
        onOpenChange={(o) => { if (!o) setApproveTarget(null) }}
      />
      <RejectWorkerDialog
        worker={rejectTarget}
        open={!!rejectTarget}
        onOpenChange={(o) => { if (!o) setRejectTarget(null) }}
      />
      <ReassignCityDialog
        worker={reassignTarget}
        cities={cities}
        open={!!reassignTarget}
        onOpenChange={(o) => { if (!o) setReassignTarget(null) }}
      />
    </div>
  )
}
