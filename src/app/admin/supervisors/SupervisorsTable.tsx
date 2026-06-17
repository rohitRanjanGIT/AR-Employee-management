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
import { Avatar } from '@/components/Avatar'
import { computeAge } from '@/lib/age'
import { CreateSupervisorDialog } from './CreateSupervisorDialog'
import { EditSupervisorDialog } from './EditSupervisorDialog'
import { DeactivateConfirmDialog } from './DeactivateConfirmDialog'
import { ResetPasswordDialog } from './ResetPasswordDialog'
import { RemoveSupervisorDialog } from './RemoveSupervisorDialog'
import { SupervisorDetailDialog } from './SupervisorDetailDialog'

type City = { id: string; name: string }
type AssignedSite = { siteId: string; siteName: string; siteCode: string; cityName: string }
type Supervisor = {
  id: string
  userId: string
  name: string
  email: string
  phone: string | null
  joinDate: Date | null
  salaryMonthly: string | null
  dateOfBirth: string | null
  accountNumber: string | null
  ifscCode: string | null
  photoUrl: string | null
  photoPublicId: string | null
  homeCity: City | null
  status: string
  assignedSites: AssignedSite[]
}

const col = createColumnHelper<Supervisor>()

function AssignedSitesCell({ sites }: { sites: AssignedSite[] }) {
  if (sites.length === 0) return <span className="text-muted-foreground text-xs">—</span>
  const shown = sites.slice(0, 2)
  const extra = sites.length - 2
  return (
    <span className="text-sm">
      {shown.map((s) => `${s.siteName} (${s.cityName})`).join(', ')}
      {extra > 0 && <span className="text-muted-foreground"> +{extra} more</span>}
    </span>
  )
}

export function SupervisorsTable({
  supervisors,
  cities,
}: {
  supervisors: Supervisor[]
  cities: City[]
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [statusFilterName, setStatusFilterName] = useState('All')
  const [detailTarget, setDetailTarget] = useState<Supervisor | null>(null)
  const [editTarget, setEditTarget] = useState<Supervisor | null>(null)
  const [dialogTarget, setDialogTarget] = useState<{ supervisor: Supervisor; mode: 'deactivate' | 'reactivate' } | null>(null)
  const [resetTarget, setResetTarget] = useState<Supervisor | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Supervisor | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const filtered = useMemo(
    () => supervisors.filter((s) => statusFilter === 'all' || s.status === statusFilter),
    [supervisors, statusFilter]
  )

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <Avatar src={row.original.photoUrl} name={row.original.name} size={32} />
            <span>{row.original.name}</span>
          </div>
        ),
      }),
      col.accessor('email', { header: 'Email' }),
      col.display({
        id: 'age',
        header: 'Age',
        cell: ({ row }) => <span className="tabular-nums">{computeAge(row.original.dateOfBirth)}</span>,
      }),
      col.accessor('phone', {
        header: 'Phone',
        cell: (info) => info.getValue() ?? <span className="text-muted-foreground">—</span>,
      }),
      col.accessor('homeCity', {
        header: 'Home City',
        cell: (info) => info.getValue()?.name ?? <span className="text-muted-foreground">—</span>,
      }),
      col.accessor('salaryMonthly', {
        header: 'Monthly Salary',
        cell: (info) => {
          const v = info.getValue()
          if (!v) return <span className="text-muted-foreground">—</span>
          return `₹${Number(v).toLocaleString('en-IN')}`
        },
      }),
      col.accessor('assignedSites', {
        header: 'Assigned Sites',
        cell: (info) => <AssignedSitesCell sites={info.getValue()} />,
      }),
      col.accessor('status', {
        header: 'Status',
        cell: (info) =>
          info.getValue() === 'active' ? (
            <Badge variant="default">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
      }),
      col.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const s = row.original
          return (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setDetailTarget(s)}>
                View
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditTarget(s)}>
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => setResetTarget(s)}>
                Reset Password
              </Button>
              {s.status === 'active' ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDialogTarget({ supervisor: s, mode: 'deactivate' })}
                >
                  Deactivate
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogTarget({ supervisor: s, mode: 'reactivate' })}
                >
                  Reactivate
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => setRemoveTarget(s)}>
                Remove
              </Button>
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
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-foreground text-background px-4 py-2 rounded shadow text-sm">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Supervisors</h1>
        <CreateSupervisorDialog cities={cities} />
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            const val = v ?? 'all'
            setStatusFilter(val)
            setStatusFilterName(val === 'all' ? 'All' : val === 'active' ? 'Active' : 'Inactive')
          }}
        >
          <SelectTrigger className="w-36">
            <span className="text-sm">{statusFilterName}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filtered.length} supervisor{filtered.length !== 1 ? 's' : ''}
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
                  No supervisors found.
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

      <SupervisorDetailDialog
        supervisor={detailTarget}
        open={!!detailTarget}
        onOpenChange={(o) => { if (!o) setDetailTarget(null) }}
      />

      <EditSupervisorDialog
        supervisor={editTarget}
        cities={cities}
        open={!!editTarget}
        onOpenChange={(o) => { if (!o) setEditTarget(null) }}
      />

      <DeactivateConfirmDialog
        supervisor={dialogTarget?.supervisor ?? null}
        mode={dialogTarget?.mode ?? 'deactivate'}
        open={!!dialogTarget}
        onOpenChange={(o) => { if (!o) setDialogTarget(null) }}
      />

      <ResetPasswordDialog
        supervisor={resetTarget}
        open={!!resetTarget}
        onOpenChange={(o) => { if (!o) setResetTarget(null) }}
        onSuccess={showToast}
      />

      <RemoveSupervisorDialog
        supervisor={removeTarget}
        open={!!removeTarget}
        onOpenChange={(o) => { if (!o) setRemoveTarget(null) }}
        onSuccess={showToast}
      />
    </div>
  )
}
