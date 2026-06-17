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
import { formatDate } from '@/lib/utils'
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
import { CreateAdminDialog } from './CreateAdminDialog'
import { EditAdminDialog } from './EditAdminDialog'
import { AdminStatusDialog } from './AdminStatusDialog'
import { ResetAdminPasswordDialog } from './ResetAdminPasswordDialog'
import { RemoveAdminDialog } from './RemoveAdminDialog'

export type Admin = {
  userId: string
  name: string
  email: string
  status: string
  createdAt: Date
  activeSessions: number
  isSelf: boolean
}

const col = createColumnHelper<Admin>()

export function AdminsTable({ admins }: { admins: Admin[] }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [statusFilterName, setStatusFilterName] = useState('All')
  const [editTarget, setEditTarget] = useState<Admin | null>(null)
  const [statusTarget, setStatusTarget] = useState<{ admin: Admin; mode: 'deactivate' | 'reactivate' } | null>(null)
  const [resetTarget, setResetTarget] = useState<Admin | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Admin | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const filtered = useMemo(
    () => admins.filter((a) => statusFilter === 'all' || a.status === statusFilter),
    [admins, statusFilter]
  )

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <span className="flex items-center gap-2">
            {info.getValue()}
            {info.row.original.isSelf && (
              <Badge variant="outline" className="text-xs">
                You
              </Badge>
            )}
          </span>
        ),
      }),
      col.accessor('email', { header: 'Email' }),
      col.accessor('status', {
        header: 'Status',
        cell: (info) =>
          info.getValue() === 'active' ? (
            <Badge variant="default">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
      }),
      col.accessor('activeSessions', {
        header: 'Sessions',
        cell: (info) => {
          const n = info.getValue()
          if (n === 0) return <span className="text-muted-foreground text-xs">—</span>
          return (
            <Badge variant="outline" className="text-xs">
              {n} active
            </Badge>
          )
        },
      }),
      col.accessor('createdAt', {
        header: 'Created',
        cell: (info) => formatDate(info.getValue()),
      }),
      col.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const a = row.original
          if (a.isSelf) {
            return <span className="text-xs text-muted-foreground">Manage in Settings</span>
          }
          return (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditTarget(a)}>
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => setResetTarget(a)}>
                Reset Password
              </Button>
              {a.status === 'active' ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setStatusTarget({ admin: a, mode: 'deactivate' })}
                >
                  Deactivate
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusTarget({ admin: a, mode: 'reactivate' })}
                >
                  Reactivate
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => setRemoveTarget(a)}>
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
        <h1 className="text-xl font-semibold">Admins</h1>
        <CreateAdminDialog />
      </div>

      <p className="text-sm text-muted-foreground">
        Admins have full access to the system. You cannot deactivate or remove the last active
        admin, and you manage your own account from Settings.
      </p>

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
          {filtered.length} admin{filtered.length !== 1 ? 's' : ''}
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
                  No admins found.
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

      <EditAdminDialog
        admin={editTarget}
        open={!!editTarget}
        onOpenChange={(o) => { if (!o) setEditTarget(null) }}
      />

      <AdminStatusDialog
        admin={statusTarget?.admin ?? null}
        mode={statusTarget?.mode ?? 'deactivate'}
        open={!!statusTarget}
        onOpenChange={(o) => { if (!o) setStatusTarget(null) }}
        onError={showToast}
      />

      <ResetAdminPasswordDialog
        admin={resetTarget}
        open={!!resetTarget}
        onOpenChange={(o) => { if (!o) setResetTarget(null) }}
        onSuccess={showToast}
      />

      <RemoveAdminDialog
        admin={removeTarget}
        open={!!removeTarget}
        onOpenChange={(o) => { if (!o) setRemoveTarget(null) }}
        onSuccess={showToast}
      />
    </div>
  )
}
