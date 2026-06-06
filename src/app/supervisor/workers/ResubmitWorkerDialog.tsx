'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { resubmitWorker } from '@/actions/workers'

type City = { id: string; name: string }
type Worker = {
  id: string
  name: string
  cityId: string
  age: number | null
  phone: string | null
  address: string | null
  joinDate: Date | null
  emergencyContact: string | null
  category: 'skilled' | 'semi_skilled' | 'helper'
  wageDaily: string
  otRate: string | null
}

const schema = z.object({
  cityId: z.string().uuid('City is required'),
  name: z.string().min(1, 'Name is required').max(200),
  age: z.string().optional(),
  phone: z.string().max(15).optional(),
  address: z.string().max(500).optional(),
  joinDate: z.string().optional(),
  emergencyContact: z.string().max(200).optional(),
  category: z.enum(['skilled', 'semi_skilled', 'helper']),
  wageDaily: z.string().min(1, 'Daily wage is required'),
  otRate: z.string().optional(),
  aadhaar: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const CATEGORIES = [
  { value: 'skilled', label: 'Skilled' },
  { value: 'semi_skilled', label: 'Semi-Skilled' },
  { value: 'helper', label: 'Helper' },
] as const

const CATEGORY_LABELS: Record<string, string> = {
  skilled: 'Skilled',
  semi_skilled: 'Semi-Skilled',
  helper: 'Helper',
}

export function ResubmitWorkerDialog({
  worker,
  assignedCities,
  open,
  onOpenChange,
}: {
  worker: Worker | null
  assignedCities: City[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [selectedCityName, setSelectedCityName] = useState(
    worker ? (assignedCities.find((c) => c.id === worker.cityId)?.name ?? '') : ''
  )
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState(
    worker ? (CATEGORY_LABELS[worker.category] ?? '') : ''
  )
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  function toDateString(d: Date | null) {
    if (!d) return ''
    return new Date(d).toISOString().slice(0, 10)
  }

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: worker
      ? {
          cityId: worker.cityId,
          name: worker.name,
          age: worker.age != null ? String(worker.age) : '',
          phone: worker.phone ?? '',
          address: worker.address ?? '',
          joinDate: toDateString(worker.joinDate),
          emergencyContact: worker.emergencyContact ?? '',
          category: worker.category,
          wageDaily: worker.wageDaily,
          otRate: worker.otRate ?? '',
          aadhaar: '',
        }
      : undefined,
  })

  function handleClose() {
    reset()
    setServerError('')
    setSelectedCityName(worker ? (assignedCities.find((c) => c.id === worker.cityId)?.name ?? '') : '')
    setSelectedCategoryLabel(worker ? (CATEGORY_LABELS[worker.category] ?? '') : '')
  }

  function onSubmit(values: FormValues) {
    if (!worker) return
    if (values.aadhaar && !/^\d{12}$/.test(values.aadhaar)) {
      setServerError('Aadhaar must be exactly 12 digits')
      return
    }
    setServerError('')
    startTransition(async () => {
      try {
        await resubmitWorker(worker.id, {
          cityId: values.cityId,
          name: values.name,
          age: values.age ? parseInt(values.age, 10) : undefined,
          phone: values.phone || undefined,
          address: values.address || undefined,
          joinDate: values.joinDate || undefined,
          emergencyContact: values.emergencyContact || undefined,
          category: values.category,
          wageDaily: values.wageDaily,
          otRate: values.otRate || undefined,
          aadhaar: values.aadhaar || undefined,
        })
        handleClose()
        onOpenChange(false)
        router.refresh()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogTitle>Resubmit Worker</DialogTitle>
        {worker && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Controller
                control={control}
                name="cityId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(v) => {
                      field.onChange(v ?? '')
                      setSelectedCityName(assignedCities.find((c) => c.id === v)?.name ?? '')
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <span className={selectedCityName ? 'text-foreground' : 'text-muted-foreground'}>
                        {selectedCityName || 'Select city'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {assignedCities.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.cityId && <p className="text-xs text-destructive">{errors.cityId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rs-name">Name</Label>
              <Input id="rs-name" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rs-age">Age</Label>
                <Input id="rs-age" type="number" min={18} max={80} {...register('age')} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rs-phone">Phone</Label>
                <Input id="rs-phone" {...register('phone')} placeholder="Optional" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rs-address">Address</Label>
              <Input id="rs-address" {...register('address')} placeholder="Optional" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rs-join-date">Join Date</Label>
                <Input id="rs-join-date" type="date" {...register('joinDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rs-emergency">Emergency Contact</Label>
                <Input id="rs-emergency" {...register('emergencyContact')} placeholder="Optional" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(v) => {
                      field.onChange(v ?? '')
                      setSelectedCategoryLabel(CATEGORIES.find((c) => c.value === v)?.label ?? '')
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <span className={selectedCategoryLabel ? 'text-foreground' : 'text-muted-foreground'}>
                        {selectedCategoryLabel || 'Select category'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rs-wage">Daily Wage (₹)</Label>
                <Input id="rs-wage" type="number" step="0.01" min={0} {...register('wageDaily')} />
                {errors.wageDaily && <p className="text-xs text-destructive">{errors.wageDaily.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rs-ot">OT Rate (₹)</Label>
                <Input id="rs-ot" type="number" step="0.01" min={0} placeholder="Optional" {...register('otRate')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rs-aadhaar">Aadhaar Number</Label>
              <Input
                id="rs-aadhaar"
                type="text"
                inputMode="numeric"
                maxLength={12}
                {...register('aadhaar')}
                placeholder="Leave blank to keep existing"
              />
              <p className="text-xs text-muted-foreground">
                Only enter a new 12-digit number to update; leave blank to keep the existing Aadhaar.
              </p>
            </div>

            {serverError && <p className="text-xs text-destructive">{serverError}</p>}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" disabled={isPending} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Resubmitting…' : 'Resubmit for Approval'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
