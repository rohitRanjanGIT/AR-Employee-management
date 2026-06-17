'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { Avatar } from '@/components/Avatar'
import { computeAge } from '@/lib/age'
import { CreateWorkerDialog } from './CreateWorkerDialog'
import { ApproveWorkerDialog } from './ApproveWorkerDialog'
import { RejectWorkerDialog } from './RejectWorkerDialog'
import { WorkerDetailDialog } from './WorkerDetailDialog'
import { EditWorkerDialog } from './EditWorkerDialog'
import { deleteWorker, archiveWorker, restoreWorker } from '@/actions/workers'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
  status: 'pending' | 'active' | 'rejected' | 'archived'
  rejectionReason: string | null
  resubmitted: boolean
  cityId: string
  dateOfBirth: string | null
  phone: string | null
  address: string | null
  joinDate: Date | null
  emergencyContact: string | null
  accountNumber: string | null
  ifscCode: string | null
  photoCloudinaryUrl: string | null
  photoCloudinaryPublicId: string | null
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
  if (status === 'archived') return <Badge variant="secondary">Archived</Badge>
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
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, startDelete] = useTransition()
  const [, startAction] = useTransition()
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handleArchive(w: Worker) {
    startAction(async () => {
      try {
        await archiveWorker(w.id)
        router.refresh()
        showToast(`${w.name} archived`)
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  function handleRestore(w: Worker) {
    startAction(async () => {
      try {
        await restoreWorker(w.id)
        router.refresh()
        showToast(`${w.name} restored`)
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  const pendingCount = useMemo(() => workers.filter((w) => w.status === 'pending').length, [workers])

  const filtered = useMemo(() => workers.filter((w) => {
    // Archived workers are hidden everywhere except the explicit Archived filter
    if (statusFilter === 'all' ? w.status === 'archived' : w.status !== statusFilter) return false
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
      col.accessor('name', {
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <Avatar src={row.original.photoCloudinaryUrl} name={row.original.name} size={32} />
            <span>{row.original.name}</span>
          </div>
        ),
      }),
      col.display({
        id: 'age',
        header: 'Age',
        cell: ({ row }) => <span className="tabular-nums">{computeAge(row.original.dateOfBirth)}</span>,
      }),
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
              {w.status === 'active' && (
                <Link href={`/admin/payroll/workers/${w.id}`}>
                  <Button variant="outline" size="sm">
                    View Earnings
                  </Button>
                </Link>
              )}
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
        setConfirmText('')
        router.refresh()
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-foreground text-background px-4 py-2 rounded shadow text-sm">
          {toast}
        </div>
      )}

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
            const labels: Record<string, string> = { all: 'All Status', pending: 'Pending', active: 'Active', rejected: 'Rejected', archived: 'Archived' }
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
            <SelectItem value="archived">Archived</SelectItem>
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
        onArchive={(w) => handleArchive(w)}
        onRestore={(w) => handleRestore(w)}
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

      {/* Delete confirm — permanent cascade (worker + attendance) */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteError(''); setConfirmText('') } }}>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Delete Worker</DialogTitle>
          <div className="space-y-4 mt-1">
            <p className="text-sm text-muted-foreground">
              Permanently deleting <span className="font-medium text-foreground">{deleteTarget?.name}</span> removes
              the worker and <span className="font-medium text-foreground">all their attendance records</span>. This
              cannot be undone. To keep records, use Archive instead.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="worker-delete-confirm">
                Type <span className="font-medium text-foreground">{deleteTarget?.name}</span> to confirm
              </Label>
              <Input
                id="worker-delete-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={deleteTarget?.name}
                autoComplete="off"
              />
            </div>
            {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
          </div>
          <DialogFooter className="mt-4">
            <DialogClose render={<Button variant="outline" type="button" disabled={isDeleting} />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting || !deleteTarget || confirmText.trim() !== deleteTarget.name}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
