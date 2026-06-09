'use client'

import { useTransition, useState } from 'react'
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
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import { resolveAttendanceEditRequest } from '@/actions/attendance'

type EditRequest = {
  proposedMorningPresent: boolean
  proposedEveningPresent: boolean
  proposedOt: 'none' | '2hr' | '4hr'
  reason: string
  submittedByName: string
  submittedAt: string
}

type PendingRecord = {
  id: string
  date: string
  morningMarkedAt: Date | null
  eveningMarkedAt: Date | null
  editRequest: unknown
  worker: { name: string }
  site: { name: string; city: { name: string } }
}

interface Props {
  records: PendingRecord[]
  onToast: (msg: string) => void
}

const col = createColumnHelper<PendingRecord>()

export function EditRequestsTable({ records, onToast }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)

  function handleApprove(id: string) {
    startTransition(async () => {
      try {
        await resolveAttendanceEditRequest(id, 'approved')
        router.refresh()
        onToast('Edit request approved')
      } catch (e) {
        onToast((e as Error).message)
      }
    })
  }

  function handleReject(id: string) {
    startTransition(async () => {
      try {
        await resolveAttendanceEditRequest(id, 'rejected')
        setRejectTarget(null)
        router.refresh()
        onToast('Edit request rejected')
      } catch (e) {
        onToast((e as Error).message)
      }
    })
  }

  const columns = [
    col.accessor('date', {
      header: 'Date',
      cell: (info) => <span className="text-sm tabular-nums">{info.getValue()}</span>,
    }),
    col.accessor((row) => row.site.name, {
      id: 'site',
      header: 'Site',
      cell: (info) => (
        <div className="text-sm">
          <p>{info.getValue()}</p>
          <p className="text-xs text-muted-foreground">{info.row.original.site.city.name}</p>
        </div>
      ),
    }),
    col.accessor((row) => row.worker.name, {
      id: 'worker',
      header: 'Worker',
      cell: (info) => <span className="text-sm font-medium">{info.getValue()}</span>,
    }),
    col.accessor('morningMarkedAt', {
      header: 'Current',
      cell: (info) => {
        const row = info.row.original
        return (
          <span className="text-xs text-muted-foreground">
            {row.morningMarkedAt ? '🌅' : '—'} {row.eveningMarkedAt ? '🌆' : '—'}
          </span>
        )
      },
    }),
    col.accessor('editRequest', {
      header: 'Proposed',
      cell: (info) => {
        const req = info.getValue() as EditRequest | null
        if (!req) return null
        return (
          <div className="text-xs space-y-0.5">
            <p>{req.proposedMorningPresent ? '🌅' : '—'} {req.proposedEveningPresent ? '🌆' : '—'}</p>
            {req.proposedMorningPresent && req.proposedEveningPresent && req.proposedOt !== 'none' && (
              <Badge variant="outline" className="text-xs">{req.proposedOt} OT</Badge>
            )}
          </div>
        )
      },
    }),
    col.accessor((row) => (row.editRequest as EditRequest | null)?.reason, {
      id: 'reason',
      header: 'Reason',
      cell: (info) => (
        <span className="text-xs text-muted-foreground max-w-[200px] block truncate" title={info.getValue() ?? ''}>
          {info.getValue()}
        </span>
      ),
    }),
    col.accessor((row) => (row.editRequest as EditRequest | null)?.submittedByName, {
      id: 'submittedBy',
      header: 'Submitted By',
      cell: (info) => <span className="text-xs">{info.getValue()}</span>,
    }),
    col.accessor((row) => (row.editRequest as EditRequest | null)?.submittedAt, {
      id: 'submittedAt',
      header: 'Submitted At',
      cell: (info) => {
        const v = info.getValue()
        if (!v) return null
        return (
          <span className="text-xs text-muted-foreground tabular-nums">
            {new Date(v).toLocaleDateString('en-IN')}
          </span>
        )
      },
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const id = info.row.original.id
        return (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="default"
              disabled={isPending}
              onClick={() => handleApprove(id)}
              className="h-7 text-xs"
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setRejectTarget(id)}
              className="h-7 text-xs"
            >
              Reject
            </Button>
          </div>
        )
      },
    }),
  ]

  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      {records.length > 0 && (
        <p className="text-sm text-muted-foreground">{records.length} pending request{records.length !== 1 ? 's' : ''}</p>
      )}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="text-xs">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                  No pending edit requests.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reject confirmation dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) setRejectTarget(null) }}>
        <DialogContent>
          <DialogTitle>Reject Edit Request</DialogTitle>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to reject this edit request? The attendance record will remain unchanged.
          </p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => rejectTarget && handleReject(rejectTarget)}
            >
              {isPending ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
