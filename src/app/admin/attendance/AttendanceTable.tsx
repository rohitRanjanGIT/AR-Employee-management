'use client'

import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
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
import { formatINR } from '@/lib/payroll'
import { formatDate } from '@/lib/utils'
import { DayDetail, rowWage, type AttendanceRecord } from './DayDetail'

type SiteFilter = { id: string; name: string; cityName?: string }

interface Props {
  records: AttendanceRecord[]
  sites: SiteFilter[]
  initialSiteId?: string
  initialDate?: string
  onEdit: (r: AttendanceRecord) => void
}

// One aggregated site-day group
type DayGroup = {
  key: string
  date: string
  siteId: string
  siteName: string
  cityName: string
  records: AttendanceRecord[]
  morningSupers: Set<string>
  eveningSupers: Set<string>
  workers: number
  full: number
  half: number
  ot: number
  pay: number
}

/** Recording supervisors, tagged by session unless one supervisor did both. */
function SupervisorCell({ morning, evening }: { morning: Set<string>; evening: Set<string> }) {
  const m = [...morning].sort()
  const e = [...evening].sort()
  if (m.length === 0 && e.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  const sameSet = m.length > 0 && e.length === m.length && m.every((n) => e.includes(n))
  if (sameSet) {
    return <span className="text-sm">{m.join(', ')}</span>
  }
  return (
    <div className="space-y-0.5 text-sm">
      {m.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground">Morning:</span> {m.join(', ')}
        </div>
      )}
      {e.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground">Evening:</span> {e.join(', ')}
        </div>
      )}
    </div>
  )
}

export function AttendanceTable({
  records,
  sites,
  initialSiteId = '',
  initialDate = '',
  onEdit,
}: Props) {
  const [siteFilter, setSiteFilter] = useState(initialSiteId)
  const [siteFilterName, setSiteFilterName] = useState(
    sites.find((s) => s.id === initialSiteId)?.name ?? ''
  )
  const [cityFilter, setCityFilter] = useState('')
  const [dateFilter, setDateFilter] = useState(initialDate)

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialSiteId && initialDate ? [`${initialSiteId}__${initialDate}`] : [])
  )

  const cities = useMemo(() => {
    const set = new Set<string>()
    for (const s of sites) if (s.cityName) set.add(s.cityName)
    for (const r of records) set.add(r.site.city.name)
    return [...set].sort()
  }, [sites, records])

  const groups = useMemo(() => {
    const filtered = records.filter((r) => {
      if (dateFilter && r.date !== dateFilter) return false
      if (siteFilter && r.site.id !== siteFilter) return false
      if (cityFilter && r.site.city.name !== cityFilter) return false
      return true
    })

    const map = new Map<string, DayGroup>()
    for (const r of filtered) {
      const key = `${r.site.id}__${r.date}`
      let g = map.get(key)
      if (!g) {
        g = {
          key,
          date: r.date,
          siteId: r.site.id,
          siteName: r.site.name,
          cityName: r.site.city.name,
          records: [],
          morningSupers: new Set(),
          eveningSupers: new Set(),
          workers: 0,
          full: 0,
          half: 0,
          ot: 0,
          pay: 0,
        }
        map.set(key, g)
      }
      g.records.push(r)
      g.workers++
      if (r.derivedStatus === 'full') g.full++
      else if (r.derivedStatus === 'half') g.half++
      if (r.ot !== 'none') g.ot++
      if (r.morningMarkedByEmployee) g.morningSupers.add(r.morningMarkedByEmployee.name)
      if (r.eveningMarkedByEmployee) g.eveningSupers.add(r.eveningMarkedByEmployee.name)
      g.pay += rowWage(r)
    }

    const list = [...map.values()]
    for (const g of list) {
      g.records.sort((a, b) => a.worker.name.localeCompare(b.worker.name))
    }
    return list.sort(
      (a, b) => b.date.localeCompare(a.date) || a.siteName.localeCompare(b.siteName)
    )
  }, [records, dateFilter, siteFilter, cityFilter])

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function clearFilters() {
    setSiteFilter('')
    setSiteFilterName('')
    setCityFilter('')
    setDateFilter('')
  }

  const hasFilters = !!(siteFilter || cityFilter || dateFilter)
  const totalPay = groups.reduce((sum, g) => sum + g.pay, 0)

  const COLS = 9

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
        />

        <Select
          value={siteFilter}
          onValueChange={(v: string | null) => {
            setSiteFilter(v ?? '')
            setSiteFilterName(sites.find((s) => s.id === v)?.name ?? '')
          }}
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <span className={siteFilter ? 'text-foreground' : 'text-muted-foreground'}>
              {siteFilterName || 'All Sites'}
            </span>
          </SelectTrigger>
          <SelectContent>
            {sites.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={cityFilter}
          onValueChange={(v: string | null) => setCityFilter(v ?? '')}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <span className={cityFilter ? 'text-foreground' : 'text-muted-foreground'}>
              {cityFilter || 'All Cities'}
            </span>
          </SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            Clear filters
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {groups.length} site-day{groups.length !== 1 ? 's' : ''} · {formatINR(totalPay)} total
        </span>
      </div>

      {/* Grouped table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 text-xs"></TableHead>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Site</TableHead>
              <TableHead className="text-xs">City</TableHead>
              <TableHead className="text-xs">Recorded by</TableHead>
              <TableHead className="text-xs">Workers</TableHead>
              <TableHead className="text-xs">Full / Half</TableHead>
              <TableHead className="text-xs">OT</TableHead>
              <TableHead className="text-xs text-right">Day Pay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLS} className="py-8 text-center text-muted-foreground">
                  No attendance records found.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((g) => {
                const isOpen = expanded.has(g.key)
                return [
                  <TableRow
                    key={g.key}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => toggle(g.key)}
                  >
                    <TableCell className="py-2">
                      {isOpen ? (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-sm tabular-nums">{formatDate(g.date)}</TableCell>
                    <TableCell className="py-2 text-sm font-medium">{g.siteName}</TableCell>
                    <TableCell className="py-2 text-sm text-muted-foreground">{g.cityName}</TableCell>
                    <TableCell className="py-2">
                      <SupervisorCell morning={g.morningSupers} evening={g.eveningSupers} />
                    </TableCell>
                    <TableCell className="py-2 text-sm tabular-nums">{g.workers}</TableCell>
                    <TableCell className="py-2 text-sm tabular-nums">
                      {g.full} / {g.half}
                    </TableCell>
                    <TableCell className="py-2 text-sm tabular-nums">
                      {g.ot > 0 ? g.ot : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="py-2 text-right text-sm font-medium tabular-nums">
                      {formatINR(g.pay)}
                    </TableCell>
                  </TableRow>,
                  isOpen && (
                    <TableRow key={`${g.key}-detail`} className="bg-muted/20">
                      <TableCell colSpan={COLS} className="p-0">
                        <DayDetail records={g.records} onEdit={onEdit} />
                      </TableCell>
                    </TableRow>
                  ),
                ]
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
