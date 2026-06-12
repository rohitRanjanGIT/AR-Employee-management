'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import { CreateWorkerDialog } from './CreateWorkerDialog'
import { ApproveWorkerDialog } from './ApproveWorkerDialog'
import { RejectWorkerDialog } from './RejectWorkerDialog'
import { WorkerDetailDialog } from './WorkerDetailDialog'
import { EditWorkerDialog } from './EditWorkerDialog'
import { deleteWorker } from '@/actions/workers'

type City = { id: string; name: string }
type Worker = {
  id: string
  name: string
  category: 'skilled' | 'semi_skilled' | 'helper'
  wageDaily: string
  otRate2hr: string | null
  otRate4hr: string | null
  otRate6hr: string | null
  aadhaarLastFour: string | null
  aadhaarDisplay: string | null
  status: 'pending' | 'active' | 'rejected'
  rejectionReason: string | null
  resubmitted: boolean
  cityId: string
  age: number | null
  phone: string | null
  address: string | null
  joinDate: Date | null
  emergencyContact: string | null
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

export function WorkersTable({ workers, cities }: { workers: Worker[]; cities: City[] }) {
  const router = useRouter()

  const [statusFilter, setStatusFilter] = useState('all')
  const [statusFilterName, setStatusFilterName] = useState('All Status')
  const [cityFilter, setCityFilter] = useState('all')
  const [cityFilterName, setCityFilterName] = useState('All Cities')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categoryFilterName, setCategoryFilterName] = useState('All Categories')

  const [detailTarget, setDetailTarget] = useState<Worker | null>(null)
  const [approveTarget, setApproveTarget] = useState<Worker | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Worker | null>(null)
  const [editTarget, setEditTarget] = useState<Worker | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, startDelete] = useTransition()

  const pendingCount = useMemo(() => workers.filter((w) => w.status === 'pending').length, [workers])

  const filtered = useMemo(() => workers.filter((w) => {
    if (statusFilter !== 'all' && w.status !== statusFilter) return false
    if (cityFilter !== 'all' && w.city.id !== cityFilter) return false
    if (categoryFilter !== 'all' && w.category !== categoryFilter) return false
    return true
  }), [workers, statusFilter, cityFilter, categoryFilter])

  const uniqueCities = useMemo(() => {
    const seen = new Set<string>()
    return workers
      .map((w) => ({ id: w.city.id, name: w.city.name }))
      .filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true })
  }, [workers])

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
      col.accessor('status', {
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      col.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const w = row.original
          return (
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setDetailTarget(w)}>
                View
              </Button>
              {w.status === 'pending' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setApproveTarget(w)}>
                    Approve
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setRejectTarget(w)}>
                    Reject
                  </Button>
                </>
              )}
            </div>
          )
        },
      }),
    ],
    []
  )

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleteError('')
    startDelete(async () => {
      try {
        await deleteWorker(deleteTarget.id)
        setDeleteTarget(null)
        router.refresh()
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Workers</h1>
          {pendingCount > 0 && (
            <Badge variant="destructive">{pendingCount} Pending</Badge>
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
                  <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
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
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <WorkerDetailDialog
        worker={detailTarget}
        open={!!detailTarget}
        onOpenChange={(o) => { if (!o) setDetailTarget(null) }}
        onApprove={(w) => setApproveTarget(w)}
        onReject={(w) => setRejectTarget(w)}
        onEdit={(w) => setEditTarget(w)}
        onDelete={(w) => setDeleteTarget(w)}
      />
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
      <EditWorkerDialog
        worker={editTarget}
        cities={cities}
        open={!!editTarget}
        onOpenChange={(o) => { if (!o) setEditTarget(null) }}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteError('') } }}>
        <DialogContent>
          <DialogTitle>Delete Worker</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>? This cannot be undone.
          </p>
          {deleteError && <p className="text-xs text-destructive mt-2">{deleteError}</p>}
          <DialogFooter className="mt-4">
            <DialogClose render={<Button variant="outline" type="button" disabled={isDeleting} />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
