'use client'

import { useState, useTransition } from 'react'
import { getConsolidatedPayroll } from '@/actions/payroll'
import { formatINR } from '@/lib/payroll'
import { PayrollFilters, type FilterOptions, type Filters } from './PayrollFilters'
import { SitePayrollCard } from './SitePayrollCard'
import type { ConsolidatedSite } from './types'

export function PayrollClient({
  filterOptions,
  initialData,
}: {
  filterOptions: FilterOptions
  initialData: ConsolidatedSite[]
}) {
  const [filters, setFilters] = useState<Filters>({})
  const [data, setData] = useState<ConsolidatedSite[]>(initialData)
  const [isPending, startTransition] = useTransition()

  function applyFilters(next: Filters) {
    setFilters(next)
    startTransition(async () => {
      const result = await getConsolidatedPayroll({
        stateId: next.stateId,
        cityId: next.cityId,
        siteId: next.siteId,
        yearMonth: next.yearMonth,
      })
      setData(result)
    })
  }

  const totalWage = data.reduce((s, site) => s + site.totalWageAllTime, 0)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Payroll</h1>

      <PayrollFilters options={filterOptions} filters={filters} onChange={applyFilters} />

      <div className="flex items-center justify-between border-y py-2">
        <p className="text-sm text-muted-foreground">
          Showing {data.length} site{data.length !== 1 ? 's' : ''}
        </p>
        <p className="text-sm font-medium">
          Total: <span className="font-semibold">{formatINR(totalWage)}</span>
        </p>
      </div>

      {isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No attendance data matches the selected filters.
        </p>
      ) : (
        <div className="space-y-3">
          {data.map((site) => (
            <SitePayrollCard key={site.siteId} site={site} />
          ))}
        </div>
      )}
    </div>
  )
}
