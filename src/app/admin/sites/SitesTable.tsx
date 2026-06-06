'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
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
import { CreateSiteDialog } from './CreateSiteDialog'
import { AssignSupervisorDialog } from './AssignSupervisorDialog'
import { DeactivateSiteDialog } from './DeactivateSiteDialog'
import { SiteSupervisorList } from './SiteSupervisorList'

type WorkType = { id: string; name: string }
type City = { id: string; name: string; shortCode: string; status: string }
type Employee = { id: string; name: string; phone: string | null }
type Assignment = { id: string; siteId: string; employeeId: string; assignedAt: Date; employee: Employee }
type Site = {
  id: string
  name: string
  code: string
  status: string
  tenderPrice: string | null
  totalProjectCost: string | null
  createdAt: Date
  city: City
  siteWorkTypes: { id: string; siteId: string; workTypeId: string; workType: WorkType }[]
  siteSupervisorAssignments: Assignment[]
}
type SupervisorEmployee = { employee: Employee; userName: string; userEmail: string }

const col = createColumnHelper<Site>()

export function SitesTable({
  sites,
  workTypes,
  cities,
  supervisors,
}: {
  sites: Site[]
  workTypes: WorkType[]
  cities: City[]
  supervisors: SupervisorEmployee[]
}) {
  const [cityFilter, setCityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [assignTarget, setAssignTarget] = useState<Site | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Site | null>(null)

  const filtered = useMemo(() => {
    return sites.filter((s) => {
      if (cityFilter !== 'all' && s.city.id !== cityFilter) return false
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      return true
    })
  }, [sites, cityFilter, statusFilter])

  const columns = useMemo(
    () => [
      col.accessor('name', { header: 'Site Name' }),
      col.accessor('code', {
        header: 'Code',
        cell: (info) => (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{info.getValue()}</code>
        ),
      }),
      col.accessor('city', {
        header: 'City',
        cell: (info) => info.getValue().name,
      }),
      col.accessor('siteWorkTypes', {
        header: 'Work Types',
        cell: (info) => {
          const types = info.getValue()
          if (types.length === 0) return <span className="text-muted-foreground text-xs">—</span>
          return (
            <div className="flex flex-wrap gap-1">
              {types.map((swt) => (
                <Badge key={swt.id} variant="outline" className="text-xs">{swt.workType.name}</Badge>
              ))}
            </div>
          )
        },
      }),
      col.accessor('siteSupervisorAssignments', {
        header: 'Supervisors',
        cell: (info) => (
          <SiteSupervisorList siteId={info.row.original.id} assignments={info.getValue()} />
        ),
      }),
      col.accessor('tenderPrice', {
        header: 'Tender Price',
        cell: (info) => info.getValue() ? `₹${Number(info.getValue()).toLocaleString()}` : '—',
      }),
      col.accessor('totalProjectCost', {
        header: 'Project Cost',
        cell: (info) => info.getValue() ? `₹${Number(info.getValue()).toLocaleString()}` : '—',
      }),
      col.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <Badge variant={info.getValue() === 'active' ? 'default' : 'outline'}>{info.getValue()}</Badge>
        ),
      }),
      col.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const site = row.original
          return (
            <div className="flex items-center gap-2">
              {site.status === 'active' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setAssignTarget(site)}>
                    Assign
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setDeactivateTarget(site)}>
                    Deactivate
                  </Button>
                </>
              )}
              {site.status === 'inactive' && (
                <Link href={`/admin/sites/${site.id}/snapshot`}>
                  <Button size="sm" variant="outline">View Snapshot</Button>
                </Link>
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
    getFilteredRowModel: getFilteredRowModel(),
  })

  const uniqueCities = useMemo(() => {
    const seen = new Set<string>()
    return sites
      .map((s) => s.city)
      .filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true })
  }, [sites])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sites</h1>
        <CreateSiteDialog cities={cities} workTypes={workTypes} />
      </div>

      <div className="flex gap-3">
        <select
          className="rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
        >
          <option value="all">All Cities</option>
          {uniqueCities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          className="rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {sites.length === 0 ? 'No sites yet. Create one to get started.' : 'No sites match the selected filters.'}
        </p>
      ) : (
        <div className="rounded-lg border overflow-auto">
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
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AssignSupervisorDialog
        site={assignTarget}
        supervisors={supervisors}
        open={!!assignTarget}
        onOpenChange={(o) => { if (!o) setAssignTarget(null) }}
      />
      <DeactivateSiteDialog
        site={deactivateTarget}
        open={!!deactivateTarget}
        onOpenChange={(o) => { if (!o) setDeactivateTarget(null) }}
      />
    </div>
  )
}
