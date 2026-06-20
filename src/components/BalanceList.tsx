'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatINR } from '@/lib/payroll'

export type BalanceWorker = {
  id: string
  name: string
  cityId: string
  cityName: string
  totalEarned: number
  totalAdvance: number
  balance: number
}

type StatusFilter = 'all' | 'payable' | 'over'

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All balances',
  payable: 'Payable',
  over: 'Over-advanced',
}

export function BalanceList({
  workers,
  basePath,
}: {
  /** Worker rows with lifetime earned / advance / balance. */
  workers: BalanceWorker[]
  /** Route prefix for the statement drill-down, e.g. `/admin/balance`. */
  basePath: string
}) {
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('all')

  const cities = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of workers) map.set(w.cityId, w.cityName)
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [workers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return workers
      .filter((w) => {
        if (q && !w.name.toLowerCase().includes(q)) return false
        if (city !== 'all' && w.cityId !== city) return false
        if (status === 'payable' && w.balance <= 0) return false
        if (status === 'over' && w.balance >= 0) return false
        return true
      })
      .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
  }, [workers, search, city, status])

  const sumEarned = filtered.reduce((s, w) => s + w.totalEarned, 0)
  const sumAdvance = filtered.reduce((s, w) => s + w.totalAdvance, 0)
  const sumBalance = sumEarned - sumAdvance

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Total Earned</p>
          <p className="mt-1 text-2xl font-semibold">{formatINR(sumEarned)}</p>
          <p className="text-xs text-muted-foreground">across shown workers</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Total Advance</p>
          <p className="mt-1 text-2xl font-semibold">{formatINR(sumAdvance)}</p>
          <p className="text-xs text-muted-foreground">approved advances</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Net Balance</p>
          <p
            className={
              'mt-1 text-2xl font-semibold ' +
              (sumBalance >= 0 ? 'text-green-700 dark:text-green-400' : 'text-destructive')
            }
          >
            {sumBalance < 0 ? '−' : ''}
            {formatINR(Math.abs(sumBalance))}
          </p>
          <p className="text-xs text-muted-foreground">earned − advance</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search worker…"
          className="h-9 w-full sm:w-56"
          autoComplete="off"
        />
        <Select value={city} onValueChange={(v) => setCity(v ?? 'all')}>
          <SelectTrigger className="w-40">
            <span className="text-sm">
              {city === 'all' ? 'All cities' : cities.find((c) => c.id === city)?.name ?? 'All cities'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cities</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => setStatus((v as StatusFilter) ?? 'all')}
        >
          <SelectTrigger className="w-44">
            <span className="text-sm">{STATUS_LABELS[status]}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All balances</SelectItem>
            <SelectItem value="payable">Payable (earned &gt; advance)</SelectItem>
            <SelectItem value="over">Over-advanced</SelectItem>
          </SelectContent>
        </Select>
        {(search || city !== 'all' || status !== 'all') && (
          <button
            onClick={() => {
              setSearch('')
              setCity('all')
              setStatus('all')
            }}
            className="text-sm text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Worker</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="text-right">Total Earned</TableHead>
              <TableHead className="text-right">Advance Taken</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  No workers match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`${basePath}/workers/${w.id}`}
                      className="text-primary hover:underline"
                    >
                      {w.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{w.cityName}</TableCell>
                  <TableCell className="text-right">{formatINR(w.totalEarned)}</TableCell>
                  <TableCell className="text-right">{formatINR(w.totalAdvance)}</TableCell>
                  <TableCell
                    className={
                      'text-right font-medium ' +
                      (w.balance >= 0
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-destructive')
                    }
                  >
                    {w.balance < 0 ? '−' : ''}
                    {formatINR(Math.abs(w.balance))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Balance = Total Earned − Advance Taken. A positive balance is payable to the worker; a
        negative balance means they have been advanced more than earned. Click a name for the full
        statement.
      </p>
    </div>
  )
}
