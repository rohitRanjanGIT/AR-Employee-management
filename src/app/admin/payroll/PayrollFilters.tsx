'use client'

import { Button } from '@/components/ui/button'

export type FilterOptions = {
  states: { id: string; name: string }[]
  cities: { id: string; name: string; stateId: string }[]
  sites: { id: string; name: string; code: string; cityId: string; stateId: string }[]
  months: { value: string; label: string }[]
}

export type Filters = {
  stateId?: string
  cityId?: string
  siteId?: string
  yearMonth?: string
}

const selectClass =
  'rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30'

export function PayrollFilters({
  options,
  filters,
  onChange,
  hideSite = false,
}: {
  options: FilterOptions
  filters: Filters
  onChange: (next: Filters) => void
  /** Worker earnings page filters within a single worker — site filter is not shown there */
  hideSite?: boolean
}) {
  // Cities narrowed by selected state
  const cities = filters.stateId
    ? options.cities.filter((c) => c.stateId === filters.stateId)
    : options.cities

  // Sites narrowed by selected city, then state
  const sites = filters.cityId
    ? options.sites.filter((s) => s.cityId === filters.cityId)
    : filters.stateId
      ? options.sites.filter((s) => s.stateId === filters.stateId)
      : options.sites

  const hasAny =
    filters.stateId || filters.cityId || filters.siteId || filters.yearMonth

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* State — clearing it clears city + site */}
      <select
        className={selectClass}
        value={filters.stateId ?? ''}
        onChange={(e) => {
          const stateId = e.target.value || undefined
          onChange({ ...filters, stateId, cityId: undefined, siteId: undefined })
        }}
      >
        <option value="">All States</option>
        {options.states.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {/* City — clearing it clears site */}
      <select
        className={selectClass}
        value={filters.cityId ?? ''}
        onChange={(e) => {
          const cityId = e.target.value || undefined
          onChange({ ...filters, cityId, siteId: undefined })
        }}
      >
        <option value="">All Cities</option>
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Site */}
      {!hideSite && (
        <select
          className={selectClass}
          value={filters.siteId ?? ''}
          onChange={(e) => {
            const siteId = e.target.value || undefined
            onChange({ ...filters, siteId })
          }}
        >
          <option value="">All Sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
      )}

      {/* Month — independent, never cleared by other filters */}
      <select
        className={selectClass}
        value={filters.yearMonth ?? ''}
        onChange={(e) => {
          const yearMonth = e.target.value || undefined
          onChange({ ...filters, yearMonth })
        }}
      >
        <option value="">All Months</option>
        {options.months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      {hasAny && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          Clear all filters
        </Button>
      )}
    </div>
  )
}
