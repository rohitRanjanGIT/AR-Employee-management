'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { submitWorkerAsSupervisor } from '@/actions/workers'

type City = { id: string; name: string }

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

export function SubmitWorkerDialog({ assignedCities }: { assignedCities: City[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedCityName, setSelectedCityName] = useState('')
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState('')
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  function handleClose() {
    reset()
    setSelectedCityName('')
    setSelectedCategoryLabel('')
    setServerError('')
  }

  function onSubmit(values: FormValues) {
    if (values.aadhaar && !/^\d{12}$/.test(values.aadhaar)) {
      setServerError('Aadhaar must be exactly 12 digits')
      return
    }
    setServerError('')
    startTransition(async () => {
      try {
        await submitWorkerAsSupervisor({
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
        setOpen(false)
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
        setOpen(o)
      }}
    >
      <DialogTrigger render={<Button><Plus className="size-4" />Submit Worker</Button>} />
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogTitle>Submit Worker for Approval</DialogTitle>
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
            <Label htmlFor="sw-name">Name</Label>
            <Input id="sw-name" {...register('name')} placeholder="Full name" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sw-age">Age</Label>
              <Input id="sw-age" type="number" min={18} max={80} {...register('age')} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sw-phone">Phone</Label>
              <Input id="sw-phone" {...register('phone')} placeholder="Optional" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sw-address">Address</Label>
            <Input id="sw-address" {...register('address')} placeholder="Optional" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sw-join-date">Join Date</Label>
              <Input id="sw-join-date" type="date" {...register('joinDate')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sw-emergency">Emergency Contact</Label>
              <Input id="sw-emergency" {...register('emergencyContact')} placeholder="Optional" />
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
              <Label htmlFor="sw-wage">Daily Wage (₹)</Label>
              <Input id="sw-wage" type="number" step="0.01" min={0} {...register('wageDaily')} placeholder="0.00" />
              {errors.wageDaily && <p className="text-xs text-destructive">{errors.wageDaily.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sw-ot">OT Rate (₹)</Label>
              <Input id="sw-ot" type="number" step="0.01" min={0} {...register('otRate')} placeholder="Optional" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sw-aadhaar">Aadhaar Number</Label>
            <Input
              id="sw-aadhaar"
              type="text"
              inputMode="numeric"
              maxLength={12}
              {...register('aadhaar')}
              placeholder="12-digit number (optional)"
            />
            <p className="text-xs text-muted-foreground">Enter all 12 digits, no spaces or dashes.</p>
          </div>

          {serverError && <p className="text-xs text-destructive">{serverError}</p>}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Submitting…' : 'Submit for Approval'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
