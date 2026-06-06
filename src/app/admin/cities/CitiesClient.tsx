'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { createCity } from '@/actions/cities'
import { createState } from '@/actions/states'
import { INDIA_STATES, getCitiesForState } from '@/lib/india-geo'
import { Plus } from 'lucide-react'

type StateBase = { id: string; name: string; createdAt: Date }
type State = StateBase & { cityCount: number; siteCount: number }
type City = {
  id: string
  name: string
  shortCode: string
  status: string
  createdAt: Date
  state: StateBase
}

// ─── State dialog ─────────────────────────────────────────────────────────────

const stateSchema = z.object({
  name: z.string().min(1, 'State name is required').max(100),
})
type StateForm = z.infer<typeof stateSchema>

function AddStateDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<StateForm>({
    resolver: zodResolver(stateSchema),
  })

  function onSubmit(values: StateForm) {
    setServerError('')
    startTransition(async () => {
      try {
        await createState(values)
        reset()
        setOpen(false)
        onSuccess()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Plus className="size-3.5" />Add State</Button>} />
      <DialogContent>
        <DialogTitle>Add State</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="state-name">State Name</Label>
            <Input
              id="state-name"
              {...register('name')}
              placeholder="e.g. Maharashtra"
              list="india-states-list"
              autoComplete="off"
            />
            <datalist id="india-states-list">
              {INDIA_STATES.map((s) => <option key={s} value={s} />)}
            </datalist>
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          {serverError && <p className="text-xs text-destructive">{serverError}</p>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── City dialog ──────────────────────────────────────────────────────────────

const citySchema = z.object({
  name: z.string().min(1, 'City name is required').max(100),
  shortCode: z.string().min(2, 'Min 2 characters').max(10, 'Max 10 characters'),
  stateId: z.string().uuid('Select a state'),
})
type CityForm = z.infer<typeof citySchema>

function AddCityDialog({ states, onSuccess }: { states: State[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [selectedStateName, setSelectedStateName] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CityForm>({ resolver: zodResolver(citySchema) })

  const cityName = watch('name', '')

  function handleStateChange(stateId: string) {
    setValue('stateId', stateId, { shouldValidate: true })
    const state = states.find((s) => s.id === stateId)
    setSelectedStateName(state?.name ?? '')
    setValue('name', '')
    setValue('shortCode', '')
  }

  function handleCityNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setValue('name', value)
    // Auto-suggest short code: first 3 uppercase letters stripped of spaces
    const suggested = value.replace(/\s+/g, '').slice(0, 3).toUpperCase()
    if (suggested) setValue('shortCode', suggested)
  }

  function onSubmit(values: CityForm) {
    setServerError('')
    startTransition(async () => {
      try {
        await createCity({ ...values, shortCode: values.shortCode.toUpperCase() })
        reset()
        setSelectedStateName('')
        setOpen(false)
        onSuccess()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  const citySuggestions = getCitiesForState(selectedStateName)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); setSelectedStateName('') } setOpen(o) }}>
      <DialogTrigger render={<Button><Plus className="size-4" />Add City</Button>} />
      <DialogContent>
        <DialogTitle>Add City</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">

          <div className="space-y-1.5">
            <Label>State</Label>
            {states.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No states added yet. Add a state first.
              </p>
            ) : (
              <Select onValueChange={(v: string | null) => { if (v) handleStateChange(v) }}>
                <SelectTrigger className="w-full">
                  <span className={selectedStateName ? 'text-foreground' : 'text-muted-foreground'}>
                    {selectedStateName || 'Select a state'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {states.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.stateId && <p className="text-xs text-destructive">{errors.stateId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city-name">City Name</Label>
            <Input
              id="city-name"
              placeholder={selectedStateName ? `Cities in ${selectedStateName}…` : 'Select a state first'}
              disabled={!selectedStateName}
              list="city-suggestions-list"
              autoComplete="off"
              value={cityName}
              onChange={handleCityNameChange}
            />
            {citySuggestions.length > 0 && (
              <datalist id="city-suggestions-list">
                {citySuggestions.map((c) => <option key={c} value={c} />)}
              </datalist>
            )}
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city-code">Short Code</Label>
            <Input
              id="city-code"
              {...register('shortCode')}
              placeholder="e.g. MUM"
              className="uppercase"
              onChange={(e) => setValue('shortCode', e.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted-foreground">
              Auto-suggested from city name. Used in site code generation.
            </p>
            {errors.shortCode && <p className="text-xs text-destructive">{errors.shortCode.message}</p>}
          </div>

          {serverError && <p className="text-xs text-destructive">{serverError}</p>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isPending || states.length === 0}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── States table ─────────────────────────────────────────────────────────────

const stateCol = createColumnHelper<State>()
const stateColumns = [
  stateCol.accessor('name', { header: 'State' }),
  stateCol.accessor('cityCount', {
    header: 'Cities',
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
  stateCol.accessor('siteCount', {
    header: 'Sites',
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
]

// ─── Cities table ─────────────────────────────────────────────────────────────

const cityCol = createColumnHelper<City>()
const cityColumns = [
  cityCol.accessor('name', { header: 'City' }),
  cityCol.accessor('state', { header: 'State', cell: (info) => info.getValue().name }),
  cityCol.accessor('shortCode', { header: 'Short Code' }),
  cityCol.accessor('status', {
    header: 'Status',
    cell: (info) => (
      <Badge variant={info.getValue() === 'active' ? 'default' : 'outline'}>
        {info.getValue()}
      </Badge>
    ),
  }),
  cityCol.accessor('createdAt', {
    header: 'Added',
    cell: (info) => new Date(info.getValue()).toLocaleDateString(),
  }),
]

// ─── Main component ───────────────────────────────────────────────────────────

export function CitiesClient({ cities, states }: { cities: City[]; states: State[] }) {
  const router = useRouter()
  const refresh = () => router.refresh()

  const stateTable = useReactTable({ data: states, columns: stateColumns, getCoreRowModel: getCoreRowModel() })
  const cityTable = useReactTable({ data: cities, columns: cityColumns, getCoreRowModel: getCoreRowModel() })

  return (
    <div className="space-y-8">

      {/* States section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">States</h2>
          <AddStateDialog onSuccess={refresh} />
        </div>
        {states.length === 0 ? (
          <p className="text-muted-foreground text-sm">No states added yet. Add a state to get started.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                {stateTable.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => (
                      <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {stateTable.getRowModel().rows.map((row) => (
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
      </div>

      {/* Cities section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Cities</h2>
          <AddCityDialog states={states} onSuccess={refresh} />
        </div>
        {cities.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {states.length === 0
              ? 'Add a state first, then you can add cities.'
              : 'No cities added yet.'}
          </p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                {cityTable.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => (
                      <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {cityTable.getRowModel().rows.map((row) => (
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
      </div>

    </div>
  )
}
