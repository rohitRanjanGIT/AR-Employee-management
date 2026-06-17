'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { todayIST } from '@/lib/attendance'
import { formatINR } from '@/lib/payroll'
import { formatDate } from '@/lib/utils'
import { DayDetail, rowWage, type AttendanceRecord } from './DayDetail'

type SiteInfo = { id: string; name: string; cityName: string }
type CityCount = { city: string; total: number }

interface Props {
  records: AttendanceRecord[]
  sites: SiteInfo[]
  cityWorkerCounts: CityCount[]
  onEdit: (r: AttendanceRecord) => void
}

function shiftDate(date: string, delta: number): string {
  const dt = new Date(`${date}T00:00:00`)
  dt.setDate(dt.getDate() + delta)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

type Tally = { marked: number; full: number; half: number; ot: number; pay: number }
const emptyTally = (): Tally => ({ marked: 0, full: 0, half: 0, ot: 0, pay: 0 })

function addToTally(t: Tally, r: AttendanceRecord) {
  t.marked++
  if (r.derivedStatus === 'full') t.full++
  else if (r.derivedStatus === 'half') t.half++
  if (r.ot !== 'none') t.ot++
  t.pay += rowWage(r)
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export function AttendanceOverview({ records, sites, cityWorkerCounts, onEdit }: Props) {
  const today = todayIST()
  const [date, setDate] = useState(today)
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set())

  // Collapse any open site detail when the day changes
  useEffect(() => setExpandedSites(new Set()), [date])

  function toggleSite(siteId: string) {
    setExpandedSites((prev) => {
      const next = new Set(prev)
      if (next.has(siteId)) next.delete(siteId)
      else next.add(siteId)
      return next
    })
  }

  const dayRecords = useMemo(() => records.filter((r) => r.date === date), [records, date])

  const kpis = useMemo(() => {
    const t = emptyTally()
    const siteSet = new Set<string>()
    const citySet = new Set<string>()
    for (const r of dayRecords) {
      addToTally(t, r)
      siteSet.add(r.site.id)
      citySet.add(r.site.city.name)
    }
    return { ...t, sites: siteSet.size, cities: citySet.size }
  }, [dayRecords])

  const cityRows = useMemo(() => {
    const totals = new Map(cityWorkerCounts.map((c) => [c.city, c.total]))
    const map = new Map<string, Tally & { sites: Set<string> }>()
    for (const r of dayRecords) {
      const city = r.site.city.name
      const e = map.get(city) ?? { ...emptyTally(), sites: new Set<string>() }
      addToTally(e, r)
      e.sites.add(r.site.id)
      map.set(city, e)
    }
    return [...map.entries()]
      .map(([city, v]) => ({
        city,
        marked: v.marked,
        full: v.full,
        half: v.half,
        ot: v.ot,
        sites: v.sites.size,
        total: totals.get(city) ?? 0,
      }))
      .sort((a, b) => b.marked - a.marked || a.city.localeCompare(b.city))
  }, [dayRecords, cityWorkerCounts])

  const siteRows = useMemo(() => {
    const map = new Map<string, Tally>()
    for (const r of dayRecords) {
      const e = map.get(r.site.id) ?? emptyTally()
      addToTally(e, r)
      map.set(r.site.id, e)
    }
    // Union of active sites + any site that has records on this date
    const known = new Map(sites.map((s) => [s.id, s]))
    for (const r of dayRecords) {
      if (!known.has(r.site.id)) {
        known.set(r.site.id, { id: r.site.id, name: r.site.name, cityName: r.site.city.name })
      }
    }
    return [...known.values()]
      .map((s) => {
        const v = map.get(s.id) ?? emptyTally()
        return { ...s, ...v }
      })
      .sort((a, b) => b.marked - a.marked || a.name.localeCompare(b.name))
  }, [dayRecords, sites])

  const isToday = date === today

  return (
    <div className="space-y-5">
      {/* Date navigator */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Previous day"
          onClick={() => setDate((d) => shiftDate(d, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Next day"
          disabled={isToday}
          onClick={() => setDate((d) => shiftDate(d, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        {!isToday && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDate(today)}>
            Jump to today
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          {formatDate(date)}
          {isToday && <Badge variant="outline" className="ml-2 text-xs">Today</Badge>}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Workers Marked" value={kpis.marked} />
        <Kpi label="Full Days" value={kpis.full} />
        <Kpi label="Half Days" value={kpis.half} />
        <Kpi label="OT Entries" value={kpis.ot} />
        <Kpi label="Sites Active" value={kpis.sites} hint={`of ${sites.length}`} />
        <Kpi label="Cities Active" value={kpis.cities} />
      </div>

      {dayRecords.length === 0 && (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          No attendance marked on {formatDate(date)}.
        </p>
      )}

      {/* City-wise breakdown */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">City-wise</h2>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">City</TableHead>
                <TableHead className="text-xs">Sites</TableHead>
                <TableHead className="text-xs">Marked</TableHead>
                <TableHead className="text-xs">Full</TableHead>
                <TableHead className="text-xs">Half</TableHead>
                <TableHead className="text-xs">OT</TableHead>
                <TableHead className="text-xs">Coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cityRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    No data for this date.
                  </TableCell>
                </TableRow>
              ) : (
                cityRows.map((c) => (
                  <TableRow key={c.city}>
                    <TableCell className="py-2 text-sm font-medium">{c.city}</TableCell>
                    <TableCell className="py-2 text-sm tabular-nums">{c.sites}</TableCell>
                    <TableCell className="py-2 text-sm tabular-nums">{c.marked}</TableCell>
                    <TableCell className="py-2 text-sm tabular-nums">{c.full}</TableCell>
                    <TableCell className="py-2 text-sm tabular-nums">{c.half}</TableCell>
                    <TableCell className="py-2 text-sm tabular-nums">
                      {c.ot > 0 ? c.ot : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="py-2 text-sm tabular-nums">
                      {c.total > 0 ? (
                        <span className="text-muted-foreground">
                          {c.marked}/{c.total} ({Math.round((c.marked / c.total) * 100)}%)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Site-wise breakdown */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Site-wise</h2>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 text-xs"></TableHead>
                <TableHead className="text-xs">Site</TableHead>
                <TableHead className="text-xs">City</TableHead>
                <TableHead className="text-xs">Marked</TableHead>
                <TableHead className="text-xs">Full</TableHead>
                <TableHead className="text-xs">Half</TableHead>
                <TableHead className="text-xs">OT</TableHead>
                <TableHead className="text-xs text-right">Day Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {siteRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                    No active sites.
                  </TableCell>
                </TableRow>
              ) : (
                siteRows.flatMap((s) => {
                  const hasRecords = s.marked > 0
                  const isOpen = hasRecords && expandedSites.has(s.id)
                  return [
                    <TableRow
                      key={s.id}
                      className={`${hasRecords ? 'cursor-pointer hover:bg-muted/40' : 'opacity-60'}`}
                      onClick={hasRecords ? () => toggleSite(s.id) : undefined}
                    >
                      <TableCell className="py-2">
                        {hasRecords &&
                          (isOpen ? (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          ))}
                      </TableCell>
                      <TableCell className="py-2 text-sm font-medium">{s.name}</TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">{s.cityName}</TableCell>
                      <TableCell className="py-2 text-sm tabular-nums">
                        {hasRecords ? s.marked : <span className="text-muted-foreground">Not marked</span>}
                      </TableCell>
                      <TableCell className="py-2 text-sm tabular-nums">{s.full}</TableCell>
                      <TableCell className="py-2 text-sm tabular-nums">{s.half}</TableCell>
                      <TableCell className="py-2 text-sm tabular-nums">
                        {s.ot > 0 ? s.ot : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="py-2 text-right text-sm font-medium tabular-nums">
                        {s.marked > 0 ? formatINR(s.pay) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>,
                    isOpen && (
                      <TableRow key={`${s.id}-detail`} className="bg-muted/20">
                        <TableCell colSpan={8} className="p-0">
                          <DayDetail
                            records={dayRecords
                              .filter((r) => r.site.id === s.id)
                              .sort((a, b) => a.worker.name.localeCompare(b.worker.name))}
                            onEdit={onEdit}
                          />
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
    </div>
  )
}
