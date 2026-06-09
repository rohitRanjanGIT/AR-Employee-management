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
import { AdminEditDialog } from './AdminEditDialog'

type AttendanceRecord = {
  id: string
  date: string
  morningMarkedAt: Date | null
  eveningMarkedAt: Date | null
  ot: 'none' | '2hr' | '4hr'
  derivedStatus: 'full' | 'half' | 'absent'
  isEdited: boolean
  isLocked: boolean
  worker: { id: string; name: string; category: string }
  site: { id: string; name: string; city: { name: string } }
  morningMarkedByEmployee: { name: string } | null
  eveningMarkedByEmployee: { name: string } | null
}

type SiteFilter = { id: string; name: string }
type WorkerFilter = { id: string; name: string }

interface Props {
  records: AttendanceRecord[]
  sites: SiteFilter[]
  workers: WorkerFilter[]
  onToast: (msg: string) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  skilled: 'Skilled',
  semi_skilled: 'Semi-Skilled',
  helper: 'Helper',
}

const col = createColumnHelper<AttendanceRecord>()

export function AttendanceTable({ records, sites, workers, onToast }: Props) {
  const [siteFilter, setSiteFilter] = useState('')
  const [siteFilterName, setSiteFilterName] = useState('')
  const [workerFilter, setWorkerFilter] = useState('')
  const [workerFilterName, setWorkerFilterName] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [statusFilterName, setStatusFilterName] = useState('')
  const [editedFilter, setEditedFilter] = useState('')
  const [editedFilterName, setEditedFilterName] = useState('')

  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (siteFilter && r.site.id !== siteFilter) return false
      if (workerFilter && r.worker.id !== workerFilter) return false
      if (statusFilter && r.derivedStatus !== statusFilter) return false
      if (editedFilter === 'edited' && !r.isEdited) return false
      if (editedFilter === 'not_edited' && r.isEdited) return false
      return true
    })
  }, [records, siteFilter, workerFilter, statusFilter, editedFilter])

  const columns = useMemo(
    () => [
      col.accessor('date', {
        header: 'Date',
        cell: (info) => <span className="text-sm tabular-nums">{info.getValue()}</span>,
      }),
      col.accessor((row) => row.site.name, {
        id: 'site',
        header: 'Site',
        cell: (info) => <span className="text-sm">{info.getValue()}</span>,
      }),
      col.accessor((row) => row.site.city.name, {
        id: 'city',
        header: 'City',
        cell: (info) => <span className="text-sm text-muted-foreground">{info.getValue()}</span>,
      }),
      col.accessor((row) => row.worker.name, {
        id: 'worker',
        header: 'Worker',
        cell: (info) => <span className="text-sm font-medium">{info.getValue()}</span>,
      }),
      col.accessor((row) => row.worker.category, {
        id: 'category',
        header: 'Category',
        cell: (info) => (
          <Badge variant="outline" className="text-xs">
            {CATEGORY_LABELS[info.getValue()] ?? info.getValue()}
          </Badge>
        ),
      }),
      col.accessor('morningMarkedAt', {
        header: 'Morning',
        cell: (info) => {
          const row = info.row.original
          if (!info.getValue()) return <span className="text-muted-foreground">—</span>
          return (
            <span
              className="text-green-600 cursor-help"
              title={row.morningMarkedByEmployee ? `Marked by ${row.morningMarkedByEmployee.name}` : ''}
            >
              ✓
            </span>
          )
        },
      }),
      col.accessor('eveningMarkedAt', {
        header: 'Evening',
        cell: (info) => {
          const row = info.row.original
          if (!info.getValue()) return <span className="text-muted-foreground">—</span>
          return (
            <span
              className="text-green-600 cursor-help"
              title={row.eveningMarkedByEmployee ? `Marked by ${row.eveningMarkedByEmployee.name}` : ''}
            >
              ✓
            </span>
          )
        },
      }),
      col.accessor('ot', {
        header: 'OT',
        cell: (info) => {
          const v = info.getValue()
          if (v === 'none') return <span className="text-muted-foreground text-xs">—</span>
          return <Badge variant="outline" className="text-xs">{v}</Badge>
        },
      }),
      col.accessor('derivedStatus', {
        header: 'Status',
        cell: (info) => {
          const v = info.getValue()
          if (v === 'full') return <Badge variant="default" className="text-xs">Full</Badge>
          if (v === 'half') return <Badge variant="outline" className="text-xs">Half</Badge>
          return <Badge variant="destructive" className="text-xs">Absent</Badge>
        },
      }),
      col.accessor('isEdited', {
        header: 'Flags',
        cell: (info) => {
          const row = info.row.original
          return (
            <div className="flex gap-1">
              {row.isEdited && <Badge variant="outline" className="text-xs text-yellow-600">Edited</Badge>}
              {row.isLocked && <Badge variant="outline" className="text-xs text-blue-600">Locked</Badge>}
            </div>
          )
        },
      }),
      col.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const row = info.row.original
          return (
            <Button
              variant="outline"
              size="sm"
              disabled={row.isLocked}
              onClick={() => {
                setEditRecord(row)
                setEditOpen(true)
              }}
            >
              Edit
            </Button>
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

  function clearFilters() {
    setSiteFilter('')
    setSiteFilterName('')
    setWorkerFilter('')
    setWorkerFilterName('')
    setStatusFilter('')
    setStatusFilterName('')
    setEditedFilter('')
    setEditedFilterName('')
  }

  const hasFilters = !!(siteFilter || workerFilter || statusFilter || editedFilter)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={siteFilter}
          onValueChange={(v: string | null) => {
            setSiteFilter(v ?? '')
            setSiteFilterName(sites.find((s) => s.id === v)?.name ?? '')
          }}
        >
          <SelectTrigger className="w-44 h-8 text-xs">
            <span className={siteFilter ? 'text-foreground' : 'text-muted-foreground'}>
              {siteFilterName || 'All Sites'}
            </span>
          </SelectTrigger>
          <SelectContent>
            {sites.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={workerFilter}
          onValueChange={(v: string | null) => {
            setWorkerFilter(v ?? '')
            setWorkerFilterName(workers.find((w) => w.id === v)?.name ?? '')
          }}
        >
          <SelectTrigger className="w-44 h-8 text-xs">
            <span className={workerFilter ? 'text-foreground' : 'text-muted-foreground'}>
              {workerFilterName || 'All Workers'}
            </span>
          </SelectTrigger>
          <SelectContent>
            {workers.map((w) => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v: string | null) => {
            setStatusFilter(v ?? '')
            const labels: Record<string, string> = { full: 'Full Day', half: 'Half Day', absent: 'Absent' }
            setStatusFilterName(labels[v ?? ''] ?? '')
          }}
        >
          <SelectTrigger className="w-36 h-8 text-xs">
            <span className={statusFilter ? 'text-foreground' : 'text-muted-foreground'}>
              {statusFilterName || 'All Status'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full Day</SelectItem>
            <SelectItem value="half">Half Day</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={editedFilter}
          onValueChange={(v: string | null) => {
            setEditedFilter(v ?? '')
            setEditedFilterName(v === 'edited' ? 'Edited only' : v === 'not_edited' ? 'Not edited' : '')
          }}
        >
          <SelectTrigger className="w-36 h-8 text-xs">
            <span className={editedFilter ? 'text-foreground' : 'text-muted-foreground'}>
              {editedFilterName || 'Edit Status'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="edited">Edited only</SelectItem>
            <SelectItem value="not_edited">Not edited</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            Clear filters
          </Button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
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
                  No attendance records found.
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

      <AdminEditDialog
        record={editRecord}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={onToast}
      />
    </div>
  )
}
