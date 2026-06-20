'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'

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

// base-nova Select uses a sentinel for the "all" option (empty-string values
// are not supported); it maps back to `undefined` in the filter state.
const ALL = 'all'

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

  // base-nova Select renders the raw value in the trigger, so the label is
  // derived from the controlled filter state on every render.
  const stateName = options.states.find((s) => s.id === filters.stateId)?.name ?? 'All States'
  const cityName = cities.find((c) => c.id === filters.cityId)?.name ?? 'All Cities'
  const siteObj = sites.find((s) => s.id === filters.siteId)
  const siteName = siteObj ? `${siteObj.name} (${siteObj.code})` : 'All Sites'
  const monthName = options.months.find((m) => m.value === filters.yearMonth)?.label ?? 'All Months'

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* State — clearing it clears city + site */}
      <Select
        value={filters.stateId ?? ALL}
        onValueChange={(v) => {
          const stateId = !v || v === ALL ? undefined : v
          onChange({ ...filters, stateId, cityId: undefined, siteId: undefined })
        }}
      >
        <SelectTrigger className="w-40">
          <span className="text-sm">{stateName}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All States</SelectItem>
          {options.states.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* City — clearing it clears site */}
      <Select
        value={filters.cityId ?? ALL}
        onValueChange={(v) => {
          const cityId = !v || v === ALL ? undefined : v
          onChange({ ...filters, cityId, siteId: undefined })
        }}
      >
        <SelectTrigger className="w-40">
          <span className="text-sm">{cityName}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Cities</SelectItem>
          {cities.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Site */}
      {!hideSite && (
        <Select
          value={filters.siteId ?? ALL}
          onValueChange={(v) => {
            const siteId = !v || v === ALL ? undefined : v
            onChange({ ...filters, siteId })
          }}
        >
          <SelectTrigger className="w-48">
            <span className="text-sm">{siteName}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Sites</SelectItem>
            {sites.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Month — independent, never cleared by other filters */}
      <Select
        value={filters.yearMonth ?? ALL}
        onValueChange={(v) => {
          const yearMonth = !v || v === ALL ? undefined : v
          onChange({ ...filters, yearMonth })
        }}
      >
        <SelectTrigger className="w-40">
          <span className="text-sm">{monthName}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Months</SelectItem>
          {options.months.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasAny && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          Clear all filters
        </Button>
      )}
    </div>
  )
}
